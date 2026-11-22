/**
 * Cloudflare Workers AI helpers.
 *
 * Everything in this file treats the AI binding as unreliable by design:
 *  - the binding is missing in local dev and on accounts without Workers AI,
 *  - models time out, rate limit or return malformed text.
 *
 * Callers therefore get either a clean string or an ApiError with status 503 and
 * code AI_UNAVAILABLE. A model failure never becomes a 500.
 */
import { ApiError } from "@api/core";

/**
 * Default chat model.
 *
 * Gemma 4 26B A4B is a mixture-of-experts model with only ~4B active parameters
 * per token, so it is cheap per call but follows formatting instructions far
 * better than a small dense model. It replaced @cf/meta/llama-3.1-8b-instruct,
 * which Cloudflare deprecated on 2026-05-30 (the alias resolved to a retired
 * backing model and every call failed). Verify with: wrangler ai models
 */
export const CHAT_MODEL = "@cf/openai/gpt-oss-20b";

/** Multilingual translation model (M2M100, 100 languages). */
export const TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";

export interface WorkersAiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** Hard cap on generated tokens; clamped to 64..1024. */
  maxTokens?: number;
  /** Sampling temperature; clamped to 0..0.6. */
  temperature?: number;
}

const AI_HINT =
  "This endpoint needs the Workers AI binding. Call it against a deployed worker with the [ai] binding enabled, or use the deterministic endpoints (/v1/keywords, /v1/entities, /v1/sentiment, /v1/detect-language, /v1/readability), which never need a model.";

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return ("workers-ai: " + message).replace(/\s+/g, " ").slice(0, 180);
}

/** Throws the documented 503 when a model call is impossible or failed. */
export function aiUnavailable(detail?: string): ApiError {
  return new ApiError(503, "AI_UNAVAILABLE", "Workers AI is not available for this request", {
    details: detail,
    hint: AI_HINT,
  });
}

export function requireAi(binding: WorkersAiBinding | undefined): WorkersAiBinding {
  if (!binding || typeof binding.run !== "function") throw aiUnavailable("binding missing");
  return binding;
}

function extractChatText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const record = result as Record<string, unknown>;

  // Classic Workers AI shape: { response: "..." }
  if (typeof record.response === "string") return record.response;
  // OpenAI-compatible shape returned by newer models: { choices: [{ message: { content } }] }
  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown> | undefined;
    if (first) {
      const message = first.message as Record<string, unknown> | undefined;
      if (message && typeof message.content === "string") return message.content;
      if (typeof first.text === "string") return first.text;
    }
  }
  // Some model versions wrap the payload again: { result: { response } }
  const nested = record.result;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    if (typeof inner.response === "string") return inner.response;
  }
  if (typeof record.output_text === "string") return record.output_text;
  if (typeof record.text === "string") return record.text;
  return "";
}

function extractTranslatedText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (typeof record.translated_text === "string") return record.translated_text;
    if (typeof record.response === "string") return record.response;
  }
  return "";
}

/** Removes markdown fence markers and stray fence lines from model output. */
function stripFences(text: string): string {
  if (!/\x60{3}/.test(text)) return text;
  return text.replace(/\x60{3}[a-zA-Z0-9_-]*\n?/g, "").trim();
}

/**
 * Removes markdown fences, a leading "Summary:" style label and extra blank
 * lines from model output. Never returns a raw model envelope.
 */
export function cleanModelText(raw: string): string {
  let text = stripFences(raw.trim());
  text = text.replace(
    /^(?:summary|summarised text|summarized text|rewritten text|rewrite|translation|translated text|output|answer)\s*:\s*/i,
    "",
  );
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/** Returns the first JSON object embedded in model output, or null. */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

/**
 * Splits long input on sentence or paragraph boundaries into chunks no longer
 * than maxChars. A single over-long sentence is cut at a space, and only as a
 * last resort mid-word.
 */
export function chunkText(text: string, maxChars: number): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (maxChars < 100) throw new Error("maxChars must be at least 100");
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    let cut = maxChars;
    const sentenceEnd = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("\n\n"),
    );
    if (sentenceEnd > maxChars * 0.5) cut = sentenceEnd + 1;
    else {
      const space = window.lastIndexOf(" ");
      if (space > maxChars * 0.5) cut = space;
    }
    const piece = remaining.slice(0, cut).trim();
    if (piece) chunks.push(piece);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function runModel(
  binding: WorkersAiBinding | undefined,
  model: string,
  inputs: Record<string, unknown>,
): Promise<unknown> {
  const ai = requireAi(binding);
  try {
    return await ai.run(model, inputs);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", api: "ai-text", model, message: shortError(error) }));
    throw aiUnavailable(shortError(error));
  }
}

