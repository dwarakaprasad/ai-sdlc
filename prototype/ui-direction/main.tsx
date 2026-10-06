// PROTOTYPE (throwaway): three visual directions × eight screens for "kid-friendly but not kiddish", grades 4–8.
// Switch with ?variant=A|B|C&screen=<id>&name=<0-2>&device=<fit|tablet|tablet-portrait|laptop|phone>, or the floating bar.
import "@fontsource-variable/nunito";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { VariantA } from "./A/VariantA";
import { VariantB } from "./B/VariantB";
import { VariantC } from "./C/VariantC";
import { SCREENS, type ScreenId, type VariantProps } from "./shared/hooks";
import "./shared/shared.css";
import { Switcher } from "./Switcher";

export const VARIANTS = {
  A: { label: "Playground (close to Duolingo)", names: ["Ollie", "Pip", "Juno"], Component: VariantA },
  B: { label: "Studio (close to Brilliant)", names: ["Atlas", "Nova", "Sage"], Component: VariantB },
  C: { label: "Bright (in between)", names: ["Orbit", "Pico", "Kit"], Component: VariantC },
} satisfies Record<string, { label: string; names: string[]; Component: (p: VariantProps) => React.ReactNode }>;
export type VariantKey = keyof typeof VARIANTS;

export type Params = { variant: VariantKey; screen: ScreenId; name: number; device: string; embed: boolean };

function read(): Params {
  const q = new URLSearchParams(location.search);
  const variant = (q.get("variant") ?? "A") as VariantKey;
  const screen = (q.get("screen") ?? "home") as ScreenId;
  return {
    variant: variant in VARIANTS ? variant : "A",
    screen: SCREENS.some(([id]) => id === screen) ? screen : "home",
    name: Number(q.get("name") ?? 0) % 3,
    device: q.get("device") ?? "fit",
    embed: q.has("embed"),
  };
}

export function urlFor(p: Params) {
  const q = new URLSearchParams({ variant: p.variant, screen: p.screen, name: String(p.name), device: p.device });
  if (p.embed) q.set("embed", "1");
  return `?${q}`;
}

function Prototype() {
  const [p, setP] = useState(read);
  useEffect(() => {
    const onPop = () => setP(read());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const set = (next: Partial<Params>) => {
    const merged = { ...p, ...next };
    history.replaceState(null, "", urlFor(merged));
    setP(merged);
    // Inside a device frame, keep the outer page's URL and bar in step with clicks in the screen.
    if (p.embed) parent.postMessage({ prototype: merged }, "*");
  };
  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.data?.prototype && set({ ...e.data.prototype, embed: false });
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  });

  const v = VARIANTS[p.variant];
  const tutorName = v.names[p.name]!;
  const screen = <v.Component key={`${p.variant}-${p.screen}`} screen={p.screen} tutorName={tutorName} go={(screen) => set({ screen })} />;

  if (p.embed) return screen;
  return (
    <>
      {p.device === "fit" ? screen : <DeviceFrame p={p} />}
      {import.meta.env.DEV && <Switcher p={p} set={set} variants={VARIANTS} />}
    </>
  );
}

const DEVICES: Record<string, [number, number]> = {
  tablet: [1024, 768],
  "tablet-portrait": [768, 1024],
  laptop: [1440, 900],
  phone: [390, 844],
};

function DeviceFrame({ p }: { p: Params }) {
  const [w, h] = DEVICES[p.device] ?? DEVICES.tablet!;
  const [vw, setVw] = useState([innerWidth, innerHeight]);
  useEffect(() => {
    const r = () => setVw([innerWidth, innerHeight]);
    addEventListener("resize", r);
    return () => removeEventListener("resize", r);
  }, []);
  const scale = Math.min(1, (vw[0]! - 48) / w, (vw[1]! - 120) / h);
  return (
    <div style={{ minHeight: "100vh", background: "#2a2d34", display: "grid", placeItems: "start center", paddingTop: 24 }}>
      <div style={{ width: w * scale, height: h * scale }}>
        <iframe
          title="device"
          src={urlFor({ ...p, embed: true })}
          style={{ width: w, height: h, border: 0, borderRadius: 18, background: "#fff", transform: `scale(${scale})`, transformOrigin: "0 0", boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}
        />
      </div>
      <div style={{ color: "#aab", font: "600 12px system-ui", marginTop: 8 }}>{p.device} · {w}×{h}{scale < 1 ? ` · shown at ${Math.round(scale * 100)}%` : ""}</div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Prototype />
  </StrictMode>,
);
