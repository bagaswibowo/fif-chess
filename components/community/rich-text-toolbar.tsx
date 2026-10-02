import React, { useMemo } from "react";
import { IconPencil3D, IconHistory3D } from "@/components/icons3d";

export function RichTextToolbar({
  textareaRef,
  value,
  onChange,
  onAttachGame,
  attachedGamesCount = 0,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
  onAttachGame?: () => void;
  attachedGamesCount?: number;
}) {
  const insertFormat = (before: string, after: string = "", placeholder: string = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(nextValue);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 10);
  };

  const wordCount = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [value]);

  return (
    <div
      className="p-1.5 rounded-t-xl border-b border-[var(--border)] text-sm flex flex-col gap-1.5"
      style={{ background: "var(--surface)" }}
    >
      {/* Top Toolbar Row */}
      <div className="flex items-center flex-wrap gap-1">
        {/* Style & Font Dropdowns */}
        <select
          onChange={(e) => {
            const v = e.target.value;
            if (v === "h1") insertFormat("# ", "\n", "Judul Utama");
            if (v === "h2") insertFormat("## ", "\n", "Sub Judul");
            if (v === "h3") insertFormat("### ", "\n", "Topik Pembahasan");
            e.target.value = "auto";
          }}
          className="bg-[var(--card)] border border-[var(--border)] text-sm text-white rounded px-2 py-1 focus:outline-none"
        >
          <option value="auto">Gaya: Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <div className="w-[1px] h-3.5 bg-[var(--border)] mx-0.5" />

        {/* Basic Formatting */}
        <button
          type="button"
          onClick={() => insertFormat("**", "**", "teks tebal")}
          className="px-2 py-1 rounded font-black text-white hover:bg-[var(--card)] transition-all text-sm"
          title="Tebal (Bold)"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => insertFormat("*", "*", "teks miring")}
          className="px-2 py-1 rounded italic font-serif text-white hover:bg-[var(--card)] transition-all text-sm"
          title="Miring (Italic)"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => insertFormat("~~", "~~", "teks coret")}
          className="px-2 py-1 rounded line-through text-neutral-300 hover:bg-[var(--card)] transition-all text-sm"
          title="Coret (Strikethrough)"
        >
          S
        </button>
        <button
          type="button"
          onClick={() => insertFormat("<u>", "</u>", "garis bawah")}
          className="px-2 py-1 rounded underline text-neutral-300 hover:bg-[var(--card)] transition-all text-sm"
          title="Garis Bawah (Underline)"
        >
          U
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--border)] mx-0.5" />

        {/* Lists & Alignment */}
        <button
          type="button"
          onClick={() => insertFormat("- ", "\n", "Poin diskusi")}
          className="px-2 py-1 rounded text-neutral-300 hover:bg-[var(--card)] transition-all text-sm"
          title="Daftar Poin (Bullet List)"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => insertFormat("1. ", "\n", "Langkah terurut")}
          className="px-2 py-1 rounded text-neutral-300 hover:bg-[var(--card)] transition-all text-sm"
          title="Daftar Nomor"
        >
          1. List
        </button>

        <div className="w-[1px] h-3.5 bg-[var(--border)] mx-0.5" />

        {/* Media, Quotes & PGN Code */}
        <button
          type="button"
          onClick={() => insertFormat("> ", "\n", "Kutipan diskusi")}
          className="px-2 py-1 rounded text-neutral-300 hover:bg-[var(--card)] transition-all font-mono text-sm"
          title="Kutipan (Quote)"
        >
          ” Quote
        </button>
        <button
          type="button"
          onClick={() => insertFormat("```pgn\n", "\n```", "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7")}
          className="px-2 py-1 rounded text-neutral-300 hover:bg-[var(--card)] transition-all font-mono text-sm"
          title="Blok Notasi PGN / Kode"
        >
          {"{ }"} PGN
        </button>
        <button
          type="button"
          onClick={() => insertFormat("| Kolom 1 | Kolom 2 |\n|---|---|\n| Data 1 | Data 2 |\n", "", "")}
          className="px-2 py-1 rounded text-neutral-300 hover:bg-[var(--card)] transition-all text-sm"
          title="Tabel (Table)"
        >
          ⊞ Tabel
        </button>

        {/* Import Game Attachment Trigger Button */}
        {onAttachGame && (
          <button
            type="button"
            onClick={onAttachGame}
            className={`ml-auto px-2 py-0.5 rounded font-bold text-sm flex items-center gap-1 transition-all ${
              attachedGamesCount > 0
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "bg-[var(--card)] text-white border border-[var(--border)] hover:border-[var(--primary)]"
            }`}
            title="Lampirkan Permainan Catur dari Riwayat Permainan"
          >
            <IconHistory3D size={13} />
            <span>{attachedGamesCount > 0 ? `${attachedGamesCount} Permainan Terlampir` : "+ Lampirkan Permainan"}</span>
          </button>
        )}
      </div>

      {/* Words Counter Badge */}
      <div className="row-between text-sm text-[var(--muted-foreground)] px-1">
        <span>Gunakan toolbar di atas untuk memformat artikel catur &amp; notasi</span>
        <span className="font-mono font-bold">Words: {wordCount}</span>
      </div>
    </div>
  );
}