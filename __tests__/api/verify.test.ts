import { POST } from "@/app/api/verify/route";
import { NextRequest } from "next/server";

function makeRequest(body: object): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

const mockEvidence = {
  evidenceId: "abc-123",
  capturedAt: "2024-01-01T00:00:00Z",
  sourceUrl: "https://example.com",
  analysis: { platform: "Web", severity: "low" },
};

describe("POST /api/verify", () => {
  it("returns 400 when CID is missing", async () => {
    const res = await POST(makeRequest({ cid: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when CID field is absent", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns verified result when a gateway responds with JSON evidence", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify(mockEvidence),
    } as unknown as Response);

    const res = await POST(makeRequest({ cid: "QmValidCid123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(true);
    expect(data.data.evidenceId).toBe("abc-123");
    expect(data.gatewayUsed).toContain("QmValidCid123");
  });

  it("returns isRawFile when gateway responds with non-JSON content type", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/pdf" },
      text: async () => "%PDF binary data",
    } as unknown as Response);

    const res = await POST(makeRequest({ cid: "QmPdfCid" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(true);
    expect(data.isRawFile).toBe(true);
    expect(data.contentType).toBe("application/pdf");
  });

  it("returns isRawFile when response is text but not valid JSON", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "text/plain" },
      text: async () => "not json at all",
    } as unknown as Response);

    const res = await POST(makeRequest({ cid: "QmTextCid" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(true);
    expect(data.isRawFile).toBe(true);
  });

  it("returns 404 when all gateways fail", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network error"));

    const res = await POST(makeRequest({ cid: "QmDeadCid" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("Could not retrieve");
  });

  it("returns 404 when all gateways return non-ok status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "text/html" },
    } as unknown as Response);

    const res = await POST(makeRequest({ cid: "QmNotFound" }));
    expect(res.status).toBe(404);
  });

  it("trims whitespace from CID before fetching", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify(mockEvidence),
    } as unknown as Response);

    await POST(makeRequest({ cid: "  QmTrimMe  " }));
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("QmTrimMe");
    expect(calledUrl).not.toContain(" ");
  });

  it("tries multiple gateways in parallel when first fails", async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify(mockEvidence),
      } as unknown as Response);

    const res = await POST(makeRequest({ cid: "QmRetry" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(true);
  });
});
