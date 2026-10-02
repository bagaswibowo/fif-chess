import React from "react";

export function FormattedPostContent({ text }: { text: string }) {
  const parts = text.split("\n\n");

  return (
    <div className="stack-tight text-sm leading-relaxed text-neutral-200">
      {parts.map((paragraph, pIdx) => {
        const trimmed = paragraph.trim();

        if (trimmed.startsWith(">")) {
          const quoteLines = trimmed
            .split("\n")
            .map((l) => l.replace(/^>\s?/, ""))
            .join("\n");
          return (
            <blockquote
              key={pIdx}
              className="pl-3 py-1.5 my-1 rounded-r-lg border-l-2 border-[var(--primary)] bg-[var(--surface)] text-sm italic text-neutral-300"
            >
              {quoteLines}
            </blockquote>
          );
        }

        if (trimmed.startsWith("```")) {
          const codeContent = trimmed.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={pIdx}
              className="p-2.5 my-1 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-sm text-emerald-300 overflow-x-auto select-all"
            >
              {codeContent}
            </pre>
          );
        }

        if (trimmed.startsWith("## ")) {
          return (
            <h4 key={pIdx} className="font-bold text-sm text-[var(--primary)] mt-1 mb-0.5">
              {trimmed.replace(/^##\s+/, "")}
            </h4>
          );
        }

        if (trimmed.startsWith("- ")) {
          const items = trimmed.split("\n").map((l) => l.replace(/^-\s+/, ""));
          return (
            <ul key={pIdx} className="list-disc list-inside space-y-0.5 my-1 pl-1 text-sm">
              {items.map((it, i) => (
                <li key={i} className="text-neutral-300">
                  {it}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={pIdx} className="m-0 leading-relaxed text-sm">
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}
