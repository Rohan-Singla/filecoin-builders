import lighthouse from "@lighthouse-web3/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { cid } = await req.json();
  if (!cid?.trim()) return NextResponse.json({ error: "No CID provided" }, { status: 400 });
  try {
    const info = await lighthouse.getFileInfo(cid.trim());
    return NextResponse.json({ verified: true, info: info.data });
  } catch (e) {
    return NextResponse.json({ error: `Could not fetch file info: ${String(e)}` }, { status: 500 });
  }
}
