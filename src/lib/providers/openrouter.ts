import * as cheerio from "cheerio";
import { z } from "zod";
import { BriefError } from "@/lib/brief/errors";
import type { SourceRef } from "@/lib/brief/types";
import { briefDraftSchema, cacheDraftSchema, type BriefDraft, type CacheDraft } from "./draft";
import { domainFromUrl, parseNewsResearchText, parseResearchText } from "./grounding";
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
 * OpenRouter-backed fallback provider. See docs/fallback-provider.md and
 * openspec/changes/add-openrouter-fallback-provider for why this exists.
 *
 * Gemini collapses retrieval and generation into one grounded call; OpenRouter
 * models have no built-in web search, so retrieval is a separate step here:
 * Tavily search, then fetch-and-extract the top result pages, then hand that
 * retrieved text to the model as evidence. The research/news prompts
 * (`buildResearchPrompt`, `buildNewsResearchPrompt`) are reused byte-for-byte
 * from prompts.ts — they already produce the exact labelled-prose format
 * `parseResearchText`/`parseNewsResearchText` expect — with an appended block
 * that supplies the retrieved content and clarifies that this model has no
 * search tool of its own, overriding their "search the web now" framing.
 * `buildStructurePrompt`/`buildCacheStructurePrompt` are reused unchanged too,
 * since they already take research findings as plain text input.
 */

const MAX_SEARCH_QUERIES = 2;
const MAX_SOURCES = 6;
const MAX_PAGES_TO_FETCH = 4;
const PAGE_FETCH_TIMEOUT_MS = 6_000;
const MAX_EXTRACTED_CHARS_PER_PAGE = 3_000;
const OPENROUTER_TIMEOUT_MS = 60_000;

export interface OpenRouterProviderOptions {
  apiKey: string;
  model: string;
  tavilyApiKey: string;
}

interface TavilyResult {
  url: string;
  title: string;
  content: string;
}

export function createOpenRouterProvider(options: OpenRouterProviderOptions): BriefProvider {
  const { apiKey, model, tavilyApiKey } = options;

  async function retrieve(queries: string[]): Promise<{ sources: SourceRef[]; contextBlock: string }> {
    const merged = new Map<string, TavilyResult>();
    for (const query of queries.slice(0, MAX_SEARCH_QUERIES)) {
      const results = await tavilySearch(tavilyApiKey, query);
      for (const result of results) {
        if (result.url && !merged.has(result.url)) merged.set(result.url, result);
      }
    }

    const topResults = [...merged.values()].slice(0, MAX_SOURCES);
    const sources = mapTavilyToSources(topResults);

    const pages = await Promise.all(
      topResults.slice(0, MAX_PAGES_TO_FETCH).map(async (result) => ({
        result,
        extracted: await fetchAndExtract(result.url),
      })),
    );
    const pageByUrl = new Map(pages.map((p) => [p.result.url, p.extracted]));

    const contextBlock = topResults
      .map((result, index) => {
        const sourceId = sources[index]?.id ?? `s${index + 1}`;
        const body = pageByUrl.get(result.url) || result.content || "(no content retrieved)";
        return `[${sourceId}] ${result.title} — ${result.url}\n${body}`;
      })
      .join("\n\n");

    return { sources, contextBlock };
  }

  function withRetrievalOverride(prompt: string, contextBlock: string): string {
    return `${prompt}

---
You do not have live web search access. Use ONLY the retrieved web content below as your evidence for the instructions above — do not rely on general knowledge, and do not claim to have searched anything beyond what is provided here. If the retrieved content doesn't establish something, say so, exactly as the instructions above already ask.

Retrieved web content:
${contextBlock || "(nothing retrieved)"}

Now produce your findings in the exact format specified above.`;
  }

  function withJsonSchemaInstruction(prompt: string, schema: z.ZodType): string {
    return `${prompt}

---
Respond with ONLY a single JSON object (no markdown code fences, no commentary before or after) matching this JSON Schema exactly:
${JSON.stringify(z.toJSONSchema(schema, { io: "input" }))}`;
  }

  return {
    name: "openrouter",

    async research(request: ResearchRequest): Promise<ResearchResult> {
      const { sources, contextBlock } = await retrieve(request.queries);
      if (sources.length === 0) {
        throw new BriefError(
          "no_results",
          "Research returned no web sources for this company.",
        );
      }

      const prompt = withRetrievalOverride(buildResearchPrompt(request.company, request.queries), contextBlock);
      const text = await callOpenRouterText(apiKey, model, prompt);
      const parsed = parseResearchText(text);

      return {
        resolvedName: parsed.resolvedName || request.company.requestedName,
        classification: parsed.classification,
        findings: parsed.findings,
        sources,
        ambiguousCandidates: parsed.ambiguousCandidates,
        noResults: parsed.noResults,
      };
    },

    async structure(request: StructureRequest): Promise<BriefDraft> {
      const prompt = withJsonSchemaInstruction(
        buildStructurePrompt(request.company, request.research, request.plan),
        briefDraftSchema,
      );
      const data = await callOpenRouterJson(apiKey, model, prompt, briefDraftSchema, "structuring");
      return { ...data, providerUsed: { name: "openrouter", model } };
    },

    async researchNews(request: ResearchRequest): Promise<NewsResearchResult> {
      const { sources, contextBlock } = await retrieve(request.queries);
      const prompt = withRetrievalOverride(buildNewsResearchPrompt(request.company), contextBlock);
      const text = await callOpenRouterText(apiKey, model, prompt);
      const parsed = parseNewsResearchText(text);

      return { findings: parsed.findings, sources, noResults: parsed.noResults || sources.length === 0 };
    },

    async structureFromCache(request: StructureFromCacheRequest): Promise<CacheDraft> {
      const prompt = withJsonSchemaInstruction(buildCacheStructurePrompt(request), cacheDraftSchema);
      const data = await callOpenRouterJson(apiKey, model, prompt, cacheDraftSchema, "cache structuring");
      return { ...data, providerUsed: { name: "openrouter", model } };
    },
  };
}

