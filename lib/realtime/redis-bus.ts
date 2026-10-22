/**
 * Implementasi Redis-stream-backed dari RealtimeBus (ADR-001 #5).
 * Publish = XADD; offset = stream ID `<ms>-<seq>` Redis langsung.
 * XTRIM MAXLEN ~1000 per topik supaya stream tidak tumbuh tanpa batas.
 * Single instance (YAGNI): satu poller XREAD BLOCK per topik aktif.
 * Tiap subscription menyimpan offset-nya sendiri, jadi reconnect resume dari
 * offset klien benar-benar dipatuhi (poller boleh re-read overlap; event yang
 * sudah pernah dikirim ke subscriber tertentu di-skip di sini).
 */
import Redis from "ioredis";
import type { RealtimeBus } from "./bus.ts";
import type { RealtimeEvent } from "./events.ts";

const STREAM_PREFIX = "jev:rt:";
const MAXLEN = 1000;
const POLL_BLOCK_MS = 5000;
const ERROR_BACKOFF_MS = 1000;

type Sub = {
  handler: (event: RealtimeEvent, offset: string) => void;
  /** Offset terakhir yang sudah dikirim ke subscriber ini. null = belum ada. */
  lastOffset: string | null;
};

function redisUrl(): string {
  return process.env.REDIS_URL || "redis://127.0.0.1:6379";
}

function gt(a: string, b: string | null): boolean {
  return b === null || a > b;
}

export class RedisBus implements RealtimeBus {
  // lazyConnect off + offline queue off: Redis mati -> publish gagal cepat dan
  // di-log fire-and-forget — request HTTP tidak menggantung menunggu Redis.
  private redis = new Redis(redisUrl(), {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  private subs = new Map<string, Set<Sub>>();
  /** Offset baca poller per topik (ID terakhir yang terbaca / titik mulai). */
  private readId = new Map<string, string>();
  private polling = new Set<string>();

  async publish(topic: string, event: RealtimeEvent): Promise<string> {
    const key = STREAM_PREFIX + topic;
    const offset = await this.redis.xadd(key, "*", "event", JSON.stringify(event));
    await this.redis.xtrim(key, "MAXLEN", "~", MAXLEN);
    return offset ?? "";
  }

  subscribe(topic: string, handler: Sub["handler"], fromOffset?: string): () => void {
    let set = this.subs.get(topic);
    if (!set) {
      set = new Set();
      this.subs.set(topic, set);
    }
    const sub: Sub = { handler, lastOffset: fromOffset ?? null };
    set.add(sub);
    if (!this.polling.has(topic)) {
      // Titik baca awal poller: offset klien kalau ada (resume overlap),
      // kalau tidak, "$" = hanya event yang terbit setelah sekarang.
      this.readId.set(topic, fromOffset ?? "$");
      this.polling.add(topic);
      void this.poll(topic);
    } else if (fromOffset !== undefined) {
      // Poller sudah jalan: mundurkan titik baca agar overlap re-read,
      // subscriber lain memfilter duplikat lewat lastOffset masing-masing.
      const cur = this.readId.get(topic) ?? "$";
      if (cur === "$" || fromOffset < cur) this.readId.set(topic, fromOffset);
    }
    return () => {
      const s = this.subs.get(topic);
      if (!s) return;
      s.delete(sub);
      if (s.size === 0) {
        this.subs.delete(topic);
        this.polling.delete(topic);
      }
    };
  }

  private async poll(topic: string): Promise<void> {
    const key = STREAM_PREFIX + topic;
    while (this.polling.has(topic)) {
      let res: Array<[string, Array<[string, string[]]>]> | null = null;
      try {
        res = await this.redis.xread(
          "BLOCK",
          POLL_BLOCK_MS,
          "STREAMS",
          key,
          this.readId.get(topic) ?? "$",
        );
      } catch (err) {
        console.error(`[realtime] XREAD ${topic} gagal:`, err);
        await new Promise((r) => setTimeout(r, ERROR_BACKOFF_MS));
        continue;
      }
      if (!res) continue;
      for (const [, entries] of res) {
        for (const [id, fields] of entries) {
          const cur = this.readId.get(topic) ?? "$";
          if (cur !== "$" && id <= cur) continue; // overlap re-read
          this.readId.set(topic, id);
          const idx = fields.indexOf("event");
          if (idx === -1) continue;
          let event: RealtimeEvent;
          try {
            event = JSON.parse(fields[idx + 1]) as RealtimeEvent;
          } catch {
            continue;
          }
          for (const sub of this.subs.get(topic) ?? []) {
            if (!gt(id, sub.lastOffset)) continue; // sudah pernah dikirim
            sub.lastOffset = id;
            try {
              sub.handler(event, id);
            } catch (err) {
              console.error(`[realtime] handler ${topic} error:`, err);
            }
          }
        }
      }
    }
  }
}
