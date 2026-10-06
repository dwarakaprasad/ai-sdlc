// PROTOTYPE (throwaway): the Avatar set, the three Tutor character candidates, and confetti.
// Every drawing is flat geometry on a 64×64 grid so they read as one family.
import type { CSSProperties, ReactNode } from "react";
import type { AvatarId } from "../data";

const INK = "#1d2433";
const DIM = "rgba(29,36,51,.22)";

const glyphs: Record<AvatarId, (c: string) => ReactNode> = {
  fox: () => (
    <>
      <polygon points="15,13 27,25 13,30" fill="#fff" />
      <polygon points="49,13 37,25 51,30" fill="#fff" />
      <polygon points="13,26 51,26 32,51" fill="#fff" />
      <circle cx="25" cy="33" r="2.6" fill={INK} />
      <circle cx="39" cy="33" r="2.6" fill={INK} />
      <circle cx="32" cy="46" r="2.6" fill={INK} />
    </>
  ),
  owl: (c) => (
    <>
      <polygon points="18,22 21,11 28,18" fill="#fff" />
      <polygon points="46,22 43,11 36,18" fill="#fff" />
      <rect x="17" y="15" width="30" height="37" rx="15" fill="#fff" />
      <circle cx="26" cy="29" r="6" fill={c} />
      <circle cx="38" cy="29" r="6" fill={c} />
      <circle cx="26" cy="29" r="2.6" fill={INK} />
      <circle cx="38" cy="29" r="2.6" fill={INK} />
      <polygon points="29.5,36 34.5,36 32,40.5" fill={INK} />
    </>
  ),
  cat: () => (
    <>
      <polygon points="17,31 19,12 31,23" fill="#fff" />
      <polygon points="47,31 45,12 33,23" fill="#fff" />
      <circle cx="32" cy="36" r="16" fill="#fff" />
      <ellipse cx="25.5" cy="35" rx="2.2" ry="3.2" fill={INK} />
      <ellipse cx="38.5" cy="35" rx="2.2" ry="3.2" fill={INK} />
      <polygon points="30,41 34,41 32,43.5" fill={INK} />
    </>
  ),
  panda: () => (
    <>
      <circle cx="19" cy="21" r="6.5" fill={INK} />
      <circle cx="45" cy="21" r="6.5" fill={INK} />
      <circle cx="32" cy="35" r="17" fill="#fff" />
      <ellipse cx="24.5" cy="33" rx="4.5" ry="5.5" fill={INK} transform="rotate(-25 24.5 33)" />
      <ellipse cx="39.5" cy="33" rx="4.5" ry="5.5" fill={INK} transform="rotate(25 39.5 33)" />
      <circle cx="25" cy="32.5" r="1.6" fill="#fff" />
      <circle cx="39" cy="32.5" r="1.6" fill="#fff" />
      <ellipse cx="32" cy="42" rx="3" ry="2.2" fill={INK} />
    </>
  ),
  frog: () => (
    <>
      <circle cx="22" cy="25" r="7.5" fill="#fff" />
      <circle cx="42" cy="25" r="7.5" fill="#fff" />
      <ellipse cx="32" cy="39" rx="19" ry="12.5" fill="#fff" />
      <circle cx="22" cy="25" r="3.2" fill={INK} />
      <circle cx="42" cy="25" r="3.2" fill={INK} />
      <path d="M24 42 Q32 48 40 42" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </>
  ),
  whale: () => (
    <>
      <path d="M28 25 q0 -6 -5 -8 M28 25 q0 -6 5 -8" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M10 38 C10 29 18 26 28 26 C40 26 47 32 47 39 C47 45 41 48 34 48 L20 48 C14 48 10 44 10 38Z" fill="#fff" />
      <polygon points="45,38 56,29 55,46" fill="#fff" />
      <circle cx="21" cy="37" r="2.4" fill={INK} />
    </>
  ),
  penguin: () => (
    <>
      <ellipse cx="32" cy="35" rx="15" ry="18" fill={INK} stroke="#fff" strokeWidth="2.5" />
      <ellipse cx="32" cy="40" rx="9.5" ry="12" fill="#fff" />
      <circle cx="27.5" cy="27" r="2" fill="#fff" />
      <circle cx="36.5" cy="27" r="2" fill="#fff" />
      <polygon points="29,31 35,31 32,35.5" fill="#ffb020" />
    </>
  ),
  turtle: (c) => (
    <>
      <circle cx="51" cy="38" r="5.5" fill="#fff" />
      <rect x="17" y="40" width="7" height="9" rx="3" fill="#fff" />
      <rect x="38" y="40" width="7" height="9" rx="3" fill="#fff" />
      <path d="M12 42 A19 18 0 0 1 50 42 Z" fill="#fff" />
      <polygon points="31,27 37,30.5 37,37 31,40.5 25,37 25,30.5" fill={c} opacity=".55" />
      <circle cx="52.5" cy="37" r="1.4" fill={INK} />
    </>
  ),
  rocket: (c) => (
    <>
      <polygon points="27,47 37,47 32,57" fill="#ffb020" />
      <polygon points="24,33 15,46 24,45" fill="#fff" />
      <polygon points="40,33 49,46 40,45" fill="#fff" />
      <path d="M32 9 C41 17 43 31 40 46 L24 46 C21 31 23 17 32 9Z" fill="#fff" />
      <circle cx="32" cy="27" r="5" fill={c} />
      <circle cx="32" cy="27" r="5" fill="none" stroke={DIM} strokeWidth="2" />
    </>
  ),
  planet: (c) => (
    <>
      <circle cx="32" cy="32" r="14" fill="#fff" />
      <path d="M20 26 h10 M36 36 h9" stroke={c} strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="32" cy="33" rx="26" ry="7" fill="none" stroke="#fff" strokeWidth="3" transform="rotate(-18 32 33)" />
      <path d="M19 30 A14 14 0 0 0 45 30" fill="none" stroke="#fff" strokeWidth="0" />
    </>
  ),
  bolt: () => <polygon points="37,8 17,36 30,36 25,56 47,26 34,26 39,8" fill="#fff" strokeLinejoin="round" />,
  mountain: () => (
    <>
      <circle cx="47" cy="17" r="5.5" fill="#ffd23f" />
      <polygon points="31,50 44,29 58,50" fill="#fff" opacity=".7" />
      <polygon points="6,50 25,18 44,50" fill="#fff" />
      <polygon points="25,18 19.5,27 23,25.5 25,28 27.5,25.5 30.5,27" fill={DIM} />
    </>
  ),
  cactus: () => (
    <>
      <path d="M27 35 H20 V26 M37 31 H44 V21" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26.5" y="13" width="11" height="36" rx="5.5" fill="#fff" />
      <rect x="20" y="46" width="24" height="9" rx="3" fill={INK} opacity=".75" />
    </>
  ),
  guitar: () => (
    <>
      <path d="M38 27 L52 13" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="48" y="8" width="8" height="8" rx="2" fill="#fff" transform="rotate(45 52 12)" />
      <circle cx="35" cy="30" r="8.5" fill="#fff" />
      <circle cx="26" cy="40" r="12" fill="#fff" />
      <circle cx="29" cy="37" r="3.6" fill={INK} />
    </>
  ),
  controller: (c) => (
    <>
      <rect x="10" y="22" width="44" height="22" rx="11" fill="#fff" />
      <rect x="17" y="31.5" width="10" height="3.2" rx="1" fill={INK} />
      <rect x="20.4" y="28" width="3.2" height="10" rx="1" fill={INK} />
      <circle cx="42" cy="30" r="2.5" fill={c} />
      <circle cx="47" cy="35" r="2.5" fill={c} />
      <circle cx="42" cy="38" r="2.5" fill={INK} opacity=".5" />
    </>
  ),
  leaf: (c) => (
    <>
      <path d="M14 50 C14 27 29 14 51 14 C51 36 38 50 14 50Z" fill="#fff" />
      <path d="M17 47 L43 22 M28 37 v-7 M35 30 h7" stroke={c} strokeOpacity=".55" strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
};

export function Avatar({
  id, color, name, size = 56, shape = "circle", style,
}: { id: AvatarId | null; color: string; name: string; size?: number; shape?: "circle" | "squircle"; style?: CSSProperties }) {
  const rx = shape === "circle" ? 32 : 18;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={name} style={{ flex: "none", ...style }}>
      <rect width="64" height="64" rx={rx} fill={color} />
      {id ? glyphs[id](color) : (
        <text x="32" y="43" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="Nunito Variable, sans-serif">
          {name[0]}
        </text>
      )}
    </svg>
  );
}

