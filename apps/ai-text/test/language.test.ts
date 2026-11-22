import { describe, expect, it } from "vitest";
import { detectLanguage } from "../src/lib/language";

describe("detectLanguage", () => {
  it("detects English", () => {
    const result = detectLanguage("The quick brown fox jumps over the lazy dog and the cat sleeps in the sun.");
    expect(result.language).toBe("en");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.isReliable).toBe(true);
    expect(result.scripts.latin).toBe(1);
  });

  it("detects Spanish", () => {
    const result = detectLanguage("El rápido zorro marrón salta sobre el perro perezoso y el gato duerme al sol.");
    expect(result.language).toBe("es");
  });

  it("detects French", () => {
    const result = detectLanguage("Le renard brun rapide saute par-dessus le chien paresseux et le chat dort au soleil.");
    expect(result.language).toBe("fr");
  });

  it("detects German", () => {
    const result = detectLanguage("Der schnelle braune Fuchs springt über den faulen Hund und die Katze schläft in der Sonne.");
    expect(result.language).toBe("de");
  });

  it("detects Russian from the Cyrillic script", () => {
    const result = detectLanguage("Быстрая коричневая лиса прыгает через ленивую собаку.");
    expect(result.language).toBe("ru");
    expect(result.method).toBe("unicode-script");
    expect(result.scripts.cyrillic).toBeGreaterThan(0.9);
  });

  it("detects Chinese from the Han script", () => {
    const result = detectLanguage("敏捷的棕色狐狸跳过了懒狗。我们需要考虑新政策将如何影响客户。");
    expect(result.language).toBe("zh");
    expect(result.scripts.han).toBeGreaterThan(0.9);
  });

  it("detects Arabic from the Arabic script", () => {
    const result = detectLanguage("الثعلب البني السريع يقفز فوق الكلب الكسول.");
    expect(result.language).toBe("ar");
    expect(result.scripts.arabic).toBeGreaterThan(0.9);
  });

  it("detects Hindi from the Devanagari script", () => {
    const result = detectLanguage("तेज़ भूरी लोमड़ी आलसी कुत्ते के ऊपर कूदती है।");
    expect(result.language).toBe("hi");
    expect(result.scripts.devanagari).toBeGreaterThan(0.9);
  });

  it("returns the top three candidates", () => {
    const result = detectLanguage("The quick brown fox jumps over the lazy dog and the cat sleeps in the sun.");
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0].language).toBe(result.language);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[1].score);
  });

  it("refuses to guess on a single ambiguous word", () => {
    const result = detectLanguage("hello");
    expect(result.language).toBe("unknown");
    expect(result.confidence).toBe(0);
    expect(result.isReliable).toBe(false);
    expect(result.method).toBe("none");
  });
});
