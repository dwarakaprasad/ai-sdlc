import katex from "katex";
import "katex/dist/katex.min.css";

/** Maths between \( \) (inline) or \[ \] (display), as the Tutor is told to write it. Dollar signs are left alone, so prices stay text. */
const MATH = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

/** Tutor text with its maths rendered by KaTeX; an expression KaTeX can't parse shows as written. */
export function MathText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MATH)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const display = match[2] !== undefined;
    const html = katex.renderToString((match[1] ?? match[2])!, { displayMode: display, throwOnError: false });
    parts.push(<span key={match.index} dangerouslySetInnerHTML={{ __html: html }} />);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
