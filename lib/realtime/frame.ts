/** Frame protocol WS — shared server & klien (ADR-001 #3). */
export type FrameOp = "subscribe" | "ack" | "data" | "error";

export type Frame = {
  op: FrameOp;
  topic: string;
  /** Offset stream Redis `<ms>-<seq>`. `subscribe`: offset terakhir klien (reconnect resume). `data`/`ack`: offset event. */
  offset?: string;
  payload?: unknown;
};
