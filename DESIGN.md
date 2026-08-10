# DESIGN.md — Placement Brief

Recorded from the shipped build (`src/app/globals.css`, `src/app/layout.tsx`, and the App Router pages/components under `src/app` and `src/components`), not from the direction contract's intentions. Where the build and the contract diverge, this file describes the build and calls out the divergence.

## Thesis

Interview prep as tactile, purple-owned momentum — signature purple carries structure (headings, nav, primary actions) on a true near-white surface, with white "layered paper" cards on soft purple-tinted ambient shadows. The system is a direct Material 3 semantic-role port (primary / secondary / tertiary / surface / error, each with `-container` and `-fixed` variants) re-themed with a custom palette, not a from-scratch token set — this is why the roles below map cleanly onto Material's naming.

Brief-pinned: this direction came from a user-shared Stitch reference ("SoHired"), not the concept-seed roll. Record it as-is; it is not less canonical for having been pinned.

## Palette

Defined in `@theme` in `globals.css` as CSS custom properties (`--color-*`), consumed via Tailwind utilities (`bg-primary`, `text-on-surface-variant`, etc.). A `prefers-color-scheme: dark` block re-themes every variable, so no component carries a `dark:` prefix.

| Role | Value | Used for |
|---|---|---|
| `primary` | `#350859` | Headlines (`text-primary`), active nav + nav-hover, primary CTA fill (search submit, sign-in submit, save button), focus ring, avatar/logo mark fill |
| `primary-container` | `#4c2470` | Reserved Material role; not directly hand-authored in sampled components (secondary elevated purple, e.g. dark-mode primary-container) |
| `primary-fixed` / `on-primary-fixed` | `#f1dbff` / `#2d0050` | The system's badge/chip surface: sector classification chip, numbered talking-point circles, "questions to ask" step numbers use `tertiary-fixed` instead (see below) — `primary-fixed` specifically marks *classification and ordinal* badges |
| `secondary` (mint) | `#1b6b4f` | Reserved role; bar fill in `BriefVitals` (`bg-secondary`) for the sourced-claims proportion bar |
| `secondary-container` / `on-secondary-container` | `#a6f2cf` / `#00513a` | The system's one positive/success/confirmation surface: "sourced" basis tag, copy-confirmed and save-confirmed button states (paired with `animate-pulse-once`) |
| `tertiary-fixed` / `on-tertiary-fixed` | `#eddcff` / `#221534` (lavender) | Identity and marker accents: header avatar initial, active bookmark star, confidence badge (organizer row), interviewer-question step numbers |
| `surface` / `background` | `#fdfcff` | Page background — true near-white, purple-tinted, not gray |
| `surface-container-lowest` | `#ffffff` | Card/panel fill — pure white against the near-white page, the "layered paper" separation |
| `surface-container` / `-high` | `#f2eff8` / `#ebe6f4` | Secondary chip/pill fill (search input at rest, icon buttons, secondary action buttons like "Force refresh") and its hover state |
| `error` / `error-container` | `#ba1a1a` / `#ffdad6` | Validation errors, request failures — standard Material error role, unmodified |
| `outline-variant` | `#cec3d1` | Hairline dividers between list rows (`divide-outline-variant/30`), dashed "unavailable" borders |

**Named rule — role-to-purpose mapping is fixed:** primary = structure and primary action; mint/secondary = the one positive-confirmation color (sourced evidence, save/copy success); tertiary/lavender = identity and ordinal markers (avatars, bookmarks, secondary numbered lists), never used for primary CTAs. A future surface should not reach for tertiary as a second brand color or for secondary as a generic accent — each role is scoped to what it already means here.

## Typography

Single family throughout: Plus Jakarta Sans, loaded via `next/font/google` and applied to `<body>` — no serif or monospace anywhere in the sampled surfaces.

Ramp as actually used (Tailwind size utilities, no custom `--text-*` tokens defined):
- Hero display: `text-4xl md:text-6xl font-extrabold tracking-tight` (home H1) — the only `font-extrabold` headline size
- Section display: `text-3xl md:text-5xl font-extrabold` (Saved page H1)
- Brief title: `text-2xl md:text-3xl font-bold tracking-tight` (brief H2)
- Card/panel title: `text-lg font-bold` (every `Card` component title, sign-in title)
- Lead prose: `text-lg` (brief overview paragraph — the one non-heading text that gets the larger size, deliberately reads as "the answer" not a card among equals)
- Body: default size, `text-on-surface`
- Secondary/meta text: `text-sm text-on-surface-variant`
- Micro-label: `text-[10px]`/`text-xs uppercase tracking-wide font-bold` — reserved for badges and chips only (basis tags, sector chip, status chips), never for body copy

**Named rule:** `font-extrabold` is reserved for the two page-level H1s (home, saved). Everything else that needs weight uses `font-bold` (headings, card titles) or `font-semibold` (buttons, nav links, form labels). This is a three-step weight scale, not a continuum.

## Shape / Radius

