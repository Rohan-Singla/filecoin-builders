import { POST } from "@/app/api/preserve/route";
import { NextRequest } from "next/server";

const MOCK_CID = "QmMockedCid123";

const MOCK_ANALYSIS = {
  platform: "Twitter",
  author: "testuser",
  contentDate: "2024-01-01",
  summary: "A threatening post was found.",
  keyStatements: ["Statement one"],
  contentType: "social media post",
  severity: "high",
  threatAssessment: {
    isThreatening: true,
    type: "harassment",
    description: "Direct harassment.",
    recommendedAction: "Contact law enforcement.",
  },
  memoryInsight: null,
};

jest.mock("groq-sdk", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async () => ({
          choices: [{ message: { content: '{"platform":"Twitter","author":"testuser","contentDate":"2024-01-01","summary":"A threatening post was found.","keyStatements":["Statement one"],"contentType":"social media post","severity":"high","threatAssessment":{"isThreatening":true,"type":"harassment","description":"Direct harassment.","recommendedAction":"Contact law enforcement."},"memoryInsight":null}' } }],
        })),
      },
    },
  })),
}));

jest.mock("@lighthouse-web3/sdk", () => ({
  __esModule: true,
  default: {
    uploadText: jest.fn().mockResolvedValue({ data: { Hash: "QmMockedCid123" } }),
    uploadBuffer: jest.fn().mockResolvedValue({ data: { Hash: "QmMockedCid123" } }),
  },
}));

jest.mock("pdf-parse/lib/pdf-parse", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ text: "Extracted PDF text content for testing purposes." }),
}));

function makeJsonRequest(body: object): NextRequest {
  return {
    headers: { get: (k: string) => k === "content-type" ? "application/json" : null },
    json: async () => body,
  } as unknown as NextRequest;
}

function makeFormRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new Map(Object.entries(fields));
  return {
    headers: { get: (k: string) => k === "content-type" ? "multipart/form-data; boundary=xxx" : null },
    formData: async () => ({ get: (k: string) => formData.get(k) ?? null }),
  } as unknown as NextRequest;
}

function makeFile(name: string, type: string, content: string | Buffer): File {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;
  return {
    name,
    type,
    size: buffer.length,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  } as unknown as File;
}

describe("POST /api/preserve — URL mode", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "Page content from Jina reader",
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { screenshot: { url: "https://screenshot.example.com/img.png" } } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100),
      } as unknown as Response);
  });

  it("returns 400 when URL is missing", async () => {
    const res = await POST(makeJsonRequest({ url: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when URL field is absent", async () => {
    const res = await POST(makeJsonRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns evidence result with correct shape for a valid URL", async () => {
    const res = await POST(makeJsonRequest({ url: "https://example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.evidenceId).toBeDefined();
    expect(data.capturedAt).toBeDefined();
    expect(data.cid).toBe(MOCK_CID);
    expect(data.analysis.platform).toBe("Twitter");
    expect(data.analysis.severity).toBe("high");
    expect(Array.isArray(data.gateways)).toBe(true);
    expect(data.gateways).toHaveLength(4);
    expect(data.newMemoryCid).toBe(MOCK_CID);
  });

  it("returns sourceUrl matching the input URL", async () => {
    const res = await POST(makeJsonRequest({ url: "https://twitter.com/test" }));
    const data = await res.json();
    expect(data.sourceUrl).toBe("https://twitter.com/test");
  });

  it("includes updatedMemory with incremented version", async () => {
    const existingMemory = { version: 2, updatedAt: "", totalEvidence: 2, entries: [] };
    const res = await POST(makeJsonRequest({ url: "https://example.com", memoryData: existingMemory }));
    const data = await res.json();
    expect(data.updatedMemory.version).toBe(3);
    expect(data.updatedMemory.totalEvidence).toBe(3);
  });

  it("returns 400 when Jina fetch fails", async () => {
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403 });
    const res = await POST(makeJsonRequest({ url: "https://blocked.example.com" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Failed to fetch URL");
  });

  it("gateways array contains the stored CID", async () => {
    const res = await POST(makeJsonRequest({ url: "https://example.com" }));
    const data = await res.json();
    for (const gateway of data.gateways) {
      expect(gateway).toContain(MOCK_CID);
    }
  });
});

describe("POST /api/preserve — file upload mode", () => {
  it("returns 400 when no file is attached", async () => {
    const res = await POST(makeFormRequest({ context: "test" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No file");
  });

  it("handles image upload and returns evidence result", async () => {
    const file = makeFile("screenshot.png", "image/png", "fake png bytes");
    const res = await POST(makeFormRequest({ file, context: "harassment screenshot" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fileName).toBe("screenshot.png");
    expect(data.fileType).toBe("image/png");
    expect(data.cid).toBe(MOCK_CID);
  });

  it("handles PDF upload and returns evidence result", async () => {
    const file = makeFile("evidence.pdf", "application/pdf", "%PDF-1.4 fake content");
    const res = await POST(makeFormRequest({ file, context: "legal document" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fileName).toBe("evidence.pdf");
    expect(data.cid).toBe(MOCK_CID);
  });

  it("detects PDF by .pdf extension even with wrong MIME type", async () => {
    const file = makeFile("doc.pdf", "application/octet-stream", "%PDF fake");
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fileName).toBe("doc.pdf");
  });

  it("handles plain text file upload", async () => {
    const file = makeFile("log.txt", "text/plain", "Line 1\nLine 2\nLine 3");
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cid).toBe(MOCK_CID);
  });

  it("handles unknown binary file without crashing", async () => {
    const file = makeFile("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "binary content");
    const res = await POST(makeFormRequest({ file }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fileName).toBe("report.docx");
  });

  it("uses provided memoryData directly without fetching from gateway", async () => {
    const memoryData = JSON.stringify({ version: 5, updatedAt: "", totalEvidence: 5, entries: [] });
    const file = makeFile("photo.jpg", "image/jpeg", "fake jpeg");
    const res = await POST(makeFormRequest({ file, memoryData }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updatedMemory.version).toBe(6);
    expect(data.updatedMemory.totalEvidence).toBe(6);
  });

  it("file upload result has null sourceUrl", async () => {
    const file = makeFile("img.png", "image/png", "fake");
    const res = await POST(makeFormRequest({ file }));
    const data = await res.json();
    expect(data.sourceUrl).toBeNull();
  });

  it("file upload result has no screenshotCid", async () => {
    const file = makeFile("img.png", "image/png", "fake");
    const res = await POST(makeFormRequest({ file }));
    const data = await res.json();
    expect(data.screenshotCid).toBeNull();
  });
});

describe("POST /api/preserve — agent memory", () => {
  beforeEach(() => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => "content" } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { screenshot: null } }) } as unknown as Response);
  });

  it("starts memory at version 1 when no prior memory", async () => {
    const res = await POST(makeJsonRequest({ url: "https://example.com" }));
    const data = await res.json();
    expect(data.updatedMemory.version).toBe(1);
    expect(data.updatedMemory.totalEvidence).toBe(1);
    expect(data.updatedMemory.entries).toHaveLength(1);
  });

  it("appends new entry with correct fields to memory", async () => {
    const res = await POST(makeJsonRequest({ url: "https://example.com/post" }));
    const data = await res.json();
    const entry = data.updatedMemory.entries[0];
    expect(entry.cid).toBe(MOCK_CID);
    expect(entry.sourceUrl).toBe("https://example.com/post");
    expect(entry.platform).toBe("Twitter");
    expect(entry.severity).toBe("high");
    expect(entry.threatType).toBe("harassment");
  });
});
