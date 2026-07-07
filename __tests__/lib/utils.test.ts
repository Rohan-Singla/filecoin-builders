import { fixJsonControlChars, buildMemoryContext } from "@/app/lib/utils";
import type { MemoryEntry } from "@/app/types";

describe("fixJsonControlChars", () => {
  it("leaves clean JSON untouched", () => {
    const input = '{"key":"value"}';
    expect(fixJsonControlChars(input)).toBe(input);
  });

  it("escapes newline inside a JSON string value", () => {
    const input = '{"summary":"line one\nline two"}';
    const result = fixJsonControlChars(input);
    expect(result).toBe('{"summary":"line one\\nline two"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("escapes carriage return inside a JSON string value", () => {
    const input = '{"text":"hello\rworld"}';
    const result = fixJsonControlChars(input);
    expect(result).toBe('{"text":"hello\\rworld"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("escapes tab inside a JSON string value", () => {
    const input = '{"text":"col1\tcol2"}';
    const result = fixJsonControlChars(input);
    expect(result).toBe('{"text":"col1\\tcol2"}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("does not escape control chars outside of strings", () => {
    const input = '{\n"key":\n"value"\n}';
    const result = fixJsonControlChars(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ key: "value" });
  });

  it("handles escaped quotes inside strings correctly", () => {
    const input = '{"q":"she said \\"hello\\""}';
    const result = fixJsonControlChars(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).q).toBe('she said "hello"');
  });

  it("handles multiple fields with mixed control chars", () => {
    const input = '{"a":"line\none","b":"tab\there","c":"clean"}';
    const result = fixJsonControlChars(input);
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.a).toBe("line\none");
    expect(parsed.b).toBe("tab\there");
    expect(parsed.c).toBe("clean");
  });
});

describe("buildMemoryContext", () => {
  it("returns empty string message when no entries", () => {
    expect(buildMemoryContext([])).toBe("No previous evidence in memory.");
  });

  it("formats a single entry correctly", () => {
    const entry: MemoryEntry = {
      evidenceId: "abc-123",
      cid: "Qmabc",
      capturedAt: "2024-01-01T00:00:00Z",
      sourceUrl: "https://example.com",
      platform: "Twitter",
      author: "badactor",
      summary: "Threatening post.",
      severity: "high",
      threatType: "harassment",
    };
    const result = buildMemoryContext([entry]);
    expect(result).toContain("[Twitter]");
    expect(result).toContain('"badactor"');
    expect(result).toContain("Threatening post.");
    expect(result).toContain("Severity: high");
    expect(result).toContain("Threat: harassment");
    expect(result).toContain("https://example.com");
  });

  it("uses fileName as source when sourceUrl is null", () => {
    const entry: MemoryEntry = {
      evidenceId: "x",
      cid: "Qmx",
      capturedAt: "",
      sourceUrl: null,
      fileName: "evidence.pdf",
      platform: "PDF",
      author: "Unknown",
      summary: "A document.",
      severity: "low",
      threatType: null,
    };
    const result = buildMemoryContext([entry]);
    expect(result).toContain("evidence.pdf");
    expect(result).toContain("Threat: none");
  });

  it("only includes the last 10 entries", () => {
    const entries: MemoryEntry[] = Array.from({ length: 15 }, (_, i) => ({
      evidenceId: `id-${i}`,
      cid: `Qm${i}`,
      capturedAt: "",
      sourceUrl: `https://example.com/${i}`,
      platform: "Web",
      author: `author${i}`,
      summary: `Summary ${i}`,
      severity: "low" as const,
      threatType: null,
    }));
    const result = buildMemoryContext(entries);
    const lines = result.split("\n");
    expect(lines).toHaveLength(10);
    expect(result).toContain("author5");
    expect(result).not.toContain("author4");
  });

  it("numbers entries starting from 1", () => {
    const entries: MemoryEntry[] = [
      { evidenceId: "a", cid: "Q1", capturedAt: "", sourceUrl: "https://a.com", platform: "A", author: "x", summary: "s1", severity: "low", threatType: null },
      { evidenceId: "b", cid: "Q2", capturedAt: "", sourceUrl: "https://b.com", platform: "B", author: "y", summary: "s2", severity: "medium", threatType: "harassment" },
    ];
    const result = buildMemoryContext(entries);
    expect(result.startsWith("1.")).toBe(true);
    expect(result).toContain("2.");
  });
});
