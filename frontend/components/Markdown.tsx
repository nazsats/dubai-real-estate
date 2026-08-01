import { Fragment } from "react";

/**
 * Minimal Markdown renderer for assistant replies.
 *
 * Claude answers in Markdown, and rendering it as plain text leaves literal
 * `**asterisks**` all over the transcript. A full Markdown library is ~40KB for
 * a model that only ever emits bold, bullets, headings, and inline code — so
 * this handles exactly that subset.
 *
 * Everything is built as React elements, never `dangerouslySetInnerHTML`:
 * model output is untrusted text, and a listing description containing markup
 * must never become live DOM.
 */

/** Split on **bold** and `code`, preserving order. */
function renderInline(text: string, keyPrefix: string) {
  const parts: React.ReactNode[] = [];
  // One pass over both patterns so their order in the source is preserved.
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-slate-50">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.85em] text-brand"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="my-1.5 space-y-1 pl-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-brand/70" />
            <span className="min-w-0">{renderInline(b, `${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);

    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets(`ul-${idx}`);

    if (heading) {
      blocks.push(
        <p key={idx} className="mb-1 mt-3 text-[0.95em] font-semibold text-slate-100 first:mt-0">
          {renderInline(heading[2], `h-${idx}`)}
        </p>
      );
    } else if (line.trim() === "") {
      // Collapse runs of blank lines into one small gap rather than stacking
      // empty paragraphs — the model often double-spaces its sections.
      if (blocks[blocks.length - 1] !== null) blocks.push(null);
    } else {
      blocks.push(
        <p key={idx} className="leading-relaxed">
          {renderInline(line, `p-${idx}`)}
        </p>
      );
    }
  });
  flushBullets("ul-end");

  return (
    <div className="space-y-1">
      {blocks.map((b, i) =>
        b === null ? <div key={`sp-${i}`} className="h-2" /> : <Fragment key={i}>{b}</Fragment>
      )}
    </div>
  );
}
