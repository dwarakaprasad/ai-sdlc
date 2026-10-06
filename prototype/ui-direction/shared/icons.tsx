// PROTOTYPE (throwaway): small line icons, stroked with currentColor.
type P = { size?: number; strokeWidth?: number; className?: string };

function I({ size = 20, strokeWidth = 2.4, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export const Check = (p: P) => <I {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const Close = (p: P) => <I {...p}><path d="M6 6l12 12M18 6L6 18" /></I>;
export const Lock = (p: P) => <I {...p}><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></I>;
export const Star = (p: P) => <I {...p}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></I>;
export const Flame = (p: P) => <I {...p}><path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.8 3.2-5.6 3.6-9.5 2.6 1.4 4.2 3.6 4.4 5.6.8-.6 1.4-1.6 1.6-2.7 1.9 1.6 3.4 4 3.4 6.6 0 3.4-2.5 6-6.5 6z" /></I>;
export const Trophy = (p: P) => <I {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4" /></I>;
export const Parent = (p: P) => <I {...p}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="10" r="2.2" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M14.5 15c2.6-.4 4.9.9 5.5 3.6" /></I>;
export const Skip = (p: P) => <I {...p}><path d="M6 6l7 6-7 6zM16.5 6v12" /></I>;
export const Send = (p: P) => <I {...p}><path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" /></I>;
export const Arrow = (p: P) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>;
export const Back = (p: P) => <I {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></I>;
export const Home = (p: P) => <I {...p}><path d="M4 11l8-6.5 8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></I>;
export const PathIcon = (p: P) => <I {...p}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></I>;
export const User = (p: P) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></I>;
export const Book = (p: P) => <I {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></I>;
export const Clock = (p: P) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>;
export const Sparkle = (p: P) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></I>;
export const Coffee = (p: P) => <I {...p}><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5" /></I>;
export const Dots = (p: P) => <I {...p}><circle cx="5.5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18.5" cy="12" r="1" /></I>;
export const Settings = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></I>;
export const Calendar = (p: P) => <I {...p}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3v4M15.5 3v4" /></I>;
export const Flag = (p: P) => <I {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></I>;
export const Calc = (p: P) => <I {...p}><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" /></I>;
export const Globe = (p: P) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z" /></I>;
export const Flask = (p: P) => <I {...p}><path d="M9.5 3.5h5M10 3.5v6L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.5v-6M7.5 15h9" /></I>;

export const SUBJECT_ICON: Record<string, (p: P) => React.ReactNode> = { math: Calc, ela: Book, social: Globe, science: Flask };
