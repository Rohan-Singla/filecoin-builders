import { POST } from "@/app/api/timeline/route";
import { NextRequest } from "next/server";

jest.mock("groq-sdk", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: "1. Jan 1 — First incident recorded.\n2. Jan 5 — Escalation observed." } }],
        }),
      },
    },
  }));
});

function makeRequest(body: object): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const sampleEvidence = [
  {
    capturedAt: "2024-01-01T00:00:00Z",
    sourceUrl: "https://example.com/post1",
    fileName: undefined,
    analysis: {
      platform: "Twitter",
      author: "badactor",
      contentDate: "2024-01-01",
      summary: "Threatening message sent.",
      keyStatements: ["I will find you"],
      severity: "high",
      threatAssessment: { type: "harassment", description: "Direct threat." },
    },
    cid: "QmEvidence1",
  },
  {
    capturedAt: "2024-01-05T00:00:00Z",
    sourceUrl: "https://example.com/post2",
    fileName: undefined,
    analysis: {
      platform: "Twitter",
      author: "badactor",
      contentDate: "2024-01-05",
      summary: "Follow-up threatening message.",
      keyStatements: ["You cannot hide"],
      severity: "high",
      threatAssessment: { type: "harassment", description: "Escalation." },
    },
    cid: "QmEvidence2",
  },
];

describe("POST /api/timeline", () => {
  it("returns 400 when evidence array is missing", async () => {
    const res = await POST(makeRequest({ caseName: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when evidence array is empty", async () => {
    const res = await POST(makeRequest({ caseName: "Test", evidence: [] }));
    expect(res.status).toBe(400);
  });

  it("returns a timeline string for valid evidence", async () => {
    const res = await POST(makeRequest({ caseName: "Harassment Case", evidence: sampleEvidence }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.timeline).toBe("string");
    expect(data.timeline.length).toBeGreaterThan(0);
  });

  it("passes case name and evidence details to the AI prompt", async () => {
    const groqModule = jest.requireMock("groq-sdk");
    const mockCreate = groqModule.mock.results[0]?.value?.chat?.completions?.create;

    await POST(makeRequest({ caseName: "Stalking Case", evidence: sampleEvidence }));

    if (mockCreate) {
      const call = mockCreate.mock.calls[0];
      const prompt = call[0].messages[0].content as string;
      expect(prompt).toContain("Stalking Case");
      expect(prompt).toContain("badactor");
    }
  });

  it("uses uploaded file name as source when sourceUrl is null", async () => {
    const fileEvidence = [{
      ...sampleEvidence[0],
      sourceUrl: null,
      fileName: "screenshot.png",
    }];
    const res = await POST(makeRequest({ caseName: "File Case", evidence: fileEvidence }));
    expect(res.status).toBe(200);
  });
});
