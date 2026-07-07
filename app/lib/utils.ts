import type { MemoryEntry } from "@/app/types";

export function fixJsonControlChars(str: string): string {
  let inString = false, escaped = false, result = "";
  for (const ch of str) {
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === "\\") { result += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; result += ch; continue; }
    if (inString && (ch === "\n" || ch === "\r" || ch === "\t")) {
      result += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
      continue;
    }
    result += ch;
  }
  return result;
}

export function buildMemoryContext(entries: MemoryEntry[]): string {
  if (!entries.length) return "No previous evidence in memory.";
  return entries
    .slice(-10)
    .map((e, i) =>
      `${i + 1}. [${e.platform}] by "${e.author}" — ${e.summary} | Severity: ${e.severity} | Threat: ${e.threatType || "none"} | Source: ${e.sourceUrl || e.fileName || "file"}`
    )
    .join("\n");
}
