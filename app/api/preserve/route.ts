import Groq from "groq-sdk";
import lighthouse from "@lighthouse-web3/sdk";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { AgentMemory, MemoryEntry } from "@/app/types";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const GATEWAYS = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://dweb.link/ipfs/${cid}`,
  (cid: string) => `https://gateway.lighthouse.storage/ipfs/${cid}`,
];

function fixJsonControlChars(str: string): string {
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

async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Could not fetch URL: ${res.status}`);
  return (await res.text()).slice(0, 12000);
}

async function captureScreenshot(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=false`,
      { signal: AbortSignal.timeout(12000) }
    );
    const data = await res.json();
    const screenshotUrl = data?.data?.screenshot?.url;
    if (!screenshotUrl) return null;
    const imgRes = await fetch(screenshotUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const response = await lighthouse.uploadBuffer(imgBuffer, process.env.LIGHTHOUSE_API_KEY!);
    return response.data.Hash;
  } catch { return null; }
}

// Fetch existing agent memory from Filecoin — try Lighthouse first (fastest for fresh uploads)
async function fetchMemory(memoryCid: string): Promise<AgentMemory> {
  const ordered = [
    `https://gateway.lighthouse.storage/ipfs/${memoryCid}`,
    `https://ipfs.io/ipfs/${memoryCid}`,
    `https://cloudflare-ipfs.com/ipfs/${memoryCid}`,
    `https://dweb.link/ipfs/${memoryCid}`,
  ];
  for (const url of ordered) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json();
    } catch { continue; }
  }
  return { version: 0, updatedAt: "", totalEvidence: 0, entries: [] };
}

// Store updated memory on Filecoin and return new CID
async function storeMemory(memory: AgentMemory): Promise<string> {
  const response = await lighthouse.uploadText(
    JSON.stringify(memory, null, 2),
    process.env.LIGHTHOUSE_API_KEY!,
    "agent-memory.json"
  );
  return response.data.Hash;
}

function buildMemoryContext(entries: MemoryEntry[]): string {
  if (!entries.length) return "No previous evidence in memory.";
  return entries
    .slice(-10) // last 10 items to keep prompt manageable
    .map((e, i) =>
      `${i + 1}. [${e.platform}] by "${e.author}" — ${e.summary} | Severity: ${e.severity} | Threat: ${e.threatType || "none"} | Source: ${e.sourceUrl || e.fileName || "file"}`
    )
    .join("\n");
}

