import { describe, expect, it } from "vitest";
import { checkProfanity, lexiconTerms, normalizeWord, squeezeRuns } from "../src/lib/profanity";

describe("normalisation", () => {
  it("folds accents and leetspeak", () => {
    expect(normalizeWord("SCH1T")).toBe("schit");
    expect(normalizeWord("coño")).toBe("cono");
    expect(normalizeWord("@ss")).toBe("ass");
    expect(normalizeWord("scheiße")).toBe("scheisse");
  });

  it("squeezes long runs only", () => {
    expect(squeezeRuns("fuuuck", 3)).toBe("fuck");
    expect(squeezeRuns("ass", 3)).toBe("ass");
    expect(squeezeRuns("assss", 3)).toBe("as");
    expect(squeezeRuns("assss", 2)).toBe("as");
  });
});

describe("english matching", () => {
  it("flags plain profanity with the right severity and a masked term", () => {
    const result = checkProfanity("this is fucked up");
    expect(result.isProfane).toBe(true);
    expect(result.matches[0].term).toBe("fucked");
    expect(result.matches[0].severity).toBe("high");
    expect(result.matches[0].masked).toBe("f*****");
    expect(result.matches[0].snippet).toContain("f*****");
  });

  it("reads through leetspeak", () => {
    const result = checkProfanity("what a sh1t show");
    expect(result.matches[0].term).toBe("shit");
    expect(result.matches[0].obfuscated).toBe(true);
  });

  it("reads through repeated letters", () => {
    expect(checkProfanity("fuuuuuck this").matches[0].term).toBe("fuck");
    expect(checkProfanity("shiiiiiit").matches[0].term).toBe("shit");
  });

  it("reads through single character separators", () => {
    const result = checkProfanity("that is f.u.c.k.ing awful");
    expect(result.isProfane).toBe(true);
    expect(result.matches[0].term).toBe("fucking");
    expect(result.matches[0].obfuscated).toBe(true);
    expect(result.matches[0].matched).toBe("f.u.c.k.ing");
  });

  it("matches inflected forms", () => {
    expect(checkProfanity("bitching about it").matches[0].term).toBe("bitching");
    expect(checkProfanity("bitches be quiet").matches[0].term).toBe("bitch");
    expect(checkProfanity("motherfuckers").matches[0].term).toBe("motherfucker");
    expect(checkProfanity("fuckhead").matches[0].term).toBe("fuck");
  });

  it("does not fire on innocent words that contain a term", () => {
    expect(checkProfanity("the classic assignment is done").isProfane).toBe(false);
    expect(checkProfanity("a grassy hellscape photo").isProfane).toBe(false);
    expect(checkProfanity("what the hell").matches.map((match) => match.term)).toEqual(["hell"]);
    expect(checkProfanity("cocktail and classy bass").isProfane).toBe(false);
  });

  it("scores by severity and counts matches", () => {
    const result = checkProfanity("damn this shit, fuck");
    expect(result.counts.low).toBe(1);
    expect(result.counts.medium).toBe(1);
    expect(result.counts.high).toBe(1);
    expect(result.score).toBe(85);
    expect(result.highestSeverity).toBe("high");
  });
});

describe("other languages", () => {
  it("needs the language enabled", () => {
    expect(checkProfanity("esto es mierda").isProfane).toBe(false);
    expect(checkProfanity("esto es mierda", ["es"]).matches[0].term).toBe("mierda");
  });

  it("matches french and german terms with accents", () => {
    expect(checkProfanity("c'est de la merde", ["fr"]).matches[0].term).toBe("merde");
    expect(checkProfanity("so ein Scheiße", ["de"]).matches[0].term).toBe("scheisse");
    expect(checkProfanity("enculé", ["fr"]).matches[0].severity).toBe("high");
  });

  it("screens several languages at once", () => {
    const result = checkProfanity("merde and shit", ["en", "fr"]);
    expect(result.matches).toHaveLength(2);
    expect(result.languages).toEqual(["en", "fr"]);
  });

  it("ships four lexicons and no duplicates", () => {
    for (const lang of ["en", "es", "fr", "de"] as const) {
      const terms = lexiconTerms(lang);
      expect(terms.length).toBeGreaterThan(15);
      expect(new Set(terms).size).toBe(terms.length);
    }
  });
});

describe("clean text", () => {
  it("returns an empty result", () => {
    const result = checkProfanity("Thanks for the quarterly report, it looks good.");
    expect(result.isProfane).toBe(false);
    expect(result.matches).toHaveLength(0);
    expect(result.highestSeverity).toBeNull();
    expect(result.score).toBe(0);
    expect(result.counts).toEqual({ low: 0, medium: 0, high: 0 });
  });
});
