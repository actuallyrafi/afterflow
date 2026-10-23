import type { SVGProps } from "react";

const paths = {
  back: <path d="M15 5l-7 7 7 7" />,
  chev: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18" cy="12" r="1.2" />
    </>
  ),
  bellOff: (
    <>
      <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 004 0" />
      <path d="M3 3l18 18" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 004 0" />
    </>
  ),
  minus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12h8" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  chat: <path d="M4.5 19.5l1.2-3.6A8 8 0 1112 20a8 8 0 01-3.9-1z" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="3" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.8 19.5c.8-3.3 3.3-5 6.2-5s5.4 1.7 6.2 5" />
      <path d="M16 5.2a3.4 3.4 0 010 6.6M18 14.8c1.7.6 2.8 2.1 3.2 4.7" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
  share: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M7 11H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </>
  ),
  camera: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r=".6" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <path d="M14 14h2v2M20 14v6h-6v-2M17 17h0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  calendarPlus: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
    </>
  ),
  star: <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />,
  chevDown: <path d="M6 9.5l6 6 6-6" />,
  card: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="4" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M14.5 10h3M14.5 13.5h3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  folder: <path d="M3.5 7.5a2.5 2.5 0 012.5-2.5h3.6l2 2.2H18a2.5 2.5 0 012.5 2.5v7.8A2.5 2.5 0 0118 20H6a2.5 2.5 0 01-2.5-2.5z" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`i ${rest.className ?? ""}`}
      style={size ? { width: size, height: size, ...rest.style } : rest.style}
    >
      {paths[name]}
    </svg>
  );
}
