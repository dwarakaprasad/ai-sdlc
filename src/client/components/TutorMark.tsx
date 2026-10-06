export type TutorMood = "idle" | "thinking" | "happy" | "resting";

/**
 * The Tutor's mark, Jarvis in the UI text: a dark rounded square with a yellow corner, and eyes that show its mood.
 * Pill eyes that blink when idle and glance up while thinking, arcs when happy, closed lines when resting.
 * Decorative: whatever it reacts to is also said in words.
 */
export function TutorMark({ size = 64, mood = "idle" }: { size?: number; mood?: TutorMood }) {
  return (
    <svg className={`tutor-mark tutor-${mood}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x="6" y="6" width="52" height="52" rx="20" className="tutor-face" />
      <path d="M44 6 h-2 a16 16 0 0 0 16 16 v-2 a14 14 0 0 0 -14 -14Z" className="tutor-corner" />
      <circle cx="49" cy="15" r="5" className="tutor-corner" />
      {mood === "happy" && <path d="M20 33 q4 -6.4 8 0 M36 33 q4 -6.4 8 0" className="tutor-line" strokeWidth="3.2" />}
      {mood === "resting" && <path d="M20 32 h8 M36 32 h8" className="tutor-line" strokeWidth="2.8" />}
      {(mood === "idle" || mood === "thinking") && (
        <g className="tutor-eyes">
          <rect x="21" y="25" width="6" height="13" rx="3" />
          <rect x="37" y="25" width="6" height="13" rx="3" />
        </g>
      )}
    </svg>
  );
}
