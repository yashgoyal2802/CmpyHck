"use client";

import { useState } from "react";

const STORAGE_KEY = "theme";

/** Mirrors the inline blocking script in layout.tsx so both agree on the same default. */
function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private browsing, quota) — the toggle
    // still works for the session, it just won't persist across reloads.
  }
}

/**
 * A user-controlled toggle, not `prefers-color-scheme`: system preference
 * silently switching the whole page with no opt-out is exactly what caused
 * the dark-background bug this replaces. See globals.css for the token
 * side of this.
 *
 * The switch itself is the one deliberate motion moment on this control:
 * the new theme wipes in as a circle expanding from wherever the button
 * was clicked (View Transitions API — see the `theme-reveal` keyframe in
 * globals.css), with an instant fallback for browsers that don't support
 * it. The icon replays a small spin+pop on every change.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => currentTheme());
  // AppHeader (and this component with it) remounts on every page
  // navigation, since each page renders its own <AppHeader>. Without this,
  // the icon's mount-triggered CSS animation would replay on every tab
  // switch, not just on an actual click — this stays false until toggle()
  // has actually run at least once in this component's lifetime.
  const [hasToggled, setHasToggled] = useState(false);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = theme === "dark" ? "light" : "dark";
    const { clientX, clientY } = event;
    setHasToggled(true);

    const supportsViewTransitions =
      typeof document !== "undefined" && "startViewTransition" in document;

    if (!supportsViewTransitions) {
      applyTheme(next);
      setTheme(next);
      return;
    }

    const root = document.documentElement;
    const maxRadius = Math.hypot(
      Math.max(clientX, window.innerWidth - clientX),
      Math.max(clientY, window.innerHeight - clientY),
    );
    root.style.setProperty("--theme-toggle-x", `${clientX}px`);
    root.style.setProperty("--theme-toggle-y", `${clientY}px`);
    root.style.setProperty("--theme-toggle-r", `${maxRadius}px`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).startViewTransition(() => {
      applyTheme(next);
      setTheme(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="p-1 text-on-surface-variant hover:text-primary active:scale-90 transition-[color,transform]"
    >
      <span
        key={theme}
        className={`material-symbols-outlined text-[20px] inline-block ${hasToggled ? "animate-icon-pop" : ""}`}
      >
        {theme === "dark" ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
