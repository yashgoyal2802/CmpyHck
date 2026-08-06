import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { BriefError } from "@/lib/brief/errors";
import { cacheDraftSchema, briefDraftSchema, type BriefDraft, type CacheDraft } from "./draft";
import { mapGroundingToSources, parseNewsResearchText, parseResearchText } from "./grounding";
import {
  buildCacheStructurePrompt,
  buildNewsResearchPrompt,
  buildResearchPrompt,
  buildStructurePrompt,
} from "./prompts";
import type {
  BriefProvider,
  NewsResearchResult,
  ResearchRequest,
  ResearchResult,
  StructureFromCacheRequest,
  StructureRequest,
} from "./types";

/**
 * Default model. Verify against current Google docs before relying on it — the
 * requirement is a model that supports BOTH Google Search grounding and JSON
 * response schemas, and that has a usable free tier. Override with GEMINI_MODEL.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
}

export function createGeminiProvider(
  options: GeminiProviderOptions,
): BriefProvider {
  const client = new GoogleGenAI({ apiKey: options.apiKey });
  const model = options.model ?? DEFAULT_GEMINI_MODEL;

  return {
    name: "gemini",

    /**
     * Stage one: grounded research.
     *
     * Google Search grounding cannot be combined with a response schema, so the
     * output here is labelled prose that `parseResearchText` reads, plus the
     * grounding metadata that becomes the brief's source list.
     */
    async research(request: ResearchRequest): Promise<ResearchResult> {
      const prompt = buildResearchPrompt(request.company, request.queries);

      const response = await callGemini(() =>
        client.models.generateContent({
          model,
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
      );

      const text = response.text?.trim();
      if (!text) {
        throw new BriefError(
          "provider_error",
          "The research stage returned an empty response.",
        );
      }

      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources = mapGroundingToSources(groundingMetadata);
      const parsed = parseResearchText(text);

      // No grounding chunks means the model answered from memory rather than
      // from search. Every factual section would be unsourced, so refuse.
      if (sources.length === 0) {
        throw new BriefError(
          "no_results",
          "Research returned no web sources for this company.",
        );
      }

      return {
        resolvedName: parsed.resolvedName || request.company.requestedName,
        classification: parsed.classification,
        findings: parsed.findings,
        sources,
        ambiguousCandidates: parsed.ambiguousCandidates,
        noResults: parsed.noResults,
      };
    },

    /** Stage two: schema-constrained structuring. No tools, so the schema applies. */
    async structure(request: StructureRequest): Promise<BriefDraft> {
      const prompt = buildStructurePrompt(
        request.company,
        request.research,
        request.plan,
      );

      const response = await callGemini(() =>
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(briefDraftSchema, {
              io: "input",
            }),
          },
        }),
      );

      const text = response.text?.trim();
      if (!text) {
        throw new BriefError(
          "malformed_response",
          "The structuring stage returned an empty response.",
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new BriefError(
          "malformed_response",
          "The structuring stage did not return valid JSON.",
          { cause },
        );
      }

      const result = briefDraftSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefError(
          "malformed_response",
          `The brief did not match the expected shape: ${result.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")} ${i.message}`)
            .join("; ")}`,
          { cause: result.error },
        );
      }

      // The pipeline owns assembly; this stage returns the model-authored slice.
      return result.data;
    },

    /** Cache-hit stage one: grounded search scoped to recent news only. */
    async researchNews(request: ResearchRequest): Promise<NewsResearchResult> {
      const prompt = buildNewsResearchPrompt(request.company);

      const response = await callGemini(() =>
        client.models.generateContent({
          model,
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        }),
      );

      const text = response.text?.trim();
      if (!text) {
        throw new BriefError(
          "provider_error",
          "The news research stage returned an empty response.",
        );
      }

      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources = mapGroundingToSources(groundingMetadata);
      const parsed = parseNewsResearchText(text);

      return { findings: parsed.findings, sources, noResults: parsed.noResults || sources.length === 0 };
    },

    /** Cache-hit stage two: news, talking points, and interviewer questions only. */
    async structureFromCache(request: StructureFromCacheRequest): Promise<CacheDraft> {
      const prompt = buildCacheStructurePrompt(request);

      const response = await callGemini(() =>
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(cacheDraftSchema, { io: "input" }),
          },
        }),
      );

      const text = response.text?.trim();
      if (!text) {
        throw new BriefError(
          "malformed_response",
          "The cache structuring stage returned an empty response.",
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new BriefError(
          "malformed_response",
          "The cache structuring stage did not return valid JSON.",
          { cause },
        );
      }

      const result = cacheDraftSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefError(
          "malformed_response",
          `The cache draft did not match the expected shape: ${result.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")} ${i.message}`)
            .join("; ")}`,
          { cause: result.error },
        );
      }

      return result.data;
    },
  };
}

/**
 * Translate provider transport failures into BriefErrors.
 *
 * Rate limiting is separated from generic failure because it is the expected
 * free-tier failure and the user's next step differs: wait, rather than retry
 * immediately or report a bug.
 */
async function callGemini<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw translateGeminiError(error);
  }
}

export function translateGeminiError(error: unknown): BriefError {
  const status = extractStatus(error);
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429 || /quota|rate limit|resource_exhausted/i.test(message)) {
    return new BriefError(
      "rate_limited",
      "The research provider is rate limited.",
      { retryAfterSeconds: extractRetryAfter(message), cause: error },
    );
  }

  if (status === 401 || status === 403) {
    return new BriefError(
      "not_configured",
      "The research provider rejected the API key.",
      { cause: error },
    );
  }

  return new BriefError("provider_error", "The research provider failed.", {
    cause: error,
  });
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.code === "number") return candidate.code;
  return undefined;
}

function extractRetryAfter(message: string): number | undefined {
  const match = /retry(?:\s|-)?after\D*(\d+)/i.exec(message);
  return match ? Number(match[1]) : undefined;
}
