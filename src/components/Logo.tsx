export function Logo({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Metro Assist logo">
      <circle cx="32" cy="32" r="30" fill="#0b2447" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#ffc72c" strokeWidth="2.5" />
      <path
        d="M18 44V23.5c0-1.4 1.7-2.1 2.7-1.1L32 33.8l11.3-11.4c1-1 2.7-.3 2.7 1.1V44"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="48" r="2.4" fill="#ffc72c" />
      <circle cx="32" cy="48" r="2.4" fill="#ffc72c" />
      <circle cx="46" cy="48" r="2.4" fill="#ffc72c" />
    </svg>
  );
}

export function BrandMark({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Logo className={compact ? "h-9 w-9" : "h-11 w-11"} />
      <div className="leading-tight">
        <div
          className={`font-extrabold tracking-tight ${compact ? "text-lg" : "text-xl"} ${
            light ? "text-white" : "text-metro-navy"
          }`}
        >
          METRO <span className="text-metro-yellow">ASSIST</span>
        </div>
        {!compact && (
          <div className={`text-[11px] font-medium ${light ? "text-white/70" : "text-slate-500"}`}>
            Divyangjan Assistance &amp; Station Coordination
          </div>
        )}
      </div>
    </div>
  );
}
