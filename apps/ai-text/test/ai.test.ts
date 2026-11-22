import { describe, expect, it } from "vitest";
import { ApiError } from "@api/core";
import {
  CHAT_MODEL,
  TRANSLATE_MODEL,
  buildClassifyMessages,
  buildSummaryMessages,
  chunkText,
  cleanModelText,
  extractJsonObject,
  parseClassificationOutput,
  parseRewriteOutput,
  requireAi,
  type WorkersAiBinding,
} from "../src/lib/ai";

describe("models", () => {
  it("pins a chat-compatible model and the m2m100 translator", () => {
    // llama-3.1-8b-instruct was deprecated by Cloudflare on 2026-05-30.
    expect(CHAT_MODEL).toBe("@cf/openai/gpt-oss-20b");
    expect(TRANSLATE_MODEL).toBe("@cf/meta/m2m100-1.2b");
  });
});

describe("requireAi", () => {
  it("throws a documented 503 when the binding is missing", () => {
    try {
      requireAi(undefined);
      throw new Error("expected requireAi to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(503);
      expect(apiError.code).toBe("AI_UNAVAILABLE");
      expect(apiError.hint).toBeTruthy();
    }
  });

  it("returns a usable binding", () => {
    const binding: WorkersAiBinding = { run: async () => ({ response: "ok" }) };
    expect(requireAi(binding)).toBe(binding);
  });
});

describe("cleanModelText", () => {
  it("removes markdown fences", () => {
    expect(cleanModelText("\x60\x60\x60text\nhello world\n\x60\x60\x60")).toBe("hello world");
  });

  it("removes a leading label", () => {
    expect(cleanModelText("Summary: The cat sat.")).toBe("The cat sat.");
    expect(cleanModelText("Translation: Hola")).toBe("Hola");
  });

  it("collapses blank line runs", () => {
    expect(cleanModelText("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("extractJsonObject", () => {
  it("pulls the first object out of prose", () => {
    expect(extractJsonObject("sure thing {\"label\": \"billing\"} done")).toEqual({ label: "billing" });
  });

  it("returns null for broken JSON", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("{broken")).toBeNull();
  });
});

describe("chunkText", () => {
  it("returns a single chunk when the text fits", () => {
    expect(chunkText("short text", 200)).toEqual(["short text"]);
  });

  it("splits long text without exceeding the limit", () => {
    const sentence = "This is one sentence in a longer document. ";
    const text = sentence.repeat(40);
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(200);
    expect(chunks.join(" ")).toContain("longer document");
  });

  it("returns nothing for empty input", () => {
    expect(chunkText("   ", 200)).toEqual([]);
  });
});

describe("parseRewriteOutput", () => {
  it("splits the rewritten text from the notes", () => {
    const result = parseRewriteOutput("REWRITTEN:\nThe release is ready.\nNOTES:\n- tightened wording\n- kept the facts");
    expect(result.rewrittenText).toBe("The release is ready.");
    expect(result.notes).toEqual(["tightened wording", "kept the facts"]);
  });

  it("falls back to the whole answer", () => {
    const result = parseRewriteOutput("Just the rewritten text.");
    expect(result.rewrittenText).toBe("Just the rewritten text.");
    expect(result.notes).toEqual([]);
  });
});

describe("parseClassificationOutput", () => {
  it("normalises model scores and sorts them", () => {
    const raw = "{\"label\": \"billing\", \"confidence\": 0.8, \"scores\": {\"billing\": 0.8, \"shipping\": 0.2}}";
    const result = parseClassificationOutput(raw, ["billing", "shipping"]);
    expect(result.choice).toBe("billing");
    expect(result.scoreSource).toBe("model");
    expect(result.scores[0].label).toBe("billing");
    expect(result.scores[0].score).toBeCloseTo(0.8, 4);
    expect(result.scores.reduce((sum, entry) => sum + entry.score, 0)).toBeCloseTo(1, 6);
    expect(result.confidence).toBeCloseTo(0.8, 4);
  });

  it("falls back to choice only when the model returns no numbers", () => {
    const result = parseClassificationOutput("I would say billing.", ["billing", "shipping"]);
    expect(result.choice).toBe("billing");
    expect(result.scoreSource).toBe("choice-only");
    expect(result.scores[0]).toEqual({ label: "billing", score: 1 });
  });

  it("ignores labels the model invented", () => {
    const raw = "{\"label\": \"refunds\", \"scores\": {\"refunds\": 0.9, \"billing\": 0.1}}";
    const result = parseClassificationOutput(raw, ["billing", "shipping"]);
    expect(result.scores.map((entry) => entry.label).sort()).toEqual(["billing", "shipping"]);
    expect(result.choice).not.toBe("refunds");
  });
});

describe("prompt builders", () => {
  it("caps the summary length in the prompt and keeps the text", () => {
    const messages = buildSummaryMessages("Some input text.", 60, "bullets");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("at most 60 words");
    expect(messages[1].content).toContain("bullet");
    expect(messages[1].content).toContain("Some input text.");
  });

  it("lists every label in the classification prompt", () => {
    const messages = buildClassifyMessages("text", ["billing", "shipping"]);
    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain("\"billing\"");
    expect(messages[1].content).toContain("\"shipping\"");
    expect(messages[1].content).toContain("TEXT:");
  });
});