export type Mood = "idle" | "happy" | "thinking" | "rest";

function Eyes({ cx1, cx2, cy, r, mood, fill, stroke }: { cx1: number; cx2: number; cy: number; r: number; mood: Mood; fill: string; stroke: string }) {
  if (mood === "happy")
    return (
      <path d={`M${cx1 - r} ${cy + 1} q${r} ${-r * 1.6} ${2 * r} 0 M${cx2 - r} ${cy + 1} q${r} ${-r * 1.6} ${2 * r} 0`}
        stroke={stroke} strokeWidth={r * 0.8} fill="none" strokeLinecap="round" />
    );
  if (mood === "rest")
    return <path d={`M${cx1 - r} ${cy} h${2 * r} M${cx2 - r} ${cy} h${2 * r}`} stroke={stroke} strokeWidth={r * 0.7} strokeLinecap="round" />;
  const dy = mood === "thinking" ? -r * 0.45 : 0;
  const dx = mood === "thinking" ? r * 0.35 : 0;
  return (
    <>
      <circle cx={cx1 + dx} cy={cy + dy} r={r} fill={fill} />
      <circle cx={cx2 + dx} cy={cy + dy} r={r} fill={fill} />
    </>
  );
}

/** Direction A: a round owl mark in the action green. */
export function OwlTutor({ size = 64, mood = "idle" }: { size?: number; mood?: Mood }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`tutor tutor-${mood}`}>
      <polygon points="12,20 14,6 25,14" fill="#46a302" />
      <polygon points="52,20 50,6 39,14" fill="#46a302" />
      <rect x="8" y="10" width="48" height="50" rx="23" fill="#58cc02" />
      <ellipse cx="32" cy="46" rx="15" ry="11" fill="#89e219" />
      <circle cx="22.5" cy="29" r="9.5" fill="#fff" />
      <circle cx="41.5" cy="29" r="9.5" fill="#fff" />
      <Eyes cx1={22.5} cx2={41.5} cy={29} r={4.6} mood={mood} fill={INK} stroke={INK} />
      <polygon points="28.5,37 35.5,37 32,42.5" fill="#ffc800" />
    </svg>
  );
}

