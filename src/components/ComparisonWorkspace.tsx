"use client";

import { useState } from "react";
import { BriefView } from "./BriefView";
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
      <div className="card">
        {inputs.map((value, index) => (
          <div className="search" key={index} style={{ marginBottom: "0.75rem" }}>
            <input
              type="text"
              placeholder={`Company ${index + 1}`}
              value={value}
              onChange={(e) => setInput(index, e.target.value)}
              disabled={loading}
            />
          </div>
        ))}

        <div className="row" style={{ gap: "0.75rem" }}>
          {inputs.length < MAX_COMPANIES && (
            <button
              type="button"
              className="secondary"
              onClick={() => setInputs((prev) => [...prev, ""])}
              disabled={loading}
            >
              Add a third company
            </button>
          )}
          <button type="button" onClick={() => void run()} disabled={loading}>
            {loading ? "Researching…" : "Compare"}
          </button>
        </div>
      </div>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="status" role="status">
          Building briefs for each company. This can take a while for more than one.
        </p>
      )}

      {results && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${results.length}, minmax(0, 1fr))`,
            gap: "1rem",
            alignItems: "start",
          }}
        >
          {results.map((result) => (
            <div key={result.companyName}>
              {result.brief ? (
                <BriefView brief={result.brief} />
              ) : (
                <div className="notice" role="alert">
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
