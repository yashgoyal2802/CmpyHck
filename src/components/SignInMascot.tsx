"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Decorative avatar that sits above the sign-in card. Purely cosmetic, so
 * it's aria-hidden - none of its state changes are conveyed to assistive
 * tech, only to sighted users watching the form.
 *
 * Built from two 3x3 sprite sheets (`public/mascot/yash-*.webp`): a
 * `directions` sheet of nine head angles for idle cursor-tracking, and a
 * `reactions` sheet of nine expressions for the focus/submit/hover states
 * below - including a literal hands-over-eyes pose (the sheet's center
 * cell) for the password/API-key fields. The source files
 * (`yash_*_sprite_sheet.webp`) had a baked-in checkerboard "transparency
 * preview" pattern instead of a real alpha channel; `scripts/dechecker.py`
 * flood-fills that out to actual transparency - see that script before
 * replacing these sprites with a fresh export.
 *
 * Both sheets render as stacked, absolutely-positioned layers with only one
 * visible at a time, so swapping state never needs to change which image is
 * loaded - just which layer's opacity is 1 and which cell its
 * background-position shows.
 *
 * Reacts to the surrounding form via global, delegated listeners
 * (focusin/focusout/submit/mouseover on `document`) rather than props wired
 * through the server-rendered form, so the sign-in page stays a plain server
 * component and this is the only client boundary the feature needs.
 */

type Cell = { col: 0 | 1 | 2; row: 0 | 1 | 2 };

const DIRECTIONS = {
  upLeft: { col: 0, row: 0 },
  up: { col: 1, row: 0 },
  upRight: { col: 2, row: 0 },
  left: { col: 0, row: 1 },
  center: { col: 1, row: 1 },
  right: { col: 2, row: 1 },
  downLeft: { col: 0, row: 2 },
  down: { col: 1, row: 2 },
  downRight: { col: 2, row: 2 },
} satisfies Record<string, Cell>;

/** Cells per `yash-reactions.webp`: fist-pump, heart, thumbs-up / surprised, hands-over-eyes, cheering / thinking, sleepy, blushing. */
const REACTIONS = {
  excited: { col: 0, row: 0 },
  heart: { col: 1, row: 0 },
  thumbsUp: { col: 2, row: 0 },
  surprised: { col: 0, row: 1 },
  coveringEyes: { col: 1, row: 1 },
  cheering: { col: 2, row: 1 },
  thinking: { col: 0, row: 2 },
  sleepy: { col: 1, row: 2 },
  blushing: { col: 2, row: 2 },
} satisfies Record<string, Cell>;

function cellPosition(cell: Cell): string {
  return `${cell.col * 50}% ${cell.row * 50}%`;
}

/** 8-way compass bucket from a vector, with a center dead zone so small jitters near the mascot don't flicker the pose. */
function directionFromVector(dx: number, dy: number): Cell {
  const dist = Math.hypot(dx, dy);
  if (dist < 40) return DIRECTIONS.center;
  const angle = Math.atan2(dy, dx); // -PI..PI, 0 = right, PI/2 = down
  const octant = Math.round(angle / (Math.PI / 4)) & 7; // 0..7, starting at "right", clockwise
  return [
    DIRECTIONS.right,
    DIRECTIONS.downRight,
    DIRECTIONS.down,
    DIRECTIONS.downLeft,
    DIRECTIONS.left,
    DIRECTIONS.upLeft,
    DIRECTIONS.up,
    DIRECTIONS.upRight,
  ][octant];
}

type Reaction = "idle" | "looking-down" | "happy" | "sad";

export function SignInMascot({ initialError }: Readonly<{ initialError?: string }>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const directionsLayerRef = useRef<HTMLDivElement>(null);
  const [covering, setCovering] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(initialError ? "sad" : "idle");

  const isIdleTracking = !covering && !buttonHover && reaction === "idle";

  // Cursor tracking: direct DOM mutation on the directions layer via rAF,
  // not React state, since mousemove fires far too often to re-render on.
  useEffect(() => {
    if (!isIdleTracking) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    function handleMove(e: MouseEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = rootRef.current;
        const layer = directionsLayerRef.current;
        if (!el || !layer) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height * 0.4;
        const cell = directionFromVector(e.clientX - cx, e.clientY - cy);
        layer.style.backgroundPosition = cellPosition(cell);
      });
    }
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isIdleTracking]);

  useEffect(() => {
    function isField(target: EventTarget | null, id: string) {
      return target instanceof HTMLElement && target.id === id;
    }

    function onFocusIn(e: FocusEvent) {
      if (isField(e.target, "password") || isField(e.target, "geminiApiKey")) {
        setCovering(true);
      } else if (isField(e.target, "username")) {
        setReaction("looking-down");
      }
    }
    function onFocusOut(e: FocusEvent) {
      if (isField(e.target, "password") || isField(e.target, "geminiApiKey")) {
        setCovering(false);
      } else if (isField(e.target, "username")) {
        setReaction((r) => (r === "looking-down" ? "idle" : r));
      }
    }
    function onSubmit(e: Event) {
      if (!(e.target instanceof HTMLFormElement)) return;
      setCovering(false);
      setReaction("happy");
    }
    function closestSubmitButton(target: EventTarget | null) {
      return target instanceof HTMLElement ? target.closest('button[type="submit"]') : null;
    }
    function onMouseOver(e: MouseEvent) {
      if (closestSubmitButton(e.target)) setButtonHover(true);
    }
    function onMouseOut(e: MouseEvent) {
      if (closestSubmitButton(e.target)) setButtonHover(false);
    }

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, []);

  // Priority: covering eyes beats everything, then button-hover excitement,
  // then the submit/error reactions, then a plain "looking down" glance,
  // then idle (cursor-tracked) directions.
  const showReactions = covering || buttonHover || reaction === "happy" || reaction === "sad";
  let reactionCell: Cell = REACTIONS.heart;
  if (covering) reactionCell = REACTIONS.coveringEyes;
  else if (buttonHover) reactionCell = REACTIONS.thumbsUp;
  else if (reaction === "happy") reactionCell = REACTIONS.excited;
  else if (reaction === "sad") reactionCell = REACTIONS.surprised;
  const forcedDirectionCell = reaction === "looking-down" ? DIRECTIONS.down : null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="relative w-40 h-40 select-none"
      style={{ filter: "drop-shadow(0px 6px 14px rgba(76, 36, 112, 0.18))" }}
    >
      <div
        className={`absolute inset-0 ${reaction === "happy" ? "animate-mascot-bounce" : ""}`}
        onAnimationEnd={() => reaction === "happy" && setReaction("idle")}
      >
        <div
          ref={directionsLayerRef}
          className="absolute inset-0 bg-no-repeat transition-opacity duration-150"
          style={{
            backgroundImage: "url(/mascot/yash-directions.webp)",
            backgroundSize: "300% 300%",
            backgroundPosition: cellPosition(forcedDirectionCell ?? DIRECTIONS.center),
            opacity: showReactions ? 0 : 1,
          }}
        />
        <div
          className="absolute inset-0 bg-no-repeat transition-opacity duration-150"
          style={{
            backgroundImage: "url(/mascot/yash-reactions.webp)",
            backgroundSize: "300% 300%",
            backgroundPosition: cellPosition(reactionCell),
            opacity: showReactions ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
}
