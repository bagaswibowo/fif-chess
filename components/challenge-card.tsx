"use client";

/**
 * ChallengeCard (S1-T4): tantangan inline dual-button [Tolak | Terima] —
 * tanpa modal perantara. Desktop: kartu inline; mobile (≤ md): bottom-sheet
 * yang tidak menutup papan penuh. Semua durasi membaca --move-animation-duration.
 */

import { IconKingBlack3D, IconPawn3D } from "@/components/icons3d";

export type ChallengeState = "incoming" | "accepted" | "declined";

export type ChallengeInfo = {
  challengeId: string;
  fromUsername: string;
};

type Props = {
  challenge: ChallengeInfo | null;
  state: ChallengeState;
  /** Label control waktu, mis. "Cepat · 10 menit". */
  controlLabel: string;
  /** S6-T2 (§2.3): TC undangan masuk WAJIB terbaca sebelum terima.
   *  Opsional — ditampilkan hanya bila sumber (event/store) menyuplai;
   *  tanpa data = tidak ditampilkan (no-mock, tidak mengarang angka). */
  timeControl?: string;
  /** S6-T2: mode undangan — "Terbuka (rating)" bila rated, selain itu "Casual". */
  rated?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

function CardBody({ challenge, state, controlLabel, timeControl, rated, onAccept, onDecline, ariaHidden }: Props & { ariaHidden?: boolean }) {
  if (!challenge) return null;
  const settled = state !== "incoming";
  return (
    <div
      className="challenge-card"
      data-state={state}
      role={ariaHidden ? undefined : "status"}
      aria-live={ariaHidden ? undefined : "polite"}
      aria-hidden={ariaHidden || undefined}
    >
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="challenge-card-icons">
          <IconKingBlack3D size={30} />
          <IconPawn3D size={22} />
        </span>
      </div>
      <h3 className="challenge-card-title">{challenge.fromUsername} menantang Anda</h3>
      {/* S6-T2: baris TC + mode (riil dari payload; tanpa payload → tidak
          ditampilkan — copy "mengundangnya" hanya muncul bila data ada). */}
      {timeControl ? (
        <p className="challenge-card-control">
          {challenge.fromUsername} mengundangnya: {timeControl} · {rated ? "Terbuka (rating)" : "Casual"}
        </p>
      ) : (
        <p className="challenge-card-control">{controlLabel}</p>
      )}
      {state === "accepted" && (
        <p className="challenge-card-status">Mempersiapkan papan…</p>
      )}
      {state === "declined" && (
        <p className="challenge-card-status">Tantangan dibatalkan</p>
      )}
      <div className="challenge-card-actions">
        <button
          type="button"
          className="challenge-decline"
          onClick={onDecline}
          disabled={settled}
          tabIndex={ariaHidden ? -1 : undefined}
        >
          Tolak
        </button>
        <button
          type="button"
          className="ctl ctl-primary challenge-accept"
          onClick={onAccept}
          disabled={settled}
          tabIndex={ariaHidden ? -1 : undefined}
        >
          Terima
        </button>
      </div>
    </div>
  );
}

export function ChallengeLayer(props: Props) {
  if (!props.challenge) return null;
  return (
    <>
      {/* Desktop: kartu inline di area pairing (panel kanan). Instance yang
          bisa diumumkan screen reader HANYA satu (role=status + aria-live
          di sini); instance mobile aria-hidden supaya tidak dobel announce. */}
      <div className="hidden md:block" role="region" aria-label="Tantangan masuk">
        <CardBody {...props} />
      </div>
      {/* Mobile: bottom-sheet — konten di belakang tetap terjangkau. */}
      <div
        className="md:hidden challenge-layer-mobile"
        role="region"
        aria-label="Tantangan masuk"
      >
        <CardBody {...props} ariaHidden />
      </div>
    </>
  );
}
