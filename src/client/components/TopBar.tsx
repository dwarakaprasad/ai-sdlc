import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";

export type NavItem = { label: string; current: boolean; onSelect: () => void };

/** The bar across the top of a logged-in screen: the wordmark, the screens to move between, and whatever goes at the right. */
export function TopBar({ nav, end }: { nav: NavItem[]; end: ReactNode }) {
  return (
    <header className="top-bar">
      <Wordmark size={28} />
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
