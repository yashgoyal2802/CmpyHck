"use client";

import { useCallback, useRef, useState } from "react";
import { BriefView } from "./BriefView";
import type { CompanyBrief } from "@/lib/brief/types";

interface ApiError {
  kind: string;
  message: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  candidates?: string[];
}

/**
 * The working screen: input, research state, brief.
 *
 * State is held client-side and the brief is replaced in place, so repeated
 * searches never need a page refresh — the app is used dozens of times across a
 * placement season, and a reload between every company would be the main
 * friction.
 */
export function BriefWorkspace() {
  const [companyName, setCompanyName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [brief, setBrief] = useState<CompanyBrief | null>(null);
  const [loading, setLoading] = useState(false);

  /** Abort an in-flight request when a new search starts. */
  const inFlight = useRef<AbortController | null>(null);
  /** Name of the last successful submit, so Retry re-runs the right company. */
  const lastSubmitted = useRef<string>("");

  const run = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setValidationError("Enter a company name.");
      setError(null);
      return;
    }

    setValidationError(null);
    setError(null);
    setLoading(true);
    lastSubmitted.current = trimmed;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    try {
      const response = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: trimmed }),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error ?? {
          kind: "provider_error",
          message: "Research could not be completed.",
          retryable: true,
        });
        setBrief(null);
        return;
      }

      setBrief(payload.brief as CompanyBrief);
    } catch (caught) {
      // An abort means the user started another search; not an error state.
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError({
        kind: "network",
        message: "Could not reach the server. Check your connection and retry.",
        retryable: true,
      });
      setBrief(null);
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, []);

  return (
    <>
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          void run(companyName);
        }}
      >
        <label htmlFor="company" className="sr-only">
          Company name
        </label>
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
        />
        <button type="submit" disabled={loading}>
          {loading ? "Researching…" : "Build brief"}
        </button>
      </form>

      {validationError && (
        <p className="field-error" id="company-error" role="alert">
          {validationError}
        </p>
      )}

      {loading && (
        <p className="status" role="status">
          Searching the web and building the brief. Grounded research takes a
          little while.
        </p>
      )}

      {error && (
        <div className="notice" role="alert">
          <div>{error.message}</div>

          {error.candidates && error.candidates.length > 0 && (
            <div className="row">
              <span className="copy-note">Did you mean:</span>
              {error.candidates.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setCompanyName(candidate);
                    void run(candidate);
                  }}
                >
                  {candidate}
                </button>
              ))}
            </div>
          )}

          {error.retryable && (
            <div className="row">
              <button
                type="button"
                className="secondary"
                disabled={loading}
                onClick={() => void run(lastSubmitted.current || companyName)}
              >
                Retry
              </button>
              {error.retryAfterSeconds && (
                <span className="copy-note">
                  Suggested wait: {error.retryAfterSeconds}s
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {brief && !loading && <BriefView brief={brief} />}
    </>
  );
}
