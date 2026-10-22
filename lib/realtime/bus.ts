/**
 * Seam tunggal realtime (ADR-002 #2). Consumer (WS gateway, API routes,
 * matcher/presence) hanya melihat interface ini — detail Redis tersembunyi
 * di redis-bus.ts.
 */
import type { RealtimeEvent } from "./events.ts";
import { RedisBus } from "./redis-bus.ts";

export interface RealtimeBus {
  /** XADD ke stream topik; mengembalikan offset `<ms>-<seq>`. */
  publish(topic: string, event: RealtimeEvent): Promise<string>;
  /** Kirim setiap event topik ke handler. fromOffset: resume dari offset klien
   *  (reconnect tanpa event hilang). Tanpa fromOffset = hanya event baru.
   *  Return unsubscribe. */
  subscribe(
    topic: string,
    handler: (event: RealtimeEvent, offset: string) => void,
    fromOffset?: string,
  ): () => void;
}

let bus: RealtimeBus | null = null;

export function getBus(): RealtimeBus {
  if (!bus) bus = new RedisBus();
  return bus;
}

/** Fire-and-forget untuk API routes (ADR-002 #4): publish setelah mutasi sukses,
 *  error hanya di-log — tidak pernah menggagalkan response HTTP. */
export function publishBusEvent(topic: string, event: RealtimeEvent): void {
  getBus()
    .publish(topic, event)
    .catch((err: unknown) => console.error(`[realtime] publish ${topic} gagal:`, err));
}
