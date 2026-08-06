## Why

The MVP (`build-placement-company-research-app`) proved the brief pipeline works well against real companies, but its shared-passphrase access model has no way to attach anything to a specific person, and every search re-researches a company from scratch even when it was searched last week. Both limits block features the student actually wants going into a placement season: a private prep tracker, and not burning free-tier quota re-researching the same 15-20 shortlisted companies repeatedly.

## What Changes

- **BREAKING**: Replace the shared access passphrase with per-user username and password accounts, provisioned by the app owner (no self-registration). Existing sessions and the passphrase env var stop working.
- Add a shared, server-side cache of the stable parts of a company's research (overview, sector classification, deep-dive facts) so a repeated search reuses them instead of re-researching from scratch. News stays always-fresh and is never cached.
- Add a "what's changed" view: when a cached company is re-searched, show what's new since the last cached version alongside the refreshed news.
- Add a personal organizer, private per account: track which companies a user has prepped, an interview date, and a confidence rating. Not shared between users.
- Add a company comparison view: generate or reuse briefs for 2-3 companies and present them side by side.

## Capabilities

### New Capabilities

- `user-accounts`: Username/password authentication with per-user sessions, replacing the shared passphrase. Accounts are provisioned by the owner; there is no self-registration.
- `company-research-cache`: Server-side caching of the stable, slow-changing parts of a company's research, shared across all users, with news always fetched fresh. Includes surfacing what changed since a company was last cached.
- `personal-organizer`: Private, per-user tracking of preparation status, interview date, and confidence for researched companies.
- `company-comparison`: Side-by-side presentation of briefs for two or three companies in one view.

### Modified Capabilities

- `company-preparation-brief`: The access-control requirement changes from a shared passphrase to per-user login (see `user-accounts`). This capability's spec has not been archived from `build-placement-company-research-app` yet; this change assumes that change ships first and its `Restricted access` requirement is what gets superseded.

## Impact

- Replaces the passphrase-based auth module and its middleware gate with a credentials-backed equivalent; the existing signed-cookie session mechanism is extended rather than replaced.
- Adds a persistence layer (a small database) for the first time in this application - previously nothing was stored server-side.
- Adds user-scoped data for the first time; requires deciding how personal-organizer data and account credentials are stored and isolated per user.
- Changes the brief generation pipeline to consult and write to the cache before and after research, rather than always researching from a blank state.
- Adds a comparison UI surface alongside the existing single-company workflow.
- Existing deployment must be reconfigured: the `ACCESS_PASSPHRASE` env var is retired in favor of account provisioning, and a database needs to be provisioned.
