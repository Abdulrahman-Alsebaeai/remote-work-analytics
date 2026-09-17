import type { ReactNode, SVGProps } from "react";
type Name =
  | "clock"
  | "play"
  | "pause"
  | "stop"
  | "sync"
  | "wifi"
  | "offline"
  | "task"
  | "trend"
  | "bell"
  | "settings"
  | "sun"
  | "moon"
  | "globe"
  | "check"
  | "alert"
  | "logout"
  | "close"
  | "cloud"
  | "activity"
  | "user";
const paths: Record<Name, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7V5Z" />,
  pause: (
    <>
      <path d="M9 5v14M15 5v14" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  sync: (
    <>
      <path d="M20 7h-5V2M4 17h5v5" />
      <path d="M5.5 9a7 7 0 0 1 11.9-3L20 7M4 17l2.6 1a7 7 0 0 0 11.9-3" />
    </>
  ),
  wifi: (
    <>
      <path d="M5 12.5a11 11 0 0 1 14 0M2 9a16 16 0 0 1 20 0M8.5 16a6 6 0 0 1 7 0M12 20h.01" />
    </>
  ),
  offline: (
    <>
      <path d="m3 3 18 18M8.5 16a6 6 0 0 1 5.2-1.3M5 12.5a11 11 0 0 1 3-1.7M2 9a16 16 0 0 1 2.2-1.4M10.5 4.1A16 16 0 0 1 22 9M12 20h.01" />
    </>
  ),
  task: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  trend: (
    <>
      <path d="M3 3v18h18M7 15l4-4 3 3 5-7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M14 21h-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4l-.4 3a8 8 0 0 0-1.8 1L5.8 6 3.8 9.5 6 11a7 7 0 0 0 0 2l-2.2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.8 1l.4 3h4l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.5-2.1-1.5a7 7 0 0 0 .1-1Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  alert: (
    <>
      <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  cloud: (
    <path d="M17.5 19H7a5 5 0 1 1 1.7-9.7A7 7 0 0 1 22 12.5a4.5 4.5 0 0 1-4.5 6.5Z" />
  ),
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
};
export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: Name; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
