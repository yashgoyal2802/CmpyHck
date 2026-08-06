import type { NormalizedCompany } from "@/lib/brief/normalize";
import type { SectionPlan } from "@/lib/brief/plan";
import { SECTORS, SECTOR_POLICY } from "@/lib/brief/sectors";
import type { ResearchResult, StructureFromCacheRequest } from "./types";

/**
 * Placement-usefulness ranking rules, shared by both stages.
 *
 * This is the spec's news-filtering requirement expressed as instruction. It is
 * stated as what to prefer (not a list of prohibitions) because ranking is a
 * judgement the model makes well when it knows what the reader needs.
 */
const PLACEMENT_USEFULNESS = `Rank findings by how useful they are to an MBA candidate walking into an interview, not by how recent they are.

High value: strategic moves and pivots; deal, client or contract wins; partnerships and alliances; market or geographic expansion; product, brand or platform launches; funding, acquisitions and divestments; leadership changes that signal direction; campus or graduate hiring moves; financial results read for what they reveal about direction.

Low value: routine share-price movement and analyst target changes; generic CSR or awards announcements; press releases older than about 18 months unless still strategically live; listicles and content-farm reposts.

Discard entirely: results about a different company that merely shares part of the name. If you are unsure two results describe the same company, say so rather than merging them.`;

const SOURCE_DISCIPLINE = `Every factual claim must trace to something you actually retrieved. If you could not establish something, say plainly that it could not be established. Never fill a gap with a plausible guess, and never present general industry knowledge as a fact about this specific company.`;

export function buildResearchPrompt(
  company: NormalizedCompany,
  queries: string[],
): string {
  const sectorList = SECTORS.map((s) => {
    const policy = SECTOR_POLICY[s];
    return `- ${s}: ${policy.label} — probes ${policy.themes.join("; ")}`;
  }).join("\n");

  return `You are researching a company so an MBA student at SPJIMR can prepare for a campus placement interview with it.

Company as entered by the student: "${company.requestedName}"
Core name for searching: "${company.coreName}"

Search the web now and gather current, specific information. Useful starting queries:
${queries.map((q) => `- ${q}`).join("\n")}

${PLACEMENT_USEFULNESS}

${SOURCE_DISCIPLINE}

Then classify the company into exactly one of these MBA-relevant sectors:
${sectorList}

Classify by which kind of interview the student will face, not by the company's legal form or whether it sells a service. A firm whose graduate interviews are case-based is consulting; one whose interviews centre on brands and distribution is fmcg; one centred on regulation, lending and financial performance is bfsi.

Report your findings as prose under these headings, in this order:

RESOLVED_NAME: the company's canonical name on one line.

AMBIGUOUS: if "${company.coreName}" plausibly refers to more than one distinct company, list the candidates on one line separated by " | ". Otherwise write "no".

NO_RESULTS: write "yes" only if you found essentially nothing usable about this company. Otherwise write "no".

SECTOR: one of ${SECTORS.join(", ")}.
CONFIDENCE: "likely" if the evidence clearly places the company in that sector, "uncertain" otherwise.
MARKETING_RELEVANT: "yes" if this company's interviews would genuinely centre on marketing framing such as brand, pricing, distribution and promotion; "no" otherwise. Answer "no" for firms where marketing is peripheral to the interview.
CLASSIFICATION_RATIONALE: one or two sentences on why.

OVERVIEW: what the company does and how it makes money.

NEWS: the most placement-useful recent developments you found. For each, give what happened, when, and why an interviewer would expect the candidate to know it.

DEEP_DIVE: the substance an interviewer in this sector would probe, following that sector's themes above.

MARKETING_DETAIL: brand portfolio, pricing posture, distribution and channels, and promotional activity — only if you found real evidence for them. Write "not established" if you did not.

CONTEXT: anything else that would help the student sound informed.

Attribute claims to the sources you retrieved as you write.`;
}

