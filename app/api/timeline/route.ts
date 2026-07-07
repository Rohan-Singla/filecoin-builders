import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function POST(req: NextRequest) {
  const { caseName, evidence } = await req.json();
  if (!evidence?.length) return NextResponse.json({ error: "No evidence provided" }, { status: 400 });

  const evidenceSummaries = evidence.map((e: {
    capturedAt: string;
    sourceUrl: string | null;
    fileName?: string;
    analysis: { platform: string; author: string; contentDate: string; summary: string; keyStatements: string[]; severity: string; threatAssessment: { type: string | null; description: string } };
    cid: string;
  }, i: number) => `
Evidence ${i + 1}:
- Captured: ${e.capturedAt}
- Source: ${e.sourceUrl || e.fileName || "uploaded file"}
- Platform: ${e.analysis.platform}
- Author: ${e.analysis.author}
- Content Date: ${e.analysis.contentDate}
- Summary: ${e.analysis.summary}
- Key statements: ${e.analysis.keyStatements.join("; ")}
- Severity: ${e.analysis.severity}
- Threat type: ${e.analysis.threatAssessment?.type || "none"}
- Threat description: ${e.analysis.threatAssessment?.description || "N/A"}
- Filecoin CID: ${e.cid}
`).join("\n\n");

  const prompt = `You are a legal evidence analyst building a case timeline.

Case name: "${caseName}"

Evidence items (${evidence.length} total):
${evidenceSummaries}

Build a clear, chronological case timeline. Include:
1. A 2-3 sentence case overview
2. A numbered chronological timeline of events with dates
3. Key patterns or escalation you notice
4. Overall assessment of the strength of this evidence
5. Recommended next steps

Write in plain, professional language that could be understood by law enforcement or a lawyer.`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const timeline = completion.choices[0].message.content?.trim() ?? "";
  return NextResponse.json({ timeline });
}
