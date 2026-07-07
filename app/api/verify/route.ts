import { NextRequest, NextResponse } from "next/server";

const GATEWAYS = [
  (cid: string) => `https://gateway.lighthouse.storage/ipfs/${cid}`,
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://dweb.link/ipfs/${cid}`,
];

async function tryGateway(url: string): Promise<{ verified: true; data: unknown; isRawFile?: boolean; contentType?: string; gatewayUsed: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status}`);

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json") || contentType.includes("text")) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { verified: true, data, gatewayUsed: url };
    } catch {
      return { verified: true, data: null, isRawFile: true, contentType, gatewayUsed: url };
    }
  }

  return { verified: true, data: null, isRawFile: true, contentType, gatewayUsed: url };
}

export async function POST(req: NextRequest) {
  const { cid } = await req.json();
  if (!cid?.trim()) return NextResponse.json({ error: "No CID provided" }, { status: 400 });

  const trimmed = cid.trim();

  try {
    const result = await Promise.any(GATEWAYS.map((g) => tryGateway(g(trimmed))));
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Could not retrieve this CID from any IPFS gateway. It may still be propagating, try again in a few minutes." },
      { status: 404 }
    );
  }
}
