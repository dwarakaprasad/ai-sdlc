import type { ReactNode } from "react";

type IconProps = { size?: number };

/** A small line icon on a 24×24 grid, stroked in the text colour. Decorative: its meaning is always also in words. */
function Icon({ size = 20, children }: IconProps & { children: ReactNode }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const ArrowIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const LockIcon = (p: IconProps) => <Icon {...p}><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Icon>;
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
export const BackIcon = (p: IconProps) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const SendIcon = (p: IconProps) => <Icon {...p}><path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" /></Icon>;
export const SparkleIcon = (p: IconProps) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></Icon>;
export const StarIcon = (p: IconProps) => <Icon {...p}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></Icon>;
export const ParentIcon = (p: IconProps) => <Icon {...p}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="10" r="2.2" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M14.5 15c2.6-.4 4.9.9 5.5 3.6" /></Icon>;
export const SkipIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l7 6-7 6zM16.5 6v12" /></Icon>;
export const TrophyIcon = (p: IconProps) => <Icon {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4" /></Icon>;
