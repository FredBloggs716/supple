import { describe, it, expect } from "vitest";
import { passwordHash, passwordMatches, timingSafeEqual, tokenHash } from "../src/crypto";

describe("crypto", () => {
  it("hashes and verifies a valid password", async () => {
    const h = await passwordHash("correct horse battery staple");
    expect(h.split("$").length).toBe(3);
    expect(h.startsWith("100000$")).toBe(true);
    expect(await passwordMatches("correct horse battery staple", h)).toBe(true);
    expect(await passwordMatches("wrong password here", h)).toBe(false);
  });

  it("rejects passwords under 12 characters", async () => {
    await expect(passwordHash("short")).rejects.toThrow();
  });

  it("rejects non-string passwords", async () => {
    await expect(passwordHash(12345678901234 as unknown as string)).rejects.toThrow();
  });

  it("passwordMatches returns false on malformed stored value", async () => {
    expect(await passwordMatches("anything", "garbage")).toBe(false);
  });

  it("timingSafeEqual compares correctly", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });

  it("tokenHash is 64 hex chars", async () => {
    expect(await tokenHash("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
});
