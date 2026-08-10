"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Avatar/username is the click target for this dropdown, not a separate
 * always-visible sign-out icon — matching how the initials chip in the
 * header reads as "this represents you, click it for account actions."
 */
export function UserMenu({
  username,
  signOut,
}: {
  username: string;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = username.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid place-items-center w-8 h-8 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-bold text-sm shadow-sm hover:brightness-95 active:scale-95 transition-[filter,transform]"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-surface-container-lowest shadow-elevation-2 p-2 flex flex-col gap-1 animate-entrance"
          style={{ animationDuration: "0.18s" }}
        >
          <div className="px-3 py-2 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Signed in as
            </span>
            <span className="text-sm font-semibold text-on-surface truncate">{username}</span>
          </div>
          <form
            action={async () => {
              setOpen(false);
              await signOut();
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-on-surface hover:bg-error-container hover:text-on-error-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
