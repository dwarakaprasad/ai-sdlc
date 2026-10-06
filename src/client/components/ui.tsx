import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The Studio's shared building blocks (#24). Screens compose these and the tokens, adding only layout and one-off controls of their own.
 * Every control is at least 44px either way, for fingers on a tablet.
 */

type ButtonKind = "ink" | "outline" | "quiet";

/** Ink is the one main action on a screen (a solid bottom edge that presses down), outline a secondary one, quiet a text link. */
export function Button({ kind = "ink", type = "button", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }) {
  return <button type={type} className={["btn", `btn-${kind}`, className].filter(Boolean).join(" ")} {...props} />;
}

/** A white card on the paper canvas: an article, so a screen reader can move between cards. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <article className={className ? `card ${className}` : "card"}>{children}</article>;
}

/** A labelled form control (an input, select or textarea, passed as `children`), with an optional hint below it. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** A short label beside a title. `warm` is the gentle "catch up" colour. */
export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "warm"; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

/** A thin progress bar: `value` of `total`. */
export function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <span className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <span style={{ width: `${total === 0 ? 0 : (value / total) * 100}%` }} />
    </span>
  );
}

/** A few choices side by side, exactly one of them on: a filter, say. Each is a toggle button, pressed while it's on. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
