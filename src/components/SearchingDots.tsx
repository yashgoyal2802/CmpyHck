/**
 * Bounded "at work" cue for loading states: grounded research can take up to
 * a minute, and unmoving text over that long reads as a frozen page. The
 * loop is scoped to wherever this mounts and unmounts the instant the
 * loading state clears — nothing keeps animating once the wait is over.
 */
export function SearchingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-searching"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
