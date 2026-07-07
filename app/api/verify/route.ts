import { NextRequest, NextResponse } from "next/server";

const GATEWAYS = [
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://dweb.link/ipfs/${cid}`,
];

export async function POST(req: NextRequest) {
  const { cid } = await req.json();
  if (!cid?.trim()) return NextResponse.json({ error: "No CID provided" }, { status: 400 });

  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(gateway(cid), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "";

      // If it's JSON (a text-preserved evidence package)
      if (contentType.includes("application/json") || contentType.includes("text")) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          return NextResponse.json({ verified: true, data, gatewayUsed: gateway(cid) });
        } catch {
          // Not JSON — might be a raw file (image/PDF)
          return NextResponse.json({
            verified: true,
            data: null,
            isRawFile: true,
            contentType,
            gatewayUsed: gateway(cid),
          });
        }
      }

      return NextResponse.json({
        verified: true,
        data: null,
        isRawFile: true,
        contentType,
        gatewayUsed: gateway(cid),
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Could not retrieve this CID from any IPFS gateway. It may still be propagating — try again in a few minutes." }, { status: 404 });
}
