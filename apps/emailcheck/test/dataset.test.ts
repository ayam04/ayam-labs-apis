import { describe, expect, it } from "vitest";
import blocklist from "../src/data/disposable.json";
import { isDisposableDomain } from "../src/lib/verify";
import { isFreeProvider, isRoleAccount, detectProvider } from "../src/lib/providers";

describe("disposable dataset", () => {
  it("ships a large blocklist", () => {
    expect(blocklist.count).toBeGreaterThan(5000);
  });

  it("detects known disposable domains", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("yopmail.com")).toBe(true);
    expect(isDisposableDomain("gmail.com")).toBe(false);
  });

  it("detects disposable subdomains of a listed domain", () => {
    expect(isDisposableDomain("inbox.mailinator.com")).toBe(true);
  });
});

describe("provider tables", () => {
  it("detects role accounts, including separators", () => {
    expect(isRoleAccount("info")).toBe(true);
    expect(isRoleAccount("no-reply")).toBe(true);
    expect(isRoleAccount("support+eu")).toBe(true);
    expect(isRoleAccount("jane.doe")).toBe(false);
  });

  it("detects free providers", () => {
    expect(isFreeProvider("gmail.com")).toBe(true);
    expect(isFreeProvider("stripe.com")).toBe(false);
  });

  it("fingerprints mail providers from MX", () => {
    expect(detectProvider([{ exchange: "aspmx.l.google.com" }])).toContain("Google");
    expect(detectProvider([{ exchange: "example-com.mail.protection.outlook.com" }])).toContain("Microsoft");
  });
});
