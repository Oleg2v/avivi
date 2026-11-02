/** Hairline icon set drawn for the concept (1.5px strokes, 24px grid). */
const paths: Record<string, React.ReactNode> = {
  arrow: <path d="M4 12h15m-5.5-6L19.5 12 13.5 18" />,
  arrowDown: <path d="M12 4v15m-6-5.5L12 19.5 18 13.5" />,
  phone: <path d="M6.6 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6 6l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 4.6 5.7 2 2 0 0 1 6.6 3.5Z" />,
  chat: (
    <>
      <path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.4 18.6Z" />
      <path d="M9 10.2c.4 1.9 2 3.6 4 4.2l1-1 1.6.7-.4 1.2c-3.1.2-6.5-3-6.6-6.1l1.2-.4.7 1.6Z" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.4 5.3 3.4 8.5s-1 6.1-3.4 8.5c-2.4-2.4-3.4-5.3-3.4-8.5s1-6.1 3.4-8.5Z" />
    </>
  ),
  a11y: (
    <>
      <circle cx="12" cy="4.8" r="1.6" />
      <path d="M5 8.2l7 1.3 7-1.3M12 9.5v4.8m0 0-3 6m3-6 3 6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M3.5 8h17M3.5 16h17" />,
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </>
  ),
  send: <path d="M4 12h14m-5-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />,
  camera: (
    <>
      <path d="M4 8.5h3.2L9 6h6l1.8 2.5H20v10H4Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  upload: <path d="M12 16V5m-4.5 4.5L12 5l4.5 4.5M5 19.5h14" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  bag: <path d="M5.5 8.5h13l-1 11h-11Zm3.5 0V7a3 3 0 0 1 6 0v1.5" />,
  sparkle: <path d="M12 3.5v4m0 9v4M3.5 12h4m9 0h4M7 7l1.8 1.8M15.2 15.2 17 17M17 7l-1.8 1.8M8.8 15.2 7 17" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="1" />
      <path d="M4 9.5h16M8 3.5v4m8-4v4" />
    </>
  ),
  share: <path d="M12 4v11m-4.5-6.5L12 4l4.5 4.5M6 13.5V19.5h12v-6" />,
  rotate: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  external: <path d="M10 5.5H5.5v13h13V14m-6-8.5h6v6m0-6-8 8" />,
  play: <path d="M8 5.5v13l10-6.5Z" />,
};

export function Icon({ name, size = 20, className, title }: { name: keyof typeof paths | string; size?: number; className?: string; title?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {paths[name] ?? null}
    </svg>
  );
}
