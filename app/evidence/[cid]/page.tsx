"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import type { EvidenceResult } from "@/app/types";


const SEV: Record<string, { dot: string; badge: string }> = {
  low: { dot: "bg-sky-400", badge: "border-sky-400/30 text-sky-400" },
  medium: { dot: "bg-amber-400", badge: "border-amber-400/30 text-amber-400" },
  high: { dot: "bg-red-500", badge: "border-red-500/30 text-red-400" },
};

const GATEWAYS = [
  (cid: string) => `https://gateway.lighthouse.storage/ipfs/${cid}`,
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://dweb.link/ipfs/${cid}`,
];

function FallbackImage({ cid, alt, className }: { cid: string; alt: string; className?: string }) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (gatewayIndex + 1 < GATEWAYS.length) {
      setGatewayIndex(gatewayIndex + 1);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div className="w-full py-10 flex items-center justify-center text-xs text-white/30">
        Screenshot unavailable — all gateways failed
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={GATEWAYS[gatewayIndex](cid)} alt={alt} className={className} onError={handleError} />;
}

async function fetchFromGateways(cid: string): Promise<EvidenceResult | null> {
  for (const gateway of GATEWAYS) {
    try {
      const res = await fetch(gateway(cid), { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json") || contentType.includes("text")) {
          const data = await res.json();
          if (data?.evidenceId) return data;
        }
      }
    } catch { continue; }
  }
  return null;
}

export default function EvidencePage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = use(params);
  const [evidence, setEvidence] = useState<EvidenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"cache" | "gateway" | null>(null);

  useEffect(() => {
    async function load() {
      // Check localStorage first
      try {
        const stored = localStorage.getItem("evidence-history");
        if (stored) {
          const history: EvidenceResult[] = JSON.parse(stored);
          const cached = history.find((h) => h.cid === cid);
          if (cached) { setEvidence(cached); setSource("cache"); setLoading(false); return; }
        }
      } catch { /* ignore parse errors */ }

      // Fall back to IPFS gateways
      const data = await fetchFromGateways(cid);
      if (data) { setEvidence(data); setSource("gateway"); }
      setLoading(false);
    }
    load();
  }, [cid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
        <div className="text-center space-y-3">
          <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white/40">Retrieving evidence from Filecoin...</p>
        </div>
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-white flex items-center justify-center" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
        <div className="text-center space-y-3 max-w-sm px-6">
          <p className="text-sm font-medium text-white/60">Evidence not found</p>
          <p className="text-xs text-white/30">This CID could not be retrieved from any IPFS gateway. Content may still be propagating — try again in a few minutes.</p>
          <code className="block text-[10px] text-white/20 font-mono break-all mt-2">{cid}</code>
        </div>
      </div>
    );
  }

  const { evidenceId, capturedAt, sourceUrl, fileName, analysis, screenshotCid } = evidence;
  const sev = SEV[analysis?.severity] || SEV.medium;

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <header className="border-b border-white/[0.06] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L21 7V17L12 22L3 17V7L12 2Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
            <path d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z" fill="white" opacity="0.9"/>
            <path d="M15.5 9C14.7 8.1 13.4 7.5 12 7.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
          </svg>
          <span className="text-sm font-semibold tracking-tight">Verity</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">Verified on Filecoin</span>
        </div>
      </header>

      <div className="max-w-[680px] mx-auto px-6 py-12 space-y-4">
        <div className="mb-8">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Evidence Certificate</p>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-white/40 font-mono break-all">{evidenceId}</p>
            <div className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-2 py-1 rounded border ${sev.badge}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
              {analysis?.severity?.toUpperCase()}
            </div>
          </div>
        </div>

        {screenshotCid && (
          <div className="overflow-hidden rounded-lg border border-white/[0.07]">
            <p className="text-[10px] text-white/25 uppercase tracking-widest px-3 pt-3 pb-2">Screenshot — Stored on Filecoin</p>
            <FallbackImage cid={screenshotCid} alt="Evidence screenshot" className="w-full" />
          </div>
        )}

        <div className="rounded-lg border border-white/[0.07] divide-y divide-white/[0.05]">
          <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
            <Cell label="Platform" value={analysis?.platform} />
            <Cell label="Content Type" value={analysis?.contentType} />
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
            <Cell label="Author" value={analysis?.author} />
            <Cell label="Content Date" value={analysis?.contentDate} />
          </div>
          <Cell label="Captured (UTC)" value={new Date(capturedAt).toUTCString()} />
          {sourceUrl && (
            <div className="px-4 py-3">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Source URL</p>
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 hover:text-white break-all">{sourceUrl}</a>
            </div>
          )}
          {fileName && !sourceUrl && (
            <Cell label="File" value={fileName} />
          )}
          <div className="px-4 py-3">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Summary</p>
            <p className="text-xs text-white/70 leading-relaxed">{analysis?.summary}</p>
          </div>
          {analysis?.keyStatements?.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Key Statements</p>
              {analysis.keyStatements.map((s: string, i: number) => (
                <div key={i} className="border-l border-white/20 pl-3">
                  <p className="text-xs text-white/60 italic">{s}</p>
                </div>
              ))}
            </div>
          )}
          {analysis?.threatAssessment && (
            <div className={`px-4 py-3 ${analysis.threatAssessment.isThreatening ? "bg-red-500/[0.04]" : ""}`}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Threat Assessment</p>
              {analysis.threatAssessment.isThreatening ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">{analysis.threatAssessment.type}</p>
                  <p className="text-xs text-white/60">{analysis.threatAssessment.description}</p>
                  <p className="text-xs text-amber-400">Recommendation: {analysis.threatAssessment.recommendedAction}</p>
                </div>
              ) : (
                <p className="text-xs text-white/40">{analysis.threatAssessment.description}</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.07] divide-y divide-white/[0.05]">
          <div className="px-4 py-3">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Content ID (CID)</p>
            <code className="text-xs text-emerald-400 font-mono break-all">{cid}</code>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] text-white/25 leading-relaxed">
              {source === "cache"
                ? "Evidence retrieved from local session. CID is a cryptographic hash — any tampering produces a different CID."
                : "The CID is a cryptographic hash of this evidence package. Any tampering would produce a different CID, making falsification detectable."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs text-white/70">{value}</p>
    </div>
  );
}
