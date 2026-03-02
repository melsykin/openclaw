import { describe, expect, it } from "vitest";
import { isBillingErrorMessage, isContextOverflowError } from "./pi-embedded-helpers.js";

describe("isBillingErrorMessage", () => {
  it("matches credit / payment failures", () => {
    const samples = [
      "Your credit balance is too low to access the Anthropic API.",
      "insufficient credits",
      "Payment Required",
      "HTTP 402 Payment Required",
      "plans & billing",
      "status: 402",
      "error code 402",
      '{"status":402,"type":"error"}',
    ];
    for (const sample of samples) {
      expect(isBillingErrorMessage(sample)).toBe(true);
    }
  });

  it("ignores unrelated errors", () => {
    expect(isBillingErrorMessage("rate limit exceeded")).toBe(false);
    expect(isBillingErrorMessage("invalid api key")).toBe(false);
    expect(isBillingErrorMessage("timeout")).toBe(false);
  });

  it("does NOT match context overflow errors", () => {
    const overflowSamples = [
      "context overflow: prompt too large",
      "context length exceeded",
      "prompt is too long",
      "exceeds model context window",
      "request_too_large",
      "request size exceeds maximum",
    ];
    for (const sample of overflowSamples) {
      expect(isBillingErrorMessage(sample), `"${sample}" should NOT be classified as billing`).toBe(
        false,
      );
    }
  });

  it("does not false-positive on issue IDs or text containing 402", () => {
    const falsePositives = [
      "Fixed issue CHE-402 in the latest release",
      "See ticket #402 for details",
      "ISSUE-402 has been resolved",
      "Room 402 is available",
      "Error code 403 was returned, not 402-related",
      "The building at 402 Main Street",
      "processed 402 records",
      "402 items found in the database",
      "port 402 is open",
      "Use a 402 stainless bolt",
      "Book a 402 room",
      "There is a 402 near me",
    ];
    for (const sample of falsePositives) {
      expect(isBillingErrorMessage(sample), `"${sample}" should NOT be classified as billing`).toBe(
        false,
      );
    }
  });

  it("still matches real HTTP 402 billing errors", () => {
    const realErrors = [
      "HTTP 402 Payment Required",
      "status: 402",
      "error code 402",
      "http 402",
      "status=402 payment required",
      "got a 402 from the API",
      "returned 402",
      "received a 402 response",
      '{"status":402,"type":"error"}',
      '{"code":402,"message":"payment required"}',
      '{"error":{"code":402,"message":"billing hard limit reached"}}',
    ];
    for (const sample of realErrors) {
      expect(isBillingErrorMessage(sample), `"${sample}" SHOULD be classified as billing`).toBe(
        true,
      );
    }
  });

  it("distinguishes between overflow and billing (critical regression)", () => {
    // This is the critical test case for the regression
    const overflowButNot402 = [
      "Request exceeds the maximum size limit. Context overflow.",
      "Prompt length exceeded: 130000 tokens, max is 128000",
      "Context window exceeded error: model can only accept 8192 tokens",
    ];

    const billingWith402 = [
      "Error 402: insufficient credits to run model",
      "HTTP 402 Payment Required: your billing plan has been exhausted",
    ];

    // Overflow samples should NOT be billing
    for (const sample of overflowButNot402) {
      expect(isBillingErrorMessage(sample), `Overflow "${sample}" misclassified as billing!`).toBe(
        false,
      );
    }

    // Billing samples SHOULD be billing
    for (const sample of billingWith402) {
      expect(isBillingErrorMessage(sample), `Billing "${sample}" NOT recognized!`).toBe(true);
    }
  });
});

describe("isContextOverflowError integration", () => {
  it("overflow errors are correctly identified separately", () => {
    const overflowErrors = [
      "context overflow: prompt too large",
      "context length exceeded",
      "Request exceeds the maximum size limit",
    ];

    for (const sample of overflowErrors) {
      expect(isContextOverflowError(sample), `"${sample}" should be overflow`).toBe(true);
      expect(
        isBillingErrorMessage(sample),
        `"${sample}" should NOT be billing if it's overflow`,
      ).toBe(false);
    }
  });
});