No custom `--radius-*` token is defined in `@theme`; the build uses Tailwind's default radius scale directly. Actual usage is a consistent, purposeful split — **not** the 24px stated in the direction contract's OWN-WORLD block (Tailwind's `rounded-2xl` is 16px; no override was added, so the shipped radius is 16px). Record the build:

- `rounded-full` — every interactive control: text inputs, buttons, badges/chips, avatars, icon buttons. Pills, not rounded rectangles, are the system's control shape.
- `rounded-2xl` (16px) — cards, panels, sections (`Card`, `OrganizerPanel`, sign-in panel, saved-company tiles). The system's container shape.
- `rounded-xl` (12px) — nested sub-containers inside a card (4P quadrant outer border, error/info banners)
- `rounded-lg` (8px) — dense inline form controls only (date/number selects inside `OrganizerPanel`), never a full-size button or card

**Divergence to note:** the direction contract specifies 24px-radius cards; the shipped token is Tailwind's unmodified 16px (`rounded-2xl`) with no `--radius` override in `globals.css`. The build is internally consistent at 16px — record 16px as the system value, not 24px.

## Elevation (shadow)

Two custom tokens, both soft and purple-tinted (never neutral gray, never hard-offset):
- `--shadow-elevation-1: 0px 4px 20px rgba(76,36,112,0.06)` — resting state for every card, header, and pill button
- `--shadow-elevation-2: 0px 12px 32px rgba(76,36,112,0.12)` — hover/lift state (`hover:shadow-elevation-2` on cards and rows) and the sign-in panel's resting state (one deliberately "already lifted" surface)

**Named rule:** shadow is a two-step system, elevation-1 at rest and elevation-2 on hover/emphasis. No third level exists in the build; do not invent one.

## Motion

Three named `@theme` animations, each scoped to a specific job (documented in `globals.css` itself):
- `animate-entrance` (0.5s, translateY+opacity) — one-shot settle-in for brief content: header, lead answer, vitals bar, and every `Card`, staggered with a fixed 40/80/160ms delay tier (not per-item staggering)
- `animate-pulse-once` (1.1s, background-color flash to `secondary-container` and back) — one-shot acknowledgment on save/copy/new-since-cache confirmation
- `animate-searching` (1.3s loop, opacity/scale) — the only continuous loop, scoped to `SearchingDots`, unmounted (not hidden) the instant loading ends
- `prefers-reduced-motion: reduce` collapses all three globally

**Named rule:** motion has exactly one loop (search feedback) and two one-shot moments (entrance, success-pulse). A future addition that idles/loops outside a loading state is off-system.

## Iconography

Material Symbols Outlined (loaded as a webfont in `layout.tsx`, `.material-symbols-outlined` class in `globals.css`) is the system's icon set — glyph icons drawn from Material's own icon font, matching the Material-3-semantic-role palette the whole token set is ported from. This is native to the world (the OWN-WORLD is an explicit Material 3 port), not an ad hoc device — record it as a system rule, not a defect. Icons appear at `text-[16px]`–`text-[20px]` inline with buttons/labels (search, logout, star, check, content_copy, add, expand_more, visibility/visibility_off), never as unlabeled-only controls (all carry `aria-label` or adjacent text).

## Component Patterns (named)

- **Card** (`src/components/BriefView.tsx`): the one content-section primitive — white `rounded-2xl` panel, `shadow-elevation-1` → `shadow-elevation-2` on hover, title row with optional trailing action, `animate-entrance` with the shared 160ms tier. Every brief section (news, deep dive, framework, talking points, interviewer questions, sources) is the same `Card`, not bespoke layouts, except the two frameworks below.
- **BasisTag**: two-state sourced/analysis provenance pill (mint container vs. neutral `surface-container-high`) attached to nearly every claim in the brief — this is the product's evidentiary spine made visual, not a generic tag.
- **4P Quadrant**: a literal 2x2 grid with a 2px `outline-variant` divider standing in for the classic marketing-mix cross, used only for `four_p` framework briefs.
- **Five Forces diagram**: CSS-grid cross layout (rivalry centered in `bg-primary`, four forces at N/S/E/W) on `md:` and up; collapses to a plain stack (`FiveForcesStack`) below `md` rather than shrinking the cross. Framework-specific, not a general layout token.
- **BriefVitals**: single continuous proportion bar (`bg-secondary` fill) plus a stat row — the sourced/total ratio is the content, not a decorative stat-tile grid.
- **Status pipeline** (`OrganizerRow`, `OrganizerPanel` via `STATUS_META`/`STATUS_ORDER`): six fixed stages (tracking → prepping → interview_scheduled → interviewed → offer / not_selected), each with its own color-role chip (neutral, primary-fixed, tertiary-fixed, primary-fixed-dim, secondary-container, error-container). This mapping is fixed across both the compact panel and the organizer list row — do not introduce a seventh stage or reassign a stage's color role without updating both call sites.
- **Search/input shape**: every text entry point (home search, comparison inputs, sign-in username/password) is a `rounded-full` field on `bg-surface-container` that lightens to `surface-container-lowest` on focus, with a leading `material-symbols-outlined` icon where the field is a search box.
- **Primary CTA**: `rounded-full bg-primary text-on-primary shadow-elevation-1`, `hover:brightness-95 hover:shadow-elevation-2`, `active:scale-[0.97]`. This exact combination (fill + shadow-lift + brightness on hover + scale-down on press) is the one primary-action treatment across search submit, sign-in submit, and save.
- **Header**: fixed, `h-16`, `bg-surface/90 backdrop-blur-md`, `shadow-elevation-1`, primary-filled square logo mark, underline-on-active nav (`border-b-2 border-primary`), tertiary-fixed circular avatar-initial.

## Not Canonized

Material Symbols Outlined glyph icons were initially a candidate for a "floor default" flag (glyph icon systems are often a generic-SaaS tell), but this world is an explicit, declared Material 3 port (`globals.css` header comment) — the icon font is native to the world's own material, not an import from a banned generic default. Recorded as a system rule above, not excluded.

No kicker/eyebrow labels, hard-offset shadows, or system-default display faces were found anywhere in the sampled build (the direction contract explicitly calls out "no eyebrow label" on the home hero, and it held) — nothing to exclude on that front.

The one true divergence — 16px shipped card radius vs. the 24px stated in the direction contract — is recorded as the system value above (build wins), not silently corrected to match the contract, and not hidden.
