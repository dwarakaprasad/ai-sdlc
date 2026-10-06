import type { ReactNode } from "react";
import type { AvatarChoice, AvatarId } from "../../shared/api";

/*
 * The Avatar drawings: flat geometry on a 64×64 grid in the same style as Jarvis, white on the Learner's accent colour.
 * Parts take their colour from classes (components.css): w white, k ink, d a dim shadow, y the Tutor's yellow, o orange,
 * and a the accent colour itself (currentColor), so the drawings take every colour from the tokens.
 */
const DRAWINGS: Record<AvatarId, ReactNode> = {
  fox: (
    <>
      <polygon className="w" points="15,13 27,25 13,30" />
      <polygon className="w" points="49,13 37,25 51,30" />
      <polygon className="w" points="13,26 51,26 32,51" />
      <circle className="k" cx="25" cy="33" r="2.6" />
      <circle className="k" cx="39" cy="33" r="2.6" />
      <circle className="k" cx="32" cy="46" r="2.6" />
    </>
  ),
  owl: (
    <>
      <polygon className="w" points="18,22 21,11 28,18" />
      <polygon className="w" points="46,22 43,11 36,18" />
      <rect className="w" x="17" y="15" width="30" height="37" rx="15" />
      <circle className="a" cx="26" cy="29" r="6" />
      <circle className="a" cx="38" cy="29" r="6" />
      <circle className="k" cx="26" cy="29" r="2.6" />
      <circle className="k" cx="38" cy="29" r="2.6" />
      <polygon className="k" points="29.5,36 34.5,36 32,40.5" />
    </>
  ),
  cat: (
    <>
      <polygon className="w" points="17,31 19,12 31,23" />
      <polygon className="w" points="47,31 45,12 33,23" />
      <circle className="w" cx="32" cy="36" r="16" />
      <ellipse className="k" cx="25.5" cy="35" rx="2.2" ry="3.2" />
      <ellipse className="k" cx="38.5" cy="35" rx="2.2" ry="3.2" />
      <polygon className="k" points="30,41 34,41 32,43.5" />
    </>
  ),
  panda: (
    <>
      <circle className="k" cx="19" cy="21" r="6.5" />
      <circle className="k" cx="45" cy="21" r="6.5" />
      <circle className="w" cx="32" cy="35" r="17" />
      <ellipse className="k" cx="24.5" cy="33" rx="4.5" ry="5.5" transform="rotate(-25 24.5 33)" />
      <ellipse className="k" cx="39.5" cy="33" rx="4.5" ry="5.5" transform="rotate(25 39.5 33)" />
      <circle className="w" cx="25" cy="32.5" r="1.6" />
      <circle className="w" cx="39" cy="32.5" r="1.6" />
      <ellipse className="k" cx="32" cy="42" rx="3" ry="2.2" />
    </>
  ),
  frog: (
    <>
      <circle className="w" cx="22" cy="25" r="7.5" />
      <circle className="w" cx="42" cy="25" r="7.5" />
      <ellipse className="w" cx="32" cy="39" rx="19" ry="12.5" />
      <circle className="k" cx="22" cy="25" r="3.2" />
      <circle className="k" cx="42" cy="25" r="3.2" />
      <path className="k-line" d="M24 42 Q32 48 40 42" strokeWidth="2.6" />
    </>
  ),
  whale: (
    <>
      <path className="w-line" d="M28 25 q0 -6 -5 -8 M28 25 q0 -6 5 -8" strokeWidth="2.6" />
      <path className="w" d="M10 38 C10 29 18 26 28 26 C40 26 47 32 47 39 C47 45 41 48 34 48 L20 48 C14 48 10 44 10 38Z" />
      <polygon className="w" points="45,38 56,29 55,46" />
      <circle className="k" cx="21" cy="37" r="2.4" />
    </>
  ),
  penguin: (
    <>
      <ellipse className="k w-edge" cx="32" cy="35" rx="15" ry="18" strokeWidth="2.5" />
      <ellipse className="w" cx="32" cy="40" rx="9.5" ry="12" />
      <circle className="w" cx="27.5" cy="27" r="2" />
      <circle className="w" cx="36.5" cy="27" r="2" />
      <polygon className="o" points="29,31 35,31 32,35.5" />
    </>
  ),
  turtle: (
    <>
      <circle className="w" cx="51" cy="38" r="5.5" />
      <rect className="w" x="17" y="40" width="7" height="9" rx="3" />
      <rect className="w" x="38" y="40" width="7" height="9" rx="3" />
      <path className="w" d="M12 42 A19 18 0 0 1 50 42 Z" />
      <polygon className="a" points="31,27 37,30.5 37,37 31,40.5 25,37 25,30.5" opacity=".55" />
      <circle className="k" cx="52.5" cy="37" r="1.4" />
    </>
  ),
  rocket: (
    <>
      <polygon className="o" points="27,47 37,47 32,57" />
      <polygon className="w" points="24,33 15,46 24,45" />
      <polygon className="w" points="40,33 49,46 40,45" />
      <path className="w" d="M32 9 C41 17 43 31 40 46 L24 46 C21 31 23 17 32 9Z" />
      <circle className="a" cx="32" cy="27" r="5" />
      <circle className="d-line" cx="32" cy="27" r="5" strokeWidth="2" />
    </>
  ),
  planet: (
    <>
      <circle className="w" cx="32" cy="32" r="14" />
      <path className="a-line" d="M20 26 h10 M36 36 h9" strokeOpacity=".45" strokeWidth="3" />
      <ellipse className="w-line" cx="32" cy="33" rx="26" ry="7" strokeWidth="3" transform="rotate(-18 32 33)" />
    </>
  ),
  bolt: <polygon className="w" points="37,8 17,36 30,36 25,56 47,26 34,26 39,8" />,
  mountain: (
    <>
      <circle className="y" cx="47" cy="17" r="5.5" />
      <polygon className="w" points="31,50 44,29 58,50" opacity=".7" />
      <polygon className="w" points="6,50 25,18 44,50" />
      <polygon className="d" points="25,18 19.5,27 23,25.5 25,28 27.5,25.5 30.5,27" />
    </>
  ),
  cactus: (
    <>
      <path className="w-line" d="M27 35 H20 V26 M37 31 H44 V21" strokeWidth="7" />
      <rect className="w" x="26.5" y="13" width="11" height="36" rx="5.5" />
      <rect className="k" x="20" y="46" width="24" height="9" rx="3" opacity=".75" />
    </>
  ),
  guitar: (
    <>
      <path className="w-line" d="M38 27 L52 13" strokeWidth="5" />
      <rect className="w" x="48" y="8" width="8" height="8" rx="2" transform="rotate(45 52 12)" />
      <circle className="w" cx="35" cy="30" r="8.5" />
      <circle className="w" cx="26" cy="40" r="12" />
      <circle className="k" cx="29" cy="37" r="3.6" />
    </>
  ),
  controller: (
    <>
      <rect className="w" x="10" y="22" width="44" height="22" rx="11" />
      <rect className="k" x="17" y="31.5" width="10" height="3.2" rx="1" />
      <rect className="k" x="20.4" y="28" width="3.2" height="10" rx="1" />
      <circle className="a" cx="42" cy="30" r="2.5" />
      <circle className="a" cx="47" cy="35" r="2.5" />
      <circle className="k" cx="42" cy="38" r="2.5" opacity=".5" />
    </>
  ),
  leaf: (
    <>
      <path className="w" d="M14 50 C14 27 29 14 51 14 C51 36 38 50 14 50Z" />
      <path className="a-line" d="M17 47 L43 22 M28 37 v-7 M35 30 h7" strokeOpacity=".55" strokeWidth="2.6" />
    </>
  ),
};

/**
 * A Learner's Avatar: their picture on their accent colour, or until their first pick, their initial on it.
 * `muted` draws the picture on ink instead, for the choices not yet picked. Decorative: the name is always beside it.
 */
export function Avatar({ avatar, color, name, size = 64, muted = false }: AvatarChoice & { name: string; size?: number; muted?: boolean }) {
  return (
    <svg className={`avatar accent-${color}${muted ? " avatar-muted" : ""}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect className="avatar-tile" width="64" height="64" rx="18" />
      {avatar ? (
        DRAWINGS[avatar]
      ) : (
        <text className="avatar-initial" x="32" y="43" textAnchor="middle">
          {name.trim().charAt(0).toUpperCase()}
        </text>
      )}
    </svg>
  );
}
