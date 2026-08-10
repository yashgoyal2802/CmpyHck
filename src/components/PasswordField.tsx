"use client";

import { useState } from "react";

/**
 * Password input with a show/hide toggle. Kept as its own client component
 * so the sign-in page above it can stay a server component with a plain
 * form action — only the toggle's local visibility state needs a client.
 */
export function PasswordField({
  id,
  name,
  autoComplete,
  placeholder,
}: {
  id: string;
  name: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="w-full pl-4 pr-12 py-3 rounded-full bg-surface-container text-on-surface placeholder:text-on-surface-variant text-center focus:bg-surface-container-lowest transition-colors"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high active:scale-[0.94] transition-[color,background-color,transform]"
      >
        <span className="material-symbols-outlined text-[20px]">
          {visible ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}
