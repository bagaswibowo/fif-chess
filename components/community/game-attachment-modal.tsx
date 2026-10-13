import React, { useState, useMemo, useEffect } from "react";
import type { GameRecord } from "@/lib/game-history";
import { IconHistory3D, IconClose3D, IconCheck3D } from "@/components/icons3d";

export function GameAttachmentModal({
  isOpen,
  onClose,
  games,
  selectedGames,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  games: GameRecord[];
  selectedGames: GameRecord[];
  onConfirm: (selected: GameRecord[]) => void;
}) {
  const [currentSelectedIds, setCurrentSelectedIds] = useState<Set<string>>(
    new Set(selectedGames.map((g) => g.id))
  );

  useEffect(() => {
    setCurrentSelectedIds(new Set(selectedGames.map((g) => g.id)));
  }, [isOpen, selectedGames]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setCurrentSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (currentSelectedIds.size === games.length) {
      setCurrentSelectedIds(new Set());
    } else {
      setCurrentSelectedIds(new Set(games.map((g) => g.id)));
    }
  };

  const handleApply = () => {
    const chosen = games.filter((g) => currentSelectedIds.has(g.id));
    onConfirm(chosen);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm">
      <div className="panel p-5 stack max-w-2xl w-full max-h-[85vh] rounded-2xl border border-[var(--primary)] shadow-2xl" style={{ background: "var(--card)" }}>
        <div className="row-between pb-2.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <IconHistory3D size={18} />
            <div>
              <h3 className="text-sm font-bold text-white m-0">Lampirkan Permainan Catur</h3>
              <p className="text-sm text-[var(--muted-foreground)] m-0">
                Pilih satu atau lebih permainan dari riwayat permainan Anda untuk dilampirkan ke dalam diskusi
              </p>
            </div>
          </div>
          <button className="ctl ctl-sm ctl-quiet" onClick={onClose}>
            <IconClose3D size={14} />
          </button>
        </div>

        {/* TABEL PERMAINAN */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] rounded-xl border border-[var(--border)] bg-[var(--surface)] my-2">
          {games.length === 0 ? (
            <div className="text-center py-10 text-sm text-neutral-400">
              Belum ada riwayat permainan yang tersimpan di browser ini.
            </div>
          ) : (
            <table className="w-full text-sm font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card)] text-neutral-400 text-sm font-bold">
                  <th className="py-2.5 px-3 text-center w-12">
                    <input
                      type="checkbox"
                      checked={games.length > 0 && currentSelectedIds.size === games.length}
                      onChange={selectAll}
                      className="cursor-pointer"
                      title="Pilih Semua"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-left font-sans">Waktu</th>
                  <th className="py-2.5 px-3 text-left font-sans">Lawan</th>
                  <th className="py-2.5 px-3 text-center font-sans">Sisi</th>
                  <th className="py-2.5 px-3 text-center font-sans">Hasil</th>
                  <th className="py-2.5 px-3 text-center font-sans">Langkah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/60">
                {games.map((g) => {
                  const isChecked = currentSelectedIds.has(g.id);
                  const dateStr = new Date(g.playedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <tr
                      key={g.id}
                      onClick={() => toggleSelect(g.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? "bg-[var(--primary)]/15 font-bold" : "hover:bg-neutral-800/40"
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(g.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 text-neutral-300 font-sans">{dateStr}</td>
                      <td className="py-2 px-3 text-white font-bold font-sans">vs {g.opponent}</td>
                      <td className="py-2 px-3 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded text-sm ${g.humanSide === "white" ? "bg-white text-black font-bold" : "bg-neutral-800 text-white border border-neutral-600"}`}>
                          {g.humanSide === "white" ? "Putih" : "Hitam"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        <span className={`text-sm font-bold ${g.outcomeKind === "checkmate" ? "text-emerald-400" : g.outcomeKind === "draw" ? "text-amber-300" : "text-neutral-300"}`}>
                          {g.outcomeKind === "checkmate" ? "Skakmat" : g.outcomeKind === "draw" ? "Remis" : g.outcomeKind}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-neutral-400">{g.moves?.length || 0} Ply</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="row-between items-center pt-2 border-t border-[var(--border)]">
          <div className="text-sm text-[var(--muted-foreground)]">
            <span className="font-bold text-white">{currentSelectedIds.size}</span> permainan dipilih
          </div>
          <div className="flex gap-2">
            <button type="button" className="ctl ctl-sm ctl-quiet" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="ctl ctl-sm ctl-primary font-bold px-3"
              onClick={handleApply}
              disabled={games.length === 0}
            >
              Lampirkan ({currentSelectedIds.size} Permainan)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}