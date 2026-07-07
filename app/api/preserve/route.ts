import Groq from "groq-sdk";
import lighthouse from "@lighthouse-web3/sdk";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

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
  } catch {
    return null;
  }
}

async function analyzeContent(content: string, source: string, context: string, isFile: boolean) {
  const prompt = `You are a digital evidence analyst. Analyze this ${isFile ? "uploaded file" : "web page"} content.

Source: ${source}
User context: ${context || "No additional context provided"}

Content:
${content}

Respond with ONLY valid JSON:
{
  "platform": "Platform or file type name",
  "author": "Author/username or 'Unknown'",
  "contentDate": "Date posted/created or 'Unknown'",
  "summary": "2-3 sentence factual summary",
  "keyStatements": ["statement 1", "statement 2", "statement 3"],
  "contentType": "social media post / article / image / document / etc.",
  "severity": "low | medium | high",
  "threatAssessment": {
    "isThreatening": true or false,
    "type": "harassment | defamation | scam | misinformation | hate speech | null",
    "description": "One sentence describing the nature of the threat or why it's not threatening",
    "recommendedAction": "What the victim should do next (report to platform, contact police, consult lawyer, etc.)"
  }
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

  // --- File upload path ---
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const context = (formData.get("context") as string) || "";
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith("image/");
    const contentForAI = isImage
      ? `Uploaded image: "${file.name}" (${file.type}, ${(file.size / 1024).toFixed(1)} KB). User context: ${context || "none"}.`
      : fileBuffer.toString("utf-8").slice(0, 12000);

    let analysis;
    try { analysis = await analyzeContent(contentForAI, file.name, context, true); }
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

    return NextResponse.json({
      evidenceId, capturedAt, sourceUrl: null,
      fileName: file.name, fileType: file.type, fileSize: file.size,
      screenshotCid: null,
      analysis, cid,
      gateways: GATEWAYS.map((g) => g(cid)),
    });
  }

  // --- URL path ---
  const { url, context } = await req.json();
  if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  let rawContent: string;
  try { rawContent = await fetchUrlContent(url); }
  catch (e) { return NextResponse.json({ error: `Failed to fetch URL: ${String(e)}` }, { status: 400 }); }

  // Screenshot + analysis in parallel
  const [analysis, screenshotCid] = await Promise.all([
    analyzeContent(rawContent, url, context, false).catch(() => null),
    captureScreenshot(url),
  ]);

  if (!analysis) return NextResponse.json({ error: "Failed to analyze content" }, { status: 500 });

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

  return NextResponse.json({
    evidenceId, capturedAt, sourceUrl: url,
    screenshotCid,
    analysis, cid,
    gateways: GATEWAYS.map((g) => g(cid)),
  });
}
