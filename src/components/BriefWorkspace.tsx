"use client";

import { useEffect } from "react";
import { BriefView } from "./BriefView";
import { SearchingDots } from "./SearchingDots";
import { useBriefSearch } from "./BriefSearchProvider";

/**
 * The working screen: input, research state, brief.
 *
 * State lives in BriefSearchProvider (mounted at the root layout), not
 * here — so navigating to Compare/Organizer/Saved and back does not lose
 * an in-progress or completed search. This component just renders it.
 */
export function BriefWorkspace({ initialCompany }: { initialCompany?: string }) {
  const { companyName, setCompanyName, validationError, error, brief, loading, lastSubmitted, run, runOnce } =
    useBriefSearch();

  // Auto-run for a company opened from the Saved tab (?company=...).
  // runOnce no-ops if this exact company already triggered an auto-run,
  // so returning to "/" without a query param, or re-opening the same
  // saved company, doesn't re-fetch.
  useEffect(() => {
    if (initialCompany) runOnce(initialCompany);
  }, [initialCompany, runOnce]);

  const examples = ["Hindustan Unilever", "McKinsey & Company", "HDFC Bank"];

  return (
    <div className="w-full min-w-0 flex flex-col gap-6">
      <form
        className="w-full max-w-2xl mx-auto relative"
        onSubmit={(event) => {
          event.preventDefault();
          void run(companyName);
        }}
      >
        <label htmlFor="company" className="sr-only">
          Company name
        </label>
        <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline-variant text-[28px] pointer-events-none">
          search
        </span>
        <input
          id="company"
          name="company"
          type="text"
          autoComplete="organization"
          placeholder="Company name — e.g. Hindustan Unilever"
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          disabled={loading}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? "company-error" : undefined}
          className="w-full pl-16 pr-[150px] py-5 rounded-[32px] bg-surface-container-lowest text-lg text-on-surface placeholder:text-outline focus:outline-none focus:ring-4 focus:ring-primary-fixed-dim/50 shadow-[0_8px_32px_rgba(76,36,112,0.08)] hover:shadow-[0_12px_48px_rgba(76,36,112,0.12)] transition-shadow disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute inset-y-2 right-2 px-6 bg-primary text-on-primary font-semibold rounded-[24px] hover:bg-primary-container transition-colors shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? "Researching…" : "Build brief"}
          {!loading && (
            <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          )}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          Try
        </span>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setCompanyName(example);
              void run(example);
            }}
            disabled={loading}
            className="px-4 py-2 rounded-full bg-surface-container text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors shadow-sm disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>

      {validationError && (
        <p className="text-error text-sm" id="company-error" role="alert">
          {validationError}
        </p>
      )}

      {loading && (
        <p className="text-on-surface-variant text-sm flex items-center gap-2" role="status">
          Searching the web and building the brief. Grounded research takes a
          little while.
          <SearchingDots />
        </p>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container" role="alert">
          <div>{error.message}</div>

          {error.candidates && error.candidates.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <span className="text-sm opacity-80">Did you mean:</span>
              {error.candidates.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => {
                    setCompanyName(candidate);
                    void run(candidate);
                  }}
                  className="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface text-sm font-semibold hover:bg-surface-container active:scale-[0.97] transition-[background-color,transform]"
                >
                  {candidate}
                </button>
              ))}
            </div>
          )}

          {error.retryable && (
            <div className="flex items-center gap-3 flex-wrap mt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void run(lastSubmitted || companyName)}
                className="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface text-sm font-semibold hover:bg-surface-container active:scale-[0.97] transition-[background-color,transform] disabled:opacity-50"
              >
                Retry
              </button>
              {error.retryAfterSeconds && (
                <span className="text-sm opacity-80">
                  Suggested wait: {error.retryAfterSeconds}s
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {brief && !loading && (
        <BriefView
          brief={brief}
          onForceRefresh={() => void run(lastSubmitted, true)}
        />
      )}
    </div>
  );
}