export function buildStructurePrompt(
  company: NormalizedCompany,
  research: ResearchResult,
  plan: SectionPlan,
): string {
  const sourceList = research.sources
    .map((s) => {
      const parts = [`${s.id}: ${s.title}`, s.sourceLabel];
      if (s.date) parts.push(s.date);
      if (s.url) parts.push(s.url);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n");

  const fourPInstruction = plan.includeFourP
    ? `Produce the fourP section with exactly four entries, one per dimension, in the order Product, Price, Place, Promotion. Marketing framing drives interviews in this sector, so give it full weight. Where company-specific evidence exists use it and set basis to "sourced". Where it does not, reason at the industry level and set basis to "inferred" — the reader must be able to tell which is which.`
    : `Set fourP to null. 4P analysis does not apply to this sector and must be omitted rather than filled with generic industry content.`;

  const fallbackNote = plan.usedFallback
    ? `\nThe sector classification was uncertain, so this brief uses the general business deep dive. Say so in the deep dive rather than asserting sector-specific detail the evidence does not support.`
    : "";

  return `Turn the research below into a structured placement preparation brief for an MBA student. Return JSON matching the provided schema exactly.

Company as entered: "${company.requestedName}"
Resolved name: "${research.resolvedName}"

Sections to produce for this brief (already decided — follow them exactly):
- Sector: ${plan.sector} (${plan.sectorLabel})
- Deep dive heading: "${plan.deepDiveHeading}"
- Deep dive themes: ${plan.themes.join("; ")}
- 4P section: ${plan.includeFourP ? "include" : "omit (null)"}
- Recent news: between ${plan.newsMin} and ${plan.newsMax} items
- Talking points: exactly ${plan.talkingPointCount}
- Interviewer questions: exactly ${plan.interviewerQuestionCount}${fallbackNote}

Available sources — cite these by id in the sourceIds arrays:
${sourceList || "(none retrieved)"}

Research findings:
---
${research.findings}
---

Rules:

${SOURCE_DISCIPLINE}

Marking sourced versus inferred is the most important judgement in this brief. The student uses it to decide what they can state as fact in an interview and what they must present as their own reading. Apply this test to every claim.

Mark a claim "sourced" when a retrieved source states its substance — a reported figure, a dated announcement, a named acquisition, a stated company strategy — and cite the sources that actually state it.

Mark a claim "inferred" when you are the one drawing the conclusion, even where sourced facts informed it: why a development matters, what a move signals about direction, how the company compares with peers, what a candidate should emphasise. Leave sourceIds empty for these.

Expect a genuine mix. Talking points are usually inferred, because their job is to connect facts into an argument; a talking point is sourced only when it simply restates a specific reported fact. In the 4P section, Product and Place are often sourced because portfolio and distribution get reported, while Price and Promotion are often inferred because pricing posture and brand strategy are usually your reading rather than a published statement. A brief in which every claim is marked sourced has not applied the test.

Cite at most three sources per claim — the ones that directly support it. A long list of ids on every statement is not more rigorous; it makes the citation useless, because the student cannot tell which source to open to check the claim.

${PLACEMENT_USEFULNESS}

News: give between ${plan.newsMin} and ${plan.newsMax} items, chosen for placement usefulness rather than recency alone. Each needs a whyItMatters explaining what an interviewer would expect the student to do with it. If the research found no relevant recent news, return an empty items array and set news.unavailable to a short sentence saying so — do not invent updates.

Deep dive: follow the themes listed above. If reliable evidence could not be established, set deepDive.unavailable and keep topics minimal rather than padding.

${fourPInstruction}

Talking points: exactly ${plan.talkingPointCount}, usable in answers like "why do you want to join this company". Ground them in the research; where a point rests on your own analysis, mark it inferred.

Interviewer questions: exactly ${plan.interviewerQuestionCount}, specific enough that they could only be asked of this company, and each with a short rationale. A question must not assume a fact the research did not establish.

unavailableNotes: list anything a reader should know could not be established.`;
}

/**
 * Cache-hit stage one: search for recent news only. No overview, sector, or
 * deep dive — those already exist in the cache and this call must not
 * re-derive or contradict them.
 */
export function buildNewsResearchPrompt(company: NormalizedCompany): string {
  return `You are researching recent news about a company so an MBA student at SPJIMR can prepare for a campus placement interview with it. This company has already been researched before — you are only finding what is new since then. Do not describe what the company does or classify its sector; that is already known.

Company: "${company.coreName}" (as entered: "${company.requestedName}")

Search the web now for recent developments: strategic moves, deals, results, leadership changes, launches, hiring news — anything from roughly the last few months.

${PLACEMENT_USEFULNESS}

${SOURCE_DISCIPLINE}

Report your findings as prose under these headings:

NO_RESULTS: write "yes" only if you found essentially no recent news. Otherwise write "no".

NEWS: the most placement-useful recent developments you found. For each, give what happened, when, and why an interviewer would expect the candidate to know it.

Attribute claims to the sources you retrieved as you write.`;
}

/**
 * Cache-hit stage two: produce only news, talking points, and interviewer
 * questions. Overview/classification/deep dive/4P are given as established
 * fact, not asked for — this is where most of the cache's token saving
 * comes from.
 */
export function buildCacheStructurePrompt(request: StructureFromCacheRequest): string {
  const { company, cached, newsResearch, plan } = request;

  const establishedSources = cached.sources
    .map((s) => {
      const parts = [`${s.id}: ${s.title}`, s.sourceLabel];
      if (s.date) parts.push(s.date);
      if (s.url) parts.push(s.url);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n");
  const newsSources = newsResearch.sources
    .map((s) => {
      const parts = [`${s.id}: ${s.title}`, s.sourceLabel];
      if (s.date) parts.push(s.date);
      if (s.url) parts.push(s.url);
      return `- ${parts.join(" — ")}`;
    })
    .join("\n");

  const fourPText = cached.fourP
    ? cached.fourP.entries.map((e) => `- ${e.dimension}: ${e.body}`).join("\n")
    : "(4P does not apply to this sector)";

  return `Turn the research below into the news, talking points, and interviewer questions for a placement preparation brief. The company's overview, sector, and deep dive were already established in an earlier search — they are given below as established fact for context, not something you need to reproduce. Return JSON matching the provided schema exactly (news, talkingPoints, interviewerQuestions, unavailableNotes only).

Company as entered: "${company.requestedName}"
Resolved name: "${cached.classification.sector}" sector — "${plan.sectorLabel}"

Established overview: ${cached.overview.body}

Established deep dive ("${plan.deepDiveHeading}"):
${cached.deepDive.topics.map((t) => `- ${t.heading}: ${t.body}`).join("\n") || "(none)"}

Established 4P:
${fourPText}

Established sources (cite by id when a talking point or question directly restates one of these facts):
${establishedSources || "(none)"}

Fresh news sources — cite these by id for anything from the news search below:
${newsSources || "(none retrieved)"}

Recent news research findings:
---
${newsResearch.findings}
---

Rules:

${SOURCE_DISCIPLINE}

Marking sourced versus inferred is the most important judgement here. Mark a claim "sourced" only when a retrieved source (established or fresh) states its substance, and cite the sources that actually state it. Mark it "inferred" when you are drawing the conclusion yourself, and leave sourceIds empty.

Cite at most three sources per claim.

${PLACEMENT_USEFULNESS}

News: give between ${plan.newsMin} and ${plan.newsMax} items from the fresh news research, chosen for placement usefulness. Each needs a whyItMatters. If the news research found nothing relevant, return an empty items array and set news.unavailable to a short sentence saying so — do not invent updates, and do not reuse the established overview or deep dive as if it were news.

Talking points: exactly ${plan.talkingPointCount}, drawing on the established facts and the fresh news together.

Interviewer questions: exactly ${plan.interviewerQuestionCount}, specific to this company, each with a short rationale.

unavailableNotes: list anything a reader should know could not be established.`;
}
