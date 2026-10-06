// PROTOTYPE (throwaway): the floating bar. ←/→ direction, ↑/↓ screen, N Tutor name. Dev builds only.
import { useEffect } from "react";
import type { Params, VariantKey } from "./main";
import { SCREENS } from "./shared/hooks";

type Meta = Record<VariantKey, { label: string; names: string[] }>;

export function Switcher({ p, set, variants }: { p: Params; set: (n: Partial<Params>) => void; variants: Meta }) {
  const keys = Object.keys(variants) as VariantKey[];
  const vi = keys.indexOf(p.variant);
  const si = SCREENS.findIndex(([id]) => id === p.screen);
  const cycleV = (d: number) => set({ variant: keys[(vi + d + keys.length) % keys.length]! });
  const cycleS = (d: number) => set({ screen: SCREENS[(si + d + SCREENS.length) % SCREENS.length]![0] });
  const cycleN = () => set({ name: (p.name + 1) % 3 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") cycleV(-1);
      else if (e.key === "ArrowRight") cycleV(1);
      else if (e.key === "ArrowUp") (e.preventDefault(), cycleS(-1));
      else if (e.key === "ArrowDown") (e.preventDefault(), cycleS(1));
      else if (e.key === "n" || e.key === "N") cycleN();
      else return;
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const v = variants[p.variant];
  return (
    <div style={bar} role="toolbar" aria-label="Prototype switcher">
      <span style={tag}>PROTOTYPE</span>
      <button style={btn} onClick={() => cycleV(-1)} title="Previous direction (←)">‹</button>
      <span style={{ minWidth: 210, textAlign: "center" }}><b>{p.variant}</b> {v.label}</span>
      <button style={btn} onClick={() => cycleV(1)} title="Next direction (→)">›</button>
      <span style={sep} />
      <select style={sel} value={p.screen} onChange={(e) => set({ screen: e.target.value as Params["screen"] })} title="Screen (↑/↓)">
        {SCREENS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <span style={sep} />
      <button style={{ ...btn, width: "auto", padding: "0 10px" }} onClick={cycleN} title="Next Tutor name candidate (N)">
        Tutor: <b>{v.names[p.name]}</b> <span style={{ opacity: 0.6 }}>({p.name + 1}/3)</span>
      </button>
      <span style={sep} />
      <select style={sel} value={p.device} onChange={(e) => set({ device: e.target.value })} title="Viewport">
        <option value="fit">Fit window</option>
        <option value="tablet">Tablet 1024×768</option>
        <option value="tablet-portrait">Tablet portrait 768×1024</option>
        <option value="laptop">Laptop 1440×900</option>
        <option value="phone">Phone 390×844</option>
      </select>
    </div>
  );
}

const bar: React.CSSProperties = {
  position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999,
  background: "#111", color: "#f2f2f2", font: "500 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
  boxShadow: "0 8px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08)", whiteSpace: "nowrap", maxWidth: "calc(100vw - 16px)", overflowX: "auto",
};
const btn: React.CSSProperties = { width: 30, height: 30, borderRadius: 999, border: 0, background: "#2b2b2b", color: "#fff", font: "inherit", fontSize: 15 };
const sel: React.CSSProperties = { height: 30, borderRadius: 999, border: 0, background: "#2b2b2b", color: "#fff", font: "inherit", padding: "0 8px" };
const sep: React.CSSProperties = { width: 1, height: 20, background: "#333" };
const tag: React.CSSProperties = { background: "#ff3d71", color: "#fff", borderRadius: 999, padding: "4px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1 };
