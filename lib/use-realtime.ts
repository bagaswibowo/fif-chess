"use client";

/**
 * Hook realtime klien (S1-T4): WebSocket ke /ws, subscribe topik, auto-resume
 * pakai offset terakhir, reconnect dengan exponential backoff.
 * Konsumsi event tetap milik pemanggil — hook hanya meneruskan payload Frame.
 */

import { useEffect, useRef } from "react";
import type { Frame } from "@/lib/realtime/frame";
import type { RealtimeEvent } from "@/lib/realtime/events";

type Options = {
  /** Daftar topic yang mau di-subscribe (mis. matcherTopic(userId)). */
  topics: string[];
  /** Hook diam kalau false / topics kosong (mis. user belum login). */
  enabled?: boolean;
  onEvent: (event: RealtimeEvent, topic: string) => void;
};

const MAX_BACKOFF_MS = 15000;

export function useRealtime({ topics, enabled = true, onEvent }: Options) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const topicsKey = topics.join("|");
  const offsetsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const topicList = topicsKey ? topicsKey.split("|").filter(Boolean) : [];
    if (topicList.length === 0) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);

      ws.onopen = () => {
        attempt = 0;
        for (const topic of topicList) {
          // Resume dari offset terakhir yang pernah diterima klien.
          const frame: Frame = { op: "subscribe", topic, offset: offsetsRef.current.get(topic) };
          ws?.send(JSON.stringify(frame));
        }
      };

      ws.onmessage = (e: MessageEvent) => {
        let frame: Frame;
        try {
          frame = JSON.parse(String(e.data)) as Frame;
        } catch {
          return;
        }
        if ((frame.op === "data" || frame.op === "ack") && frame.offset) {
          offsetsRef.current.set(frame.topic, frame.offset);
        }
        if (frame.op === "data" && frame.payload) {
          onEventRef.current(frame.payload as RealtimeEvent, frame.topic);
        }
      };

      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
        attempt += 1;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [topicsKey, enabled]);
}
