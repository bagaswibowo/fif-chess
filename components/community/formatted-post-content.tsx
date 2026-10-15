import React from "react";

export function FormattedPostContent({ text }: { text: string }) {
  const parts = text.split("\n\n");

  return (
    <div className="stack-tight text-sm leading-relaxed text-neutral-200">
      {parts.map((paragraph, pIdx) => {
        const trimmed = paragraph.trim();

        // Quote block yang berisi tabel markdown: parse tabel di dalam quote juga
        if (trimmed.startsWith(">") && trimmed.includes("|")) {
          const inner = trimmed.split("\n").map((l) => l.replace(/^>\s?/, "")).join("\n");
          const qLines = inner.split("\n");
          const qRows = qLines.filter((l) => l.trim().startsWith("|"));
          const qIsSep = (l: string) => /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(l) && l.includes("-");
          const qParse = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          if (qRows.length >= 2) {
            const qHeader = qIsSep(qRows[1]) ? qParse(qRows[0]) : null;
            const qBody = (qHeader ? qRows.slice(2) : qRows).filter((l) => !qIsSep(l));
            if (qHeader || qBody.length > 0) {
              return (
                <blockquote key={pIdx} className="pl-3 py-1.5 my-1 rounded-r-lg border-l-2 border-[var(--primary)] bg-[var(--surface)] text-sm italic text-neutral-300">
                  <div className="table-wrap my-1 rounded-xl border border-[var(--border)]">
                    <table className="data-table">
                      {qHeader && (
                        <thead><tr>{qHeader.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      )}
                      <tbody>
                        {qBody.map((r, i) => (
                          <tr key={i}>
                            {qParse(r).map((c, j) => <td key={j} className={/^[-+]?[\d.,]+%?$/.test(c) ? "num" : ""}>{c}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </blockquote>
              );
            }
          }
        }

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

        // Markdown table: | a | b | baris + |---|---| separator
if (trimmed.includes("|") && trimmed.includes("\n")) {
  const lines = trimmed.split("\n");
  let tableLines: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("|")) tableLines.push(line);
    else if (tableLines.length > 0) break;
  }
  const rows = tableLines.length >= 2 ? tableLines : lines.filter((l) => l.trim().startsWith("|"));
          const isSep = (l: string) => /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(l) && l.includes("-");
          const parse = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          const header = rows.length > 1 && isSep(rows[1]) ? parse(rows[0]) : null;
          const bodyRows = (header ? rows.slice(2) : rows).filter((l) => !isSep(l));
          if (header || bodyRows.length > 0) {
            return (
              <div key={pIdx} className="table-wrap my-1 rounded-xl border border-[var(--border)]">
                <table className="data-table">
                  {header && (
                    <thead>
                      <tr>{header.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                  )}
                  <tbody>
                    {bodyRows.map((r, i) => (
                      <tr key={i}>
                        {parse(r).map((c, j) => <td key={j} className={/^[-+]?[\d.,]+%?$/.test(c) ? "num" : ""}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
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
