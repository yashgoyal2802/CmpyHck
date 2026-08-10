import type { OrganizerStatus } from "@/lib/storage";

/**
 * Shared status metadata, used by both a server component
 * (src/app/organizer/page.tsx) and client components (OrganizerCard,
 * OrganizerPanel). Deliberately NOT in a "use client" file: importing a
 * plain data export from a client-marked module into a server component
 * hands back a client-reference placeholder instead of the real value in
 * Next.js's App Router, not the array itself — this file has no directive,
 * so every importer gets the actual data.
 */
export const STATUS_META: Record<
  OrganizerStatus,
  { label: string; chip: string; dot: string; text: string; accent: string }
> = {
  tracking: {
    label: "Tracking",
    chip: "bg-surface-container-high text-on-surface-variant",
    dot: "bg-outline-variant",
    text: "text-on-surface-variant",
    accent: "hover:border-outline",
  },
  prepping: {
    label: "Prepping",
    chip: "bg-primary-fixed text-on-primary-fixed",
    dot: "bg-primary-fixed-dim",
    text: "text-primary",
    accent: "hover:border-primary-fixed-dim",
  },
  interview_scheduled: {
    label: "Interview scheduled",
    chip: "bg-tertiary-fixed text-on-tertiary-fixed",
    dot: "bg-tertiary-fixed-dim",
    text: "text-tertiary",
    accent: "hover:border-tertiary",
  },
  interviewed: {
    label: "Interviewed",
    chip: "bg-primary-fixed-dim text-on-primary-fixed",
    dot: "bg-primary-fixed-dim",
    text: "text-primary",
    accent: "hover:border-primary",
  },
  offer: {
    label: "Offer",
    chip: "bg-secondary-container text-on-secondary-container",
    dot: "bg-secondary",
    text: "text-secondary",
    accent: "hover:border-secondary",
  },
  not_selected: {
    label: "Not selected",
    chip: "bg-error-container text-on-error-container",
    dot: "bg-error",
    text: "text-error",
    accent: "hover:border-error",
  },
};

export const STATUS_ORDER: OrganizerStatus[] = [
  "tracking",
  "prepping",
  "interview_scheduled",
  "interviewed",
  "offer",
  "not_selected",
];
