import { describe, expect, it } from "vitest";
import { SPAM_THRESHOLDS, scoreSpam } from "../src/lib/spam";

const ids = (text: string) => scoreSpam(text).signals.map((signal) => signal.id);

describe("clean text", () => {
  it("scores a normal message at zero", () => {
    const result = scoreSpam("Thanks for your order. It ships tomorrow by courier.");
    expect(result.score).toBe(0);
    expect(result.band).toBe("clean");
    expect(result.isSpam).toBe(false);
    expect(result.signals).toHaveLength(0);
    expect(result.thresholds).toEqual(SPAM_THRESHOLDS);
  });

  it("does not fire on a single link", () => {
    expect(ids("Docs are at https://example.com/docs")).not.toContain("link_count");
  });
});

describe("individual signals", () => {
  it("measures exclamation density", () => {
    expect(ids("Great news!!! It works!!! Amazing!!!")).toContain("exclamation_density");
  });

  it("measures the ALL CAPS ratio", () => {
    const result = scoreSpam("BUY NOW AND SAVE BIG ON EVERYTHING IN THE STORE TODAY");
    expect(result.signals.find((signal) => signal.id === "caps_ratio")?.points).toBeGreaterThan(0);
  });

  it("counts links and shortener hosts", () => {
    expect(ids("a https://one.example/x b https://two.example/y")).toContain("link_count");
    expect(ids("see https://bit.ly/abc")).toContain("shortener_link");
    expect(ids("see https://example.com/abc")).not.toContain("shortener_link");
  });

  it("spots prize and urgency wording", () => {
    expect(ids("You have won the lottery")).toContain("money_prize");
    expect(ids("Act now, last chance")).toContain("urgency");
  });

  it("spots credential phishing and crypto scams", () => {
    expect(ids("Please verify your account")).toContain("phishing_request");
    expect(ids("double your bitcoin with our airdrop")).toContain("crypto_scam");
  });

  it("counts emoji and repeated characters", () => {
    expect(ids("wow 😀😀😀 amazing")).toContain("emoji_density");
    expect(ids("sooooo goooood!!!!")).toContain("repeated_chars");
  });

  it("flags a phone number combined with a link", () => {
    expect(ids("call 555-123-4567 or see https://example.com")).toContain("phone_plus_link");
    expect(ids("call 555-123-4567")).not.toContain("phone_plus_link");
  });

  it("reports weight and evidence for every contributing signal", () => {
    const result = scoreSpam("see https://bit.ly/abc");
    const shortener = result.signals.find((signal) => signal.id === "shortener_link");
    expect(shortener?.weight).toBe(14);
    expect(shortener?.points).toBe(10);
    expect(shortener?.evidence).toContain("bit.ly");
  });
});

describe("bands", () => {
  it("lands in suspicious for medium pressure", () => {
    const result = scoreSpam("ACT NOW!!! Limited time offer. Write to us.");
    expect(result.score).toBeGreaterThanOrEqual(25);
    expect(result.score).toBeLessThan(60);
    expect(result.band).toBe("suspicious");
    expect(result.isSpam).toBe(false);
  });

  it("lands in spam for a full pitch", () => {
    const result = scoreSpam(
      "WIN a $1000 gift card NOW!!! Verify your account at https://bit.ly/xk9 and call 555-123-4567. TODAY ONLY! double your bitcoin, guaranteed profit!!!",
    );
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.band).toBe("spam");
    expect(result.isSpam).toBe(true);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("caps the score at 100", () => {
    const result = scoreSpam(
      "WIN!!! FREE MONEY!!! https://bit.ly/a https://bit.ly/b https://t.co/c ACT NOW!!! LAST CHANCE!!! verify your account!!! double your bitcoin airdrop!!!" +
        " phone 555-123-4567 😀😀😀😀😀 aaaaaaa",
    );
    expect(result.score).toBe(100);
  });

  it("reports feature counts", () => {
    const features = scoreSpam("Hi!!! https://bit.ly/x 555-123-4567").features;
    expect(features.characters).toBeGreaterThan(20);
    expect(features.links).toBe(1);
    expect(features.shortenerLinks).toBe(1);
    expect(features.exclamations).toBe(3);
    expect(features.hasPhone).toBe(true);
  });
});