/** Direction B: an ink-dark rounded mark with pill eyes and one yellow corner. */
export function OrbTutor({ size = 64, mood = "idle" }: { size?: number; mood?: Mood }) {
  const eye = mood === "happy" || mood === "rest" ? (
    <Eyes cx1={24} cx2={40} cy={32} r={4} mood={mood} fill="#fff" stroke="#fff" />
  ) : (
    <g transform={mood === "thinking" ? "translate(2 -3)" : undefined}>
      <rect x="21" y="25" width="6" height="13" rx="3" fill="#fff" />
      <rect x="37" y="25" width="6" height="13" rx="3" fill="#fff" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`tutor tutor-${mood}`}>
      <rect x="6" y="6" width="52" height="52" rx="20" fill="#16181d" />
      <path d="M44 6 h-2 a16 16 0 0 0 16 16 v-2 a14 14 0 0 0 -14 -14Z" fill="#ffd23f" />
      <circle cx="49" cy="15" r="5" fill="#ffd23f" />
      {eye}
    </svg>
  );
}

/** Direction C: a small rounded robot with a screen face. */
export function BotTutor({ size = 64, mood = "idle" }: { size?: number; mood?: Mood }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={`tutor tutor-${mood}`}>
      <path d="M32 14 V6" stroke="#4250e0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="4" fill="#ff6b5b" />
      <rect x="5" y="28" width="6" height="12" rx="3" fill="#4250e0" />
      <rect x="53" y="28" width="6" height="12" rx="3" fill="#4250e0" />
      <rect x="9" y="13" width="46" height="44" rx="17" fill="#5b6cff" />
      <rect x="15" y="21" width="34" height="25" rx="11" fill="#1b1f4a" />
      <Eyes cx1={25} cx2={39} cy={33} r={3.8} mood={mood} fill="#5ef0d0" stroke="#5ef0d0" />
      <circle cx="18" cy="50" r="2" fill="#ff9bb0" opacity=".9" />
      <circle cx="46" cy="50" r="2" fill="#ff9bb0" opacity=".9" />
    </svg>
  );
}

/** Falling confetti; a still sprinkle when motion is reduced (handled in shared.css). */
export function Confetti({ colors }: { colors: string[] }) {
  const pieces = Array.from({ length: 48 }, (_, i) => {
    const left = (i * 37) % 100;
    const delay = ((i * 13) % 20) / 10;
    const dur = 2.4 + ((i * 7) % 10) / 6;
    const rot = (i * 47) % 360;
    return (
      <i key={i} style={{
        left: `${left}%`, background: colors[i % colors.length], animationDelay: `${delay}s`, animationDuration: `${dur}s`,
        transform: `rotate(${rot}deg)`, top: `${(i * 29) % 60}%`, borderRadius: i % 3 === 0 ? "50%" : 2,
      }} />
    );
  });
  return <div className="confetti" aria-hidden>{pieces}</div>;
}