async function analyzeContent(
  content: string,
  source: string,
  context: string,
  isFile: boolean,
  memoryContext: string
) {
  const prompt = `You are a digital evidence analyst with persistent memory of past evidence.

Source: ${source}
User context: ${context || "No additional context provided"}

AGENT MEMORY (${memoryContext === "No previous evidence in memory." ? "empty" : "previous evidence"}):
${memoryContext}
END MEMORY

New content to analyze:
${content}

Respond with ONLY valid JSON:
{
  "platform": "Platform or file type name",
  "author": "Author/username or 'Unknown'",
  "contentDate": "Date posted/created or 'Unknown'",
  "summary": "2-3 sentence factual summary of the new content",
  "keyStatements": ["statement 1", "statement 2", "statement 3"],
  "contentType": "social media post / article / image / document / etc.",
  "severity": "low | medium | high",
  "threatAssessment": {
    "isThreatening": true or false,
    "type": "harassment | defamation | scam | misinformation | hate speech | null",
    "description": "One sentence describing the nature of the threat or why it is not threatening",
    "recommendedAction": "What the victim should do next"
  },
  "memoryInsight": "If memory contains ANY previous evidence, always write a brief observation — same author, same platform, related topic, escalating severity, or simply that this is evidence item N in an ongoing case. Only return null if memory is completely empty."
}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  });

  const raw = completion.choices[0].message.content?.trim() ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  return JSON.parse(fixJsonControlChars(jsonMatch[0]));
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  // File upload
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) || "";
    const memoryCid = (formData.get("memoryCid") as string) || "";
    const memoryDataRaw = formData.get("memoryData") as string | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isText = file.type.startsWith("text/") || file.name.endsWith(".txt");

    let contentForAI: string;
    if (isImage) {
      contentForAI = `Uploaded image file: "${file.name}" (${file.type}, ${(file.size / 1024).toFixed(1)} KB). User context: ${context || "none"}.`;
    } else if (isPDF) {
      try {
        const pdfData = await pdfParse(fileBuffer);
        const text = pdfData.text.trim().slice(0, 12000);
        contentForAI = text.length > 50
          ? `PDF document: "${file.name}"\n\nExtracted text:\n${text}`
          : `PDF file: "${file.name}" — text extraction returned minimal content. File size: ${(file.size / 1024).toFixed(1)} KB.`;
      } catch {
        contentForAI = `PDF file: "${file.name}" (${(file.size / 1024).toFixed(1)} KB) — could not extract text. User context: ${context || "none"}.`;
      }
    } else if (isText) {
      contentForAI = fileBuffer.toString("utf-8").slice(0, 12000);
    } else {
      // Word docs, unknown binary files — describe by name/size
      contentForAI = `Uploaded file: "${file.name}" (${file.type || "unknown type"}, ${(file.size / 1024).toFixed(1)} KB). User context: ${context || "none"}.`;
    }

    const memory: AgentMemory = (memoryDataRaw ? JSON.parse(memoryDataRaw) : null) ||
      (memoryCid ? await fetchMemory(memoryCid) : { version: 0, updatedAt: "", totalEvidence: 0, entries: [] });
    const memoryContext = buildMemoryContext(memory.entries);

    let analysis;
    try { analysis = await analyzeContent(contentForAI, file.name, context, true, memoryContext); }
    catch { return NextResponse.json({ error: "Failed to analyze file" }, { status: 500 }); }

    const evidenceId = randomUUID();
    const capturedAt = new Date().toISOString();

    let cid: string;
    try {
      const response = await lighthouse.uploadBuffer(fileBuffer, process.env.LIGHTHOUSE_API_KEY!);
      cid = response.data.Hash;
    } catch (e) {
      return NextResponse.json({ error: `Filecoin storage failed: ${String(e)}` }, { status: 500 });
    }

    // Update memory on Filecoin
    const newEntry: MemoryEntry = {
      evidenceId, cid, capturedAt, sourceUrl: null, fileName: file.name,
      platform: analysis.platform, author: analysis.author, summary: analysis.summary,
      severity: analysis.severity, threatType: analysis.threatAssessment?.type || null,
    };
    const updatedMemory: AgentMemory = {
      version: memory.version + 1,
      updatedAt: capturedAt,
      totalEvidence: memory.totalEvidence + 1,
      entries: [...memory.entries, newEntry],
    };
    const newMemoryCid = await storeMemory(updatedMemory);

    return NextResponse.json({
      evidenceId, capturedAt, sourceUrl: null,
      fileName: file.name, fileType: file.type, fileSize: file.size,
      screenshotCid: null, analysis, cid,
      gateways: GATEWAYS.map((g) => g(cid)),
      newMemoryCid, updatedMemory,
    });
  }

  // URL: memoryData is sent directly from client cache; memoryCid is the verifiable Filecoin record.
  const { url, context, memoryCid, memoryData } = await req.json();
  if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  let rawContent: string;
  try { rawContent = await fetchUrlContent(url); }
  catch (e) { return NextResponse.json({ error: `Failed to fetch URL: ${String(e)}` }, { status: 400 }); }

  const memory: AgentMemory = memoryData || (memoryCid ? await fetchMemory(memoryCid) : { version: 0, updatedAt: "", totalEvidence: 0, entries: [] });

  const [screenshotCid] = await Promise.all([
    captureScreenshot(url),
  ]);

  const memoryContext = buildMemoryContext(memory.entries);

  let analysis;
  try { analysis = await analyzeContent(rawContent, url, context, false, memoryContext); }
  catch { return NextResponse.json({ error: "Failed to analyze content" }, { status: 500 }); }

  const evidenceId = randomUUID();
  const capturedAt = new Date().toISOString();

  const evidencePackage = {
    evidenceId, capturedAt, sourceUrl: url,
    userContext: context || null,
    analysis, rawContent, screenshotCid,
    integrity: {
      method: "Filecoin/IPFS content addressing",
      note: "CID is a cryptographic hash. Tampering produces a different CID.",
    },
  };

  let cid: string;
  try {
    const response = await lighthouse.uploadText(
      JSON.stringify(evidencePackage, null, 2),
      process.env.LIGHTHOUSE_API_KEY!,
      `evidence-${evidenceId}.json`
    );
    cid = response.data.Hash;
  } catch (e) {
    return NextResponse.json({ error: `Filecoin storage failed: ${String(e)}` }, { status: 500 });
  }

  // Update agent memory on Filecoin
  const newEntry: MemoryEntry = {
    evidenceId, cid, capturedAt, sourceUrl: url,
    platform: analysis.platform, author: analysis.author, summary: analysis.summary,
    severity: analysis.severity, threatType: analysis.threatAssessment?.type || null,
  };
  const updatedMemory: AgentMemory = {
    version: memory.version + 1,
    updatedAt: capturedAt,
    totalEvidence: memory.totalEvidence + 1,
    entries: [...memory.entries, newEntry],
  };
  const newMemoryCid = await storeMemory(updatedMemory);

  return NextResponse.json({
    evidenceId, capturedAt, sourceUrl: url,
    screenshotCid, analysis, cid,
    gateways: GATEWAYS.map((g) => g(cid)),
    newMemoryCid, updatedMemory,
  });
}
