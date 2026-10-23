"use client";

/**
 * components/views/puzzle-hub.tsx (S3-T1..T4 frontend, S5-T3 update)
 * Hub Teka-Teki: tab Tantangan Harian / Gegas / Latihan Tema / Tanpa Batas
 * di atas solve mode. Sub-navigasi ringan — navTab game.tsx hanya "puzzles".
 * S5-T3: terima initialTab dari deep-link lama (#/daily|#/rush|#/themes).
 */

import { useEffect, useState } from "react";
import { PuzzleView } from "./puzzle-view";
import { DailyPuzzleView } from "./daily-puzzle-view";
import { RushView } from "./rush-view";
import { ThemesMasteryView } from "./themes-mastery-view";

type Props = { lang?: "id" | "en"; onBack?: () => void; initialTab?: PuzzleTab };
type PuzzleTab = "unlimited" | "daily" | "rush" | "themes";

const TABS: { id: PuzzleTab; labelId: string; labelEn: string }[] = [
  { id: "unlimited", labelId: "Teka-Teki", labelEn: "Puzzles" },
  { id: "daily", labelId: "Harian", labelEn: "Daily" },
  { id: "rush", labelId: "Gegas", labelEn: "Rush" },
  { id: "themes", labelId: "Latihan Tema", labelEn: "Theme Training" },
];

export function PuzzleHub({ lang = "id", onBack, initialTab = "unlimited" }: Props) {
  const [tab, setTab] = useState<PuzzleTab>(initialTab);

  // BUG-2 (QA S5): initialTab bisa berubah setelah mount (hashchange ke
  // #/daily|#/rush|#/themes saat PuzzleHub sudah terpasang, atau fresh load
  // di mana ref terisi belakangan). Re-sync tab setiap kali prop berubah.
  useEffect(() => {
    if (initialTab && initialTab !== "unlimited") setTab(initialTab);
  }, [initialTab]);

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex bg-[var(--card)] p-1 rounded-xl border border-[var(--border)] w-full max-w-xl mx-auto shadow-md shrink-0 mb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
              tab === t.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-neutral-400 hover:text-white"
            }`}
          >
            {lang === "id" ? t.labelId : t.labelEn}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {tab === "unlimited" && <PuzzleView lang={lang} onGoRush={() => setTab("rush")} />}
        {tab === "daily" && <DailyPuzzleView lang={lang} onGoPuzzles={() => setTab("unlimited")} />}
        {tab === "rush" && <RushView lang={lang} onBack={onBack} />}
        {tab === "themes" && <ThemesMasteryView lang={lang} onBack={onBack} />}
      </div>
    </div>
  );
}
