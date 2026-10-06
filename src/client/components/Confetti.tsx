/** The confetti colours: ink, the Tutor's yellow, the Streak's orange and the reward gold. */
const COLORS = ["var(--ink)", "var(--yellow)", "var(--orange)", "var(--gold)"];

/**
 * Light confetti falling over a celebration, made of a few dozen small pieces. Under reduced motion they don't fall:
 * they stay where they are, a still sprinkle. Decorative only.
 */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 29) % 60}%`,
            background: COLORS[i % COLORS.length],
            borderRadius: i % 3 === 0 ? "50%" : 2,
            rotate: `${(i * 47) % 360}deg`,
            animationDelay: `${((i * 13) % 20) / 10}s`,
            animationDuration: `${2.4 + ((i * 7) % 10) / 6}s`,
          }}
        />
      ))}
    </div>
  );
}
