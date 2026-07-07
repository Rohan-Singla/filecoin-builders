import Groq from "groq-sdk";
import lighthouse from "@lighthouse-web3/sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

function fixJsonControlChars(str: string): string {
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
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

async function fetchSourceContent(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const text = await res.text();
  return text.slice(0, 8000); // cap at 8k chars
}

async function storeOnFilecoin(
  content: string,
  filename: string
): Promise<string> {
  const response = await lighthouse.uploadText(
    content,
    process.env.LIGHTHOUSE_API_KEY!,
    filename
  );
  return response.data.Hash;
}

export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question) return NextResponse.json({ error: "No question" }, { status: 400 });

  const prompt = `You are a research agent. Answer the following question thoroughly with cited sources.

Question: ${question}

IMPORTANT: You must respond with ONLY valid JSON in this exact format:
{
  "answer": "Your detailed research answer here (2-4 paragraphs)",
  "sources": [
    {
      "title": "Source title",
      "url": "https://real-url.com/page",
      "relevance": "Why this source is relevant (1 sentence)"
    }
  ]
}

Rules:
- Provide 3-5 real, working URLs from reputable sources (Wikipedia, academic papers, news sites, official docs)
- URLs must be real and publicly accessible
- Do not wrap in markdown code blocks, return raw JSON only`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });
  const raw = completion.choices[0].message.content?.trim() ?? "";

  let parsed: { answer: string; sources: { title: string; url: string; relevance: string }[] };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    // fix unescaped control chars inside JSON string values
    const fixed = fixJsonControlChars(jsonMatch[0]);
    parsed = JSON.parse(fixed);
  } catch (e) {
    return NextResponse.json({ error: "Failed to parse AI response", raw, parseError: String(e) }, { status: 500 });
  }

  // Store the full research answer on Filecoin
  const answerContent = `Research Question: ${question}\n\nAnswer:\n${parsed.answer}\n\nSources:\n${parsed.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}\n\nTimestamp: ${new Date().toISOString()}`;

  const answerCid = await storeOnFilecoin(answerContent, `research-${Date.now()}.txt`);

  // Fetch and store each source on Filecoin
  const storedSources = await Promise.allSettled(
    parsed.sources.map(async (source) => {
      try {
        const content = await fetchSourceContent(source.url);
        const cid = await storeOnFilecoin(
          `Source: ${source.title}\nURL: ${source.url}\n\n${content}`,
          `source-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
        );
        return { ...source, cid, archived: true };
      } catch {
        return { ...source, cid: null, archived: false };
      }
    })
  );

  const sources = storedSources.map((r) =>
    r.status === "fulfilled" ? r.value : { ...r, cid: null, archived: false }
  );

  return NextResponse.json({ answer: parsed.answer, sources, answerCid });
}
