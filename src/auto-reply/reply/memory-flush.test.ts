import { describe, expect, it } from "vitest";
import { resolveMemoryFlushPromptForRun } from "./memory-flush.js";

describe("resolveMemoryFlushPromptForRun", () => {
  const cfg = {
    agents: {
      defaults: {
        userTimezone: "America/New_York",
        timeFormat: "12",
      },
    },
  };

  it("replaces YYYY-MM-DD using user timezone and appends current time", () => {
    const prompt = resolveMemoryFlushPromptForRun({
      prompt: "Store durable notes in memory/YYYY-MM-DD.md",
      cfg,
      nowMs: Date.UTC(2026, 1, 16, 15, 0, 0),
    });

    expect(prompt).toContain("memory/2026-02-16.md");
    expect(prompt).toContain("Current time:");
    expect(prompt).toContain("(America/New_York)");
  });

  it("does not append a duplicate current time line", () => {
    const prompt = resolveMemoryFlushPromptForRun({
      prompt: "Store notes.\nCurrent time: already present",
      cfg,
      nowMs: Date.UTC(2026, 1, 16, 15, 0, 0),
    });

    expect(prompt).toContain("Current time: already present");
    expect((prompt.match(/Current time:/g) ?? []).length).toBe(1);
  });
});

describe("memory flush modes", () => {
  it("defaults to reserve-based mode", () => {
    const settings = resolveMemoryFlushSettings();
    expect(settings?.mode).toBe("reserve-based");
  });

  it("resolves token-limit mode from config", () => {
    const settings = resolveMemoryFlushSettings({
      agents: {
        defaults: {
          compaction: {
            memoryFlush: {
              mode: "token-limit",
              contextTokenLimit: 100_000,
            },
          },
        },
      },
    });
    expect(settings?.mode).toBe("token-limit");
    expect(settings?.contextTokenLimit).toBe(100_000);
  });

  it("reserve-based mode uses original threshold logic", () => {
    // Below threshold: should not flush
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 50_000 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "reserve-based",
      }),
    ).toBe(false);

    // At/above threshold: should flush
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 75_000, compactionCount: 1 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "reserve-based",
      }),
    ).toBe(true);
  });

  it("token-limit mode uses absolute contextTokenLimit", () => {
    // Below limit: should not flush
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 90_000 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "token-limit",
        contextTokenLimit: 100_000,
      }),
    ).toBe(false);

    // Above limit: should flush
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 105_000, compactionCount: 1 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "token-limit",
        contextTokenLimit: 100_000,
      }),
    ).toBe(true);
  });

  it("token-limit mode ignores reserve-based parameters", () => {
    // Even with high reserve+softThreshold, token-limit mode is independent
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 105_000, compactionCount: 1 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 50_000,
        softThresholdTokens: 20_000,
        mode: "token-limit",
        contextTokenLimit: 100_000,
      }),
    ).toBe(true);
  });

  it("token-limit mode returns false if contextTokenLimit is invalid", () => {
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 90_000 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "token-limit",
        contextTokenLimit: null,
      }),
    ).toBe(false);

    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 90_000 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "token-limit",
        contextTokenLimit: 0,
      }),
    ).toBe(false);
  });

  it("still respects memoryFlushCompactionCount in both modes", () => {
    // reserve-based with prior flush
    expect(
      shouldRunMemoryFlush({
        entry: {
          totalTokens: 95_000,
          compactionCount: 2,
          memoryFlushCompactionCount: 2,
        },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "reserve-based",
      }),
    ).toBe(false);

    // token-limit with prior flush
    expect(
      shouldRunMemoryFlush({
        entry: {
          totalTokens: 105_000,
          compactionCount: 2,
          memoryFlushCompactionCount: 2,
        },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        mode: "token-limit",
        contextTokenLimit: 100_000,
      }),
    ).toBe(false);
  });

  it("defaults to reserve-based when mode is missing", () => {
    expect(
      shouldRunMemoryFlush({
        entry: { totalTokens: 95_000, compactionCount: 1 },
        contextWindowTokens: 100_000,
        reserveTokensFloor: 20_000,
        softThresholdTokens: 5_000,
        // mode not provided, should default to reserve-based
      }),
    ).toBe(true);
  });
});

describe("default mode resolution", () => {
  it("resolveMemoryFlushSettings defaults mode to reserve-based", () => {
    const settings = resolveMemoryFlushSettings();
    expect(settings?.mode).toBe("reserve-based");
  });

  it("resolveMemoryFlushSettings respects explicit mode in config", () => {
    const settings = resolveMemoryFlushSettings({
      agents: {
        defaults: {
          compaction: {
            memoryFlush: {
              mode: "token-limit",
              contextTokenLimit: 100_000,
            },
          },
        },
      },
    });
    expect(settings?.mode).toBe("token-limit");
  });
});
