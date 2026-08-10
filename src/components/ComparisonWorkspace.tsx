"use client";

import { useState } from "react";
import { BriefView } from "./BriefView";
import { SearchingDots } from "./SearchingDots";
import type { CompanyBrief } from "@/lib/brief/types";

interface ComparisonResult {
  companyName: string;
  brief?: CompanyBrief;
  error?: { kind: string; message: string };
}

const MIN_COMPANIES = 2;
const MAX_COMPANIES = 3;

export function ComparisonWorkspace() {
  const [inputs, setInputs] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);

  function setInput(index: number, value: string) {
    setInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  async function run() {
    const companies = inputs.map((v) => v.trim()).filter((v) => v.length > 0);
    if (companies.length < MIN_COMPANIES || companies.length > MAX_COMPANIES) {
      setError(`Enter ${MIN_COMPANIES} or ${MAX_COMPANIES} company names.`);
      return;
    }

    setError(null);
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch("/api/comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies }),
      });
      const payload = await response.json();

      if (!response.ok && !payload?.results) {
        setError(payload?.error?.message ?? "Comparison could not be completed.");
        return;
      }

      setResults(payload.results as ComparisonResult[]);
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-elevation-1 p-6 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {inputs.map((value, index) => (
            <div className="relative" key={index}>
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder={`Company ${index + 1}`}
                value={value}
                onChange={(e) => setInput(index, e.target.value)}
                disabled={loading}
                className="w-full h-full pl-12 pr-10 py-3 rounded-full bg-surface-container text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest transition-colors disabled:opacity-60"
              />
              {inputs.length > MIN_COMPANIES && (
                <button
                  type="button"
                  onClick={() => setInputs((prev) => prev.filter((_, i) => i !== index))}
                  disabled={loading}
                  aria-label={`Remove company ${index + 1}`}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          ))}

          {inputs.length < MAX_COMPANIES && (
            <button
              type="button"
              onClick={() => setInputs((prev) => [...prev, ""])}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-full border-2 border-dashed border-outline-variant text-on-surface-variant text-sm font-semibold hover:border-primary hover:text-primary active:scale-[0.97] transition-[color,border-color,transform] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add a third company
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="self-start px-6 py-2 rounded-full bg-primary text-on-primary font-semibold shadow-elevation-1 hover:brightness-95 hover:shadow-elevation-2 active:scale-[0.97] transition-[filter,box-shadow,transform] disabled:opacity-50"
        >
          {loading ? "Researching…" : "Compare"}
        </button>
      </div>

      {error && (
        <p className="p-4 rounded-2xl bg-error-container text-on-error-container" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-on-surface-variant text-sm flex items-center gap-2" role="status">
          Building briefs for each company. This can take a while for more than one.
          <SearchingDots />
        </p>
      )}

      {results && (
        <div
          className="grid gap-6 items-start"
          style={{ gridTemplateColumns: `repeat(${results.length}, minmax(0, 1fr))` }}
        >
          {results.map((result) => (
            <div key={result.companyName}>
              {result.brief ? (
                <BriefView brief={result.brief} />
              ) : (
                <div className="p-4 rounded-2xl bg-error-container text-on-error-container" role="alert">
                  <strong>{result.companyName}</strong> is unavailable:{" "}
                  {result.error?.message ?? "Research failed."}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
