"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { CompanyBrief } from "@/lib/brief/types";

export interface ApiError {
  kind: string;
  message: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
  candidates?: string[];
}

interface BriefSearchState {
  companyName: string;
  setCompanyName: (value: string) => void;
  validationError: string | null;
  error: ApiError | null;
  brief: CompanyBrief | null;
  loading: boolean;
  lastSubmitted: string;
  run: (name: string, forceRefresh?: boolean) => Promise<void>;
  /** Only auto-runs once per distinct company value — see BriefWorkspace's use of it. */
  runOnce: (name: string) => void;
}

const BriefSearchContext = createContext<BriefSearchState | null>(null);

/**
 * Holds the search-page's state above the page itself (mounted once in the
 * root layout, not inside src/app/page.tsx), so navigating to Compare,
 * Organizer, or Saved and back does not lose an in-progress or completed
 * search. A page component unmounting normally discards its own
 * `useState` — that's exactly what made a search "stop" when you switched
 * app tabs before this existed.
 */
export function BriefSearchProvider({ children }: { children: React.ReactNode }) {
  const [companyName, setCompanyName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [brief, setBrief] = useState<CompanyBrief | null>(null);
  const [loading, setLoading] = useState(false);

  /** Abort an in-flight request when a new search starts. */
  const inFlight = useRef<AbortController | null>(null);
  /** Name of the last successful submit, so Retry re-runs the right company. */
  const lastSubmitted = useRef<string>("");
  /** Last company name that triggered an auto-run, so reopening the same saved company twice in a row doesn't re-fetch. */
  const lastAutoRun = useRef<string | null>(null);

  const run = useCallback(async (name: string, forceRefresh = false) => {
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
        body: JSON.stringify({ companyName: trimmed, forceRefresh }),
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

  const runOnce = useCallback(
    (name: string) => {
      if (!name || lastAutoRun.current === name) return;
      lastAutoRun.current = name;
      setCompanyName(name);
      void run(name);
    },
    [run],
  );

  return (
    <BriefSearchContext.Provider
      value={{
        companyName,
        setCompanyName,
        validationError,
        error,
        brief,
        loading,
        lastSubmitted: lastSubmitted.current,
        run,
        runOnce,
      }}
    >
      {children}
    </BriefSearchContext.Provider>
  );
}

export function useBriefSearch(): BriefSearchState {
  const ctx = useContext(BriefSearchContext);
  if (!ctx) throw new Error("useBriefSearch must be used within BriefSearchProvider");
  return ctx;
}