/** Runs a chat completion and returns cleaned text. Throws 503 on any failure. */
export async function chat(
  binding: WorkersAiBinding | undefined,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<string> {
  const maxTokens = Math.max(64, Math.min(1024, Math.floor(options.maxTokens ?? 256)));
  const temperature = Math.max(0, Math.min(0.6, options.temperature ?? 0.3));
  const result = await runModel(binding, CHAT_MODEL, { messages, max_tokens: maxTokens, temperature, stream: false });
  let text = cleanModelText(extractChatText(result));

  // Some models on Workers AI ignore the chat `messages` array and only accept a
  // plain `prompt` string. Retrying once with a flattened prompt keeps the API
  // working across model swaps instead of hard failing.
  if (!text) {
    const prompt = messages.map((message) => message.content).join("\n\n");
    const fallback = await runModel(binding, CHAT_MODEL, { prompt, max_tokens: maxTokens, temperature });
    text = cleanModelText(extractChatText(fallback));
  }

  if (!text) throw aiUnavailable("empty model response");
  return text;
}

/** Runs M2M100 translation. Throws 503 on any failure. */
export async function translate(
  binding: WorkersAiBinding | undefined,
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string> {
  const result = await runModel(binding, TRANSLATE_MODEL, {
    text,
    source_lang: sourceLanguage,
    target_lang: targetLanguage,
  });
  const output = cleanModelText(extractTranslatedText(result));
  if (!output) throw aiUnavailable("empty translation response");
  return output;
}

const SUMMARY_STYLE_INSTRUCTION: Readonly<Record<string, string>> = {
  paragraph: "Write the summary as one short paragraph of plain prose.",
  bullets: "Write the summary as 3 to 6 short bullet points, each starting with '- '.",
};

export function buildSummaryMessages(text: string, maxWords: number, style: "bullets" | "paragraph"): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You summarise text for a paid API. Reply with the summary only: no preamble, no headings, no markdown fences, no commentary. Never invent facts that are not in the text.",
    },
    {
      role: "user",
      content:
        "Summarise the text below in at most " +
        maxWords +
        " words. " +
        (SUMMARY_STYLE_INSTRUCTION[style] ?? SUMMARY_STYLE_INSTRUCTION.paragraph) +
        "\n\nTEXT:\n" +
        text,
    },
  ];
}

export function buildReduceMessages(
  partialSummaries: string[],
  maxWords: number,
  style: "bullets" | "paragraph",
): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You merge partial summaries into one summary for a paid API. Reply with the summary only: no preamble, no markdown fences, no commentary.",
    },
    {
      role: "user",
      content:
        "Merge the " +
        partialSummaries.length +
        " partial summaries below into a single summary of at most " +
        maxWords +
        " words. " +
        (SUMMARY_STYLE_INSTRUCTION[style] ?? SUMMARY_STYLE_INSTRUCTION.paragraph) +
        "\n\nPARTIAL SUMMARIES:\n" +
        partialSummaries.map((summary, index) => index + 1 + ". " + summary).join("\n"),
    },
  ];
}

const TONE_INSTRUCTION: Readonly<Record<string, string>> = {
  professional: "Use a clear, professional tone suitable for business writing.",
  casual: "Use a relaxed, conversational tone.",
  concise: "Keep it as short as possible while keeping the meaning. Cut filler.",
  friendly: "Use a warm, friendly tone that still reads as competent.",
};

export function buildRewriteMessages(text: string, tone: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You rewrite text for a paid API. Keep the meaning, do not add facts, do not translate. Answer exactly in this format:\nREWRITTEN:\n<the rewritten text>\nNOTES:\n- <one short note>\n- <another short note, or omit>",
    },
    {
      role: "user",
      content:
        "Rewrite the text below. " +
        (TONE_INSTRUCTION[tone] ?? TONE_INSTRUCTION.professional) +
        "\n\nTEXT:\n" +
        text,
    },
  ];
}

