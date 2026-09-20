// The Workflow Scout wordmark: the name in text, next to one shape drawn here in code.
// The circle is Scout's lens, with a gap in the ring so it reads as looking rather than as a full stop.
// Nothing here comes from an image file.

export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-7 w-7 shrink-0">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="43 8" transform="rotate(-55 12 12)" />
      </svg>
      <span className="text-2xl font-bold tracking-tight">Workflow Scout</span>
    </span>
  );
}
