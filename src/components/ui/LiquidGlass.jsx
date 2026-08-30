export default function LiquidGlass({
  children,
  className,
  role,
  disable,
  onClick,
}) {
  return (
    <div
      role={role}
      aria-disabled={disable}
      onClick={onClick}
      className={`relative overflow-hidden
      ${className}`}
      style={{
        backdropFilter: "blur(12px) saturate(180%)",
        WebkitBackdropFilter: "blur(12px) saturate(180%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-linear-to-b from-white/30 via-white/6 to-transparent
        dark:from-white/10 dark:via-white/3 dark:to-transparent"
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.035] mix-blend-overlay
        dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-[#E4E2E5] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]
        dark:ring-[#202022] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
      />

      {children}
    </div>
  );
}