export function buildClassifyMessages(text: string, labels: string[]): ChatMessage[] {
  const labelList = labels.map((label) => JSON.stringify(label)).join(", ");
  const scoreShape = labels.map((label) => JSON.stringify(label) + ": <number 0 to 1>").join(", ");
  return [
    {
      role: "system",
      content:
        "You are a zero-shot classifier for a paid API. You always answer with a single JSON object and nothing else.",
    },
    {
      role: "user",
      content:
        "Classify the text into exactly one of these labels: " +
        labelList +
        ". Reply with JSON shaped like {\"label\": \"<one of the labels>\", \"confidence\": <number 0 to 1>, \"scores\": {" +
        scoreShape +
        "}}. Use only the given labels.\n\nTEXT:\n" +
        text,
    },
  ];
}

export interface RewriteOutput {
  rewrittenText: string;
  notes: string[];
}

/** Splits the REWRITTEN / NOTES answer format. Falls back to the whole text. */
export function parseRewriteOutput(raw: string): RewriteOutput {
  const text = raw.trim();
  const notesMatch = /(?:^|\n)\s*NOTES\s*:\s*\n?([\s\S]*)$/i.exec(text);
  let rewrittenText = notesMatch ? text.slice(0, notesMatch.index) : text;
  rewrittenText = rewrittenText.replace(/^\s*REWRITTEN\s*:\s*\n?/i, "").trim();
  if (!rewrittenText) rewrittenText = text;
  let notes: string[] = [];
  if (notesMatch) {
    notes = notesMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 5);
  }
  return { rewrittenText, notes };
}

export interface ClassificationScore {
  label: string;
  score: number;
}

export interface ClassificationOutput {
  scores: ClassificationScore[];
  choice: string;
  confidence: number;
  /** "model" when the model returned numeric scores, "choice-only" when it only named a label. */
  scoreSource: "model" | "choice-only";
}

/**
 * Parses the classifier answer. Labels the model invented are ignored. When the
 * model returns no usable numbers, the chosen label scores 1 and the rest 0 and
 * scoreSource says so, instead of pretending to know a distribution.
 */
export function parseClassificationOutput(raw: string, labels: string[]): ClassificationOutput {
  const json = extractJsonObject(raw);
  const lowerLabels = new Map(labels.map((label) => [label.toLowerCase(), label]));
  const numeric = new Map<string, number>();

  const addNumeric = (label: string, value: unknown): void => {
    const canonical = lowerLabels.get(label.toLowerCase());
    if (!canonical || typeof value !== "number" || !Number.isFinite(value)) return;
    numeric.set(canonical, Math.max(0, Math.min(1, value)));
  };

  let namedChoice = "";
  if (json) {
    for (const [key, value] of Object.entries(json)) {
      if (key === "scores" && value && typeof value === "object" && !Array.isArray(value)) {
        for (const [label, score] of Object.entries(value as Record<string, unknown>)) addNumeric(label, score);
      } else if (key !== "label" && key !== "confidence") {
        addNumeric(key, value);
      }
    }
    if (typeof json.label === "string") namedChoice = lowerLabels.get(json.label.toLowerCase()) ?? "";
  }

  if (!namedChoice) {
    const lowered = raw.toLowerCase();
    namedChoice = labels.find((label) => lowered.includes(label.toLowerCase())) ?? "";
  }

  let scores: ClassificationScore[];
  let scoreSource: ClassificationOutput["scoreSource"] = "model";
  const positive = [...numeric.entries()].filter(([, value]) => value > 0);
  if (positive.length === 0) {
    scoreSource = "choice-only";
    const fallback = namedChoice || labels[0] || "";
    scores = labels.map((label) => ({ label, score: label === fallback ? 1 : 0 }));
  } else {
    const total = positive.reduce((sum, [, value]) => sum + value, 0);
    scores = labels.map((label) => ({ label, score: (numeric.get(label) ?? 0) / total }));
  }

  scores.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const best = scores[0];
  const choice = namedChoice || (best ? best.label : "");
  let confidence = best ? best.score : 0;
  if (namedChoice) {
    const entry = scores.find((score) => score.label === namedChoice);
    if (entry) confidence = entry.score;
  }
  return { scores, choice, confidence: Math.round(confidence * 1000) / 1000, scoreSource };
}