function mapTavilyToSources(results: TavilyResult[]): SourceRef[] {
  return results.map((result, index) => ({
    id: `s${index + 1}`,
    title: result.title || domainFromUrl(result.url) || "Untitled",
    url: result.url,
    sourceLabel: domainFromUrl(result.url) ?? "Unknown source",
  }));
}

async function tavilySearch(tavilyApiKey: string, query: string): Promise<TavilyResult[]> {
  const response = await fetchWithTimeout(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyApiKey}` },
      body: JSON.stringify({ query, max_results: MAX_SOURCES }),
    },
    OPENROUTER_TIMEOUT_MS,
  );

  if (!response.ok) throw await translateHttpError(response, "Tavily");

  const data = (await response.json()) as { results?: TavilyResult[] };
  return data.results ?? [];
}

/** Fetch a page and extract its main-content text. Returns null (never throws) on any failure — one bad page must not fail the whole request. */
async function fetchAndExtract(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url, {}, PAGE_FETCH_TIMEOUT_MS);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, noscript, svg").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    return text.slice(0, MAX_EXTRACTED_CHARS_PER_PAGE) || null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenRouterText(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await openRouterChatCompletion(apiKey, model, prompt);
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new BriefError("provider_error", "The research stage returned an empty response.");
  }
  return text;
}

async function callOpenRouterJson<T extends z.ZodType>(
  apiKey: string,
  model: string,
  prompt: string,
  schema: T,
  stageLabel: string,
): Promise<z.infer<T>> {
  const response = await openRouterChatCompletion(apiKey, model, prompt, { type: "json_object" });
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new BriefError("malformed_response", `The ${stageLabel} stage returned an empty response.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new BriefError(
      "malformed_response",
      `The ${stageLabel} stage did not return valid JSON.`,
      { cause },
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new BriefError(
      "malformed_response",
      `The ${stageLabel} output did not match the expected shape: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
      { cause: result.error },
    );
  }

  return result.data;
}

interface OpenRouterCompletion {
  choices?: { message?: { content?: string } }[];
}

async function openRouterChatCompletion(
  apiKey: string,
  model: string,
  prompt: string,
  responseFormat?: { type: "json_object" },
): Promise<OpenRouterCompletion> {
  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    },
    OPENROUTER_TIMEOUT_MS,
  );

  if (!response.ok) throw await translateHttpError(response, "OpenRouter");

  return (await response.json()) as OpenRouterCompletion;
}

/**
 * Translate an HTTP failure from either Tavily or OpenRouter into a
 * BriefError, mirroring translateGeminiError's classification approach so
 * the UI tells the user the right next step regardless of which provider
 * actually served (or failed to serve) the request.
 */
async function translateHttpError(response: Response, serviceName: string): Promise<BriefError> {
  const bodyText = await response.text().catch(() => "");

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    return new BriefError(
      "rate_limited",
      `${serviceName} is rate limited.`,
      { retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined },
    );
  }

  if (response.status === 401 || response.status === 403) {
    return new BriefError("not_configured", `${serviceName} rejected the API key.`);
  }

  return new BriefError(
    "provider_error",
    `${serviceName} request failed with status ${response.status}: ${bodyText.slice(0, 300)}`,
  );
}
