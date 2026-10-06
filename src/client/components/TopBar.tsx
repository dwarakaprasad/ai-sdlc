import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export type NavItem = { label: string; current: boolean; onSelect: () => void };

/**
 * The bar across the top of a logged-in screen: the wordmark (with a `label` beside it, such as the Parent area's),
 * the screens to move between, and whatever goes at the right.
 */
export function TopBar({ nav, end, label }: { nav: NavItem[]; end: ReactNode; label?: ReactNode }) {
  return (
    <header className="top-bar">
      <span className="top-brand">
        <Wordmark size={28} />
        {label}
      </span>
      <nav className="top-nav">
        {nav.map((item) => (
          <button key={item.label} type="button" aria-current={item.current ? "page" : undefined} onClick={item.onSelect}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="top-end">{end}</div>
    </header>
  );
}
