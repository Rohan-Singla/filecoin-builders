"use client";

import { useState, useRef, useEffect } from "react";
import type { EvidenceResult, Case } from "./types";
import { Logo } from "./components/Logo";

const SEVERITY_STYLE = {
  low: { dot: "bg-sky-400", label: "text-sky-400", badge: "border-sky-400/30 text-sky-400" },
  medium: { dot: "bg-amber-400", label: "text-amber-400", badge: "border-amber-400/30 text-amber-400" },
  high: { dot: "bg-red-500", label: "text-red-400", badge: "border-red-500/30 text-red-400" },
};

type SeverityKey = keyof typeof SEVERITY_STYLE;

export default function Home() {
  const [activeTab, setActiveTab] = useState<"preserve" | "verify" | "cases">("preserve");
  const [preserveMode, setPreserveMode] = useState<"url" | "file" | "batch">("url");

  const [url, setUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [context, setContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState<EvidenceResult | null>(null);
  const [batchResults, setBatchResults] = useState<EvidenceResult[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");

  const [verifyCid, setVerifyCid] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; data: EvidenceResult | null; isRawFile?: boolean; contentType?: string; gatewayUsed: string } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [cases, setCases] = useState<Case[]>([]);
  const [newCaseName, setNewCaseName] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timeline, setTimeline] = useState<string | null>(null);
  const [assignCaseId, setAssignCaseId] = useState("");

  const [history, setHistory] = useState<EvidenceResult[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [memoryCid, setMemoryCid] = useState<string | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [memoryData, setMemoryData] = useState<object | null>(null);
  const [memoryChain, setMemoryChain] = useState<{ version: number; cid: string; updatedAt: string; totalEvidence: number }[]>([]);
  const [memoryChainOpen, setMemoryChainOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = localStorage.getItem("evidence-history");
    if (h) setHistory(JSON.parse(h));
    const c = localStorage.getItem("evidence-cases");
    if (c) setCases(JSON.parse(c));
    const m = localStorage.getItem("agent-memory-cid");
    if (m) setMemoryCid(m);
    const mc = localStorage.getItem("agent-memory-count");
    if (mc) setMemoryCount(parseInt(mc));
    const md = localStorage.getItem("agent-memory-data");
    if (md) setMemoryData(JSON.parse(md));
    const mh = localStorage.getItem("agent-memory-chain");
    if (mh) setMemoryChain(JSON.parse(mh));
  }, []);

  function saveHistory(items: EvidenceResult[]) { setHistory(items); localStorage.setItem("evidence-history", JSON.stringify(items)); }
  function saveCases(items: Case[]) { setCases(items); localStorage.setItem("evidence-cases", JSON.stringify(items)); }
  function addToHistory(item: EvidenceResult) { saveHistory([item, ...history]); }

  function saveMemory(cid: string, count: number, data: object & { version?: number; updatedAt?: string; totalEvidence?: number }) {
    setMemoryCid(cid);
    setMemoryCount(count);
    setMemoryData(data);
    localStorage.setItem("agent-memory-cid", cid);
    localStorage.setItem("agent-memory-count", String(count));
    localStorage.setItem("agent-memory-data", JSON.stringify(data));
    const entry = { version: data.version ?? count, cid, updatedAt: data.updatedAt ?? new Date().toISOString(), totalEvidence: data.totalEvidence ?? count };
    setMemoryChain((prev) => {
      const next = [...prev.filter((e) => e.cid !== cid), entry].sort((a, b) => a.version - b.version);
      localStorage.setItem("agent-memory-chain", JSON.stringify(next));
      return next;
    });
  }

  async function handlePreserve(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null); setError("");
    try {
      let res: Response;
      if (preserveMode === "file" && file) {
        setStep("Uploading file...");
        const fd = new FormData();
        fd.append("file", file); fd.append("context", context);
        if (memoryCid) fd.append("memoryCid", memoryCid);
        if (memoryData) fd.append("memoryData", JSON.stringify(memoryData));
        res = await fetch("/api/preserve", { method: "POST", body: fd });
      } else {
        setStep("Fetching content...");
        await new Promise((r) => setTimeout(r, 400));
        setStep("Analyzing with agent memory...");
        res = await fetch("/api/preserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, context, memoryCid, memoryData }) });
      }
      setStep("Archiving to Filecoin...");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data); addToHistory(data);
      if (data.newMemoryCid) saveMemory(data.newMemoryCid, memoryCount + 1, data.updatedMemory);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setLoading(false); setStep(""); }
  }

  async function handleBatch(e: React.FormEvent) {
    e.preventDefault();
    const urls = batchUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setLoading(true); setError(""); setBatchResults([]); setBatchProgress({ current: 0, total: urls.length });
    const results: EvidenceResult[] = [];
    for (let i = 0; i < urls.length; i++) {
      setStep(`${i + 1} / ${urls.length}`);
      setBatchProgress({ current: i + 1, total: urls.length });
      try {
        const res = await fetch("/api/preserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urls[i], context, memoryCid }) });
        const data = await res.json();
        if (res.ok) { results.push(data); addToHistory(data); }
      } catch { /* continue */ }
      setBatchResults([...results]);
    }
    setLoading(false); setStep("");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyLoading(true); setVerifyResult(null); setVerifyError("");
    const trimmed = verifyCid.trim();
    try {
      // Check local cache first — evidence is stored here immediately after preservation
      const cached = history.find((h) => h.cid === trimmed);
      if (cached) {
        setVerifyResult({ verified: true, data: cached, gatewayUsed: "local-cache" });
        return;
      }
      const res = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cid: trimmed }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerifyResult(data);
    } catch (err: unknown) { setVerifyError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setVerifyLoading(false); }
  }

  function createCase() {
    if (!newCaseName.trim()) return;
    const c: Case = { id: crypto.randomUUID(), name: newCaseName.trim(), createdAt: new Date().toISOString(), evidenceIds: [] };
    saveCases([c, ...cases]); setNewCaseName("");
  }

  function assignToCase(evidenceId: string, caseId: string) {
    saveCases(cases.map((c) => c.id === caseId && !c.evidenceIds.includes(evidenceId) ? { ...c, evidenceIds: [...c.evidenceIds, evidenceId] } : c));
  }

  function removeFromCase(evidenceId: string, caseId: string) {
    saveCases(cases.map((c) => c.id === caseId ? { ...c, evidenceIds: c.evidenceIds.filter((id) => id !== evidenceId) } : c));
  }

  async function buildTimeline(caseItem: Case) {
    const evidence = history.filter((h) => caseItem.evidenceIds.includes(h.evidenceId));
    if (!evidence.length) return;
    setTimelineLoading(true); setTimeline(null);
    try {
      const res = await fetch("/api/timeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseName: caseItem.name, evidence }) });
      const data = await res.json();
      setTimeline(data.timeline);
    } finally { setTimelineLoading(false); }
  }

  function copyText(text: string) { navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(null), 2000); }
  function downloadCert(r: EvidenceResult) {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `evidence-${r.evidenceId.slice(0, 8)}.json`; a.click();
  }

  const selectedCase = cases.find((c) => c.id === selectedCaseId);
  const caseEvidence = selectedCase ? history.filter((h) => selectedCase.evidenceIds.includes(h.evidenceId)) : [];

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col">

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-20 bg-[#0c0c0c] border-b border-white/[0.06] h-14 no-print shrink-0">
        <div className="max-w-[1280px] mx-auto px-5 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={20} />
          <span className="text-sm font-semibold tracking-tight">Verity</span>
          <span className="text-xs text-white/40 uppercase tracking-widest border border-white/10 px-1.5 py-0.5 rounded hidden sm:inline">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          {memoryCid && (
            <button onClick={() => setMemoryChainOpen((o) => !o)}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Memory: {memoryCount} items</span>
              <span className="sm:hidden text-xs">Mem</span>
              <span className="text-white/40 text-xs">{memoryChainOpen ? "▲" : "▼"}</span>
            </button>
          )}
          <span className="text-sm text-white/50 hidden sm:inline">Filecoin</span>
        </div>
        </div>
      </header>

      {/* ===== SPLIT BODY ===== */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 max-w-[1280px] mx-auto w-full">

        {/* ===== LEFT PANEL — input / navigation ===== */}
        <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.06] lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
          <div className="p-5 lg:p-6">

            {/* Title */}
            <div className="mb-7 no-print">
              <h1 className="text-xl font-semibold tracking-tight mb-1.5">Permanent proof, on Filecoin.</h1>
              <p className="text-sm text-white/60 leading-relaxed">
                Capture and archive digital evidence.<br />
                Tamper-proof. Cryptographically verifiable.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/[0.07] mb-6 no-print">
              {(["preserve", "verify", "cases"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-white text-white font-medium" : "border-transparent text-white/50 hover:text-white/80"}`}>
                  {tab === "preserve" ? "Preserve" : tab === "verify" ? "Verify CID" : "Cases"}
                </button>
              ))}
            </div>

            {/* ===== PRESERVE form ===== */}
            {activeTab === "preserve" && (
              <div>
                <div className="flex gap-2 mb-5">
                  {(["url", "file", "batch"] as const).map((m) => (
                    <button key={m} onClick={() => { setPreserveMode(m); setFile(null); setResult(null); setError(""); setBatchResults([]); }}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${preserveMode === m ? "bg-white text-black" : "bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.09]"}`}>
                      {m === "url" ? "URL" : m === "file" ? "File" : "Batch"}
                    </button>
                  ))}
                </div>

                {preserveMode === "url" && (
                  <form onSubmit={handlePreserve} className="space-y-3">
                    <Field label="URL to preserve">
                      <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://" disabled={loading} required className="input-base" />
                    </Field>
                    <Field label="Context" hint="optional">
                      <input type="text" value={context} onChange={(e) => setContext(e.target.value)}
                        placeholder="e.g. harassment, scam..." disabled={loading} className="input-base" />
                    </Field>
                    <PrimaryButton loading={loading} step={step} label="Preserve Evidence" disabled={!url.trim()} />
                  </form>
                )}

                {preserveMode === "file" && (
                  <form onSubmit={handlePreserve} className="space-y-3">
                    <div onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed rounded-lg px-5 py-8 text-center cursor-pointer transition-colors ${file ? "border-white/30 bg-white/[0.03]" : "border-white/10 hover:border-white/20"}`}>
                      {file ? (
                        <div>
                          <p className="text-sm font-medium text-white">{file.name}</p>
                          <p className="text-xs text-white/40 mt-1">{(file.size / 1024).toFixed(1)} KB &middot; {file.type || "unknown"}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-white/70">Click to select a file</p>
                          <p className="text-xs text-white/40 mt-1">Screenshots, PDFs, images, documents</p>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" className="hidden"
                        accept="image/*,.pdf,.txt,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={loading} />
                    </div>
                    <Field label="Context" hint="optional">
                      <input type="text" value={context} onChange={(e) => setContext(e.target.value)}
                        placeholder="e.g. harassment, scam..." disabled={loading} className="input-base" />
                    </Field>
                    <PrimaryButton loading={loading} step={step} label="Upload and Preserve" disabled={!file} />
                  </form>
                )}

                {preserveMode === "batch" && (
                  <form onSubmit={handleBatch} className="space-y-3">
                    <Field label="URLs" hint="one per line">
                      <textarea value={batchUrls} onChange={(e) => setBatchUrls(e.target.value)}
                        placeholder={"https://example.com/post-1\nhttps://example.com/post-2"}
                        className="input-base resize-none" rows={5} disabled={loading} />
                    </Field>
                    <Field label="Context" hint="optional">
                      <input type="text" value={context} onChange={(e) => setContext(e.target.value)}
                        placeholder="e.g. harassment thread..." disabled={loading} className="input-base" />
                    </Field>
                    <PrimaryButton loading={loading} step={step} label="Preserve All" disabled={!batchUrls.trim()} />
                    {loading && batchProgress.total > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-white/50">
                          <span>Progress</span>
                          <span>{batchProgress.current} / {batchProgress.total}</span>
                        </div>
                        <div className="h-px bg-white/10 rounded-full overflow-hidden">
                          <div className="h-px bg-white transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {error && <div className="mt-4"><ErrorMsg message={error} /></div>}

                {/* History list */}
                {history.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-white/60 uppercase tracking-widest font-medium">History</p>
                      <span className="text-xs text-white/40">{history.length} items</span>
                    </div>
                    <div className="space-y-0.5">
                      {history.map((item) => {
                        const sev = SEVERITY_STYLE[item.analysis.severity as SeverityKey] || SEVERITY_STYLE.medium;
                        return (
                          <div key={item.evidenceId} onClick={() => setResult(item)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${result?.evidenceId === item.evidenceId ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white/80 truncate">{item.fileName || item.sourceUrl}</p>
                              <p className="text-xs text-white/50 mt-0.5">{item.analysis.platform} &middot; {new Date(item.capturedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== VERIFY form ===== */}
            {activeTab === "verify" && (
              <div>
                <p className="text-sm text-white/60 mb-5 leading-relaxed">
                  Paste any CID to confirm evidence exists on Filecoin.
                </p>
                <form onSubmit={handleVerify} className="space-y-3">
                  <Field label="Content ID (CID)">
                    <input value={verifyCid} onChange={(e) => setVerifyCid(e.target.value)}
                      placeholder="bafkrei..." disabled={verifyLoading}
                      className="input-base font-mono text-xs" />
                  </Field>
                  <PrimaryButton loading={verifyLoading} step="Verifying..." label="Verify" disabled={!verifyCid.trim()} />
                </form>
                {verifyError && <div className="mt-4"><ErrorMsg message={verifyError} /></div>}
              </div>
            )}

            {/* ===== CASES list ===== */}
            {activeTab === "cases" && (
              <div>
                <div className="flex gap-2 mb-5">
                  <input value={newCaseName} onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="New case name" onKeyDown={(e) => e.key === "Enter" && createCase()}
                    className="input-base flex-1" />
                  <button onClick={createCase} className="px-4 py-2 text-sm bg-white text-black font-medium rounded-md hover:bg-white/90 transition-colors shrink-0">
                    Create
                  </button>
                </div>

                {cases.length === 0 && (
                  <p className="text-sm text-white/50 text-center py-12">No cases yet.</p>
                )}

                <div className="space-y-1">
                  {cases.map((c) => {
                    const isSelected = selectedCaseId === c.id;
                    return (
                      <div key={c.id}
                        onClick={() => setSelectedCaseId(isSelected ? null : c.id)}
                        className={`flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <p className="text-xs text-white/50 mt-0.5">{c.evidenceIds.length} items &middot; {new Date(c.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="text-white/40 text-sm shrink-0 ml-2">{isSelected ? "←" : "→"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT PANEL — results / certificates ===== */}
        <div className="flex-1 lg:overflow-y-auto">
          <div className="p-5 lg:p-8 max-w-[680px]">

            {/* Memory chain panel */}
            {memoryChainOpen && memoryChain.length > 0 && (
              <div className="mb-8 p-5 rounded-xl border border-white/[0.07] bg-white/[0.01] no-print">
                <p className="text-xs text-white/60 uppercase tracking-widest mb-4 font-medium">Agent Memory — Filecoin Knowledge Trail</p>
                <div className="space-y-2.5">
                  {memoryChain.map((entry, i) => (
                    <div key={entry.cid} className="flex items-center gap-3">
                      <span className="text-xs text-white/50 w-6 shrink-0 font-mono">v{entry.version}</span>
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <code className="text-xs text-emerald-400 font-mono truncate">{entry.cid}</code>
                        {i === memoryChain.length - 1 && (
                          <span className="text-xs text-emerald-400 border border-emerald-400/40 px-1.5 py-0.5 rounded shrink-0">current</span>
                        )}
                      </div>
                      <span className="text-xs text-white/50 shrink-0">{entry.totalEvidence} item{entry.totalEvidence !== 1 ? "s" : ""}</span>
                      <a href={`https://cid.ipfs.tech/#${entry.cid}`} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-white/40 hover:text-white transition-colors shrink-0">↗</a>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/40 mt-4">Each version is a permanent, immutable snapshot stored on Filecoin.</p>
              </div>
            )}

            {/* ===== PRESERVE right: certificate or empty ===== */}
            {activeTab === "preserve" && (
              <>
                {batchResults.length > 0 && (
                  <div className="mb-8 space-y-2">
                    <p className="text-xs text-white/60 mb-3">{batchResults.length} items preserved</p>
                    {batchResults.map((r) => (
                      <div key={r.evidenceId} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/[0.07] bg-white/[0.02]">
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate">{r.sourceUrl}</p>
                          <p className="text-xs text-white/40 font-mono truncate mt-0.5">{r.cid}</p>
                        </div>
                        <a href={`/evidence/${r.cid}`} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded px-2.5 py-1 transition-colors">
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {result ? (
                  <Certificate result={result} cases={cases} copied={copied}
                    onCopy={copyText} onDownload={downloadCert}
                    assignCaseId={assignCaseId} onAssignCaseChange={setAssignCaseId}
                    onAssign={() => { if (assignCaseId) assignToCase(result.evidenceId, assignCaseId); }} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-4">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                    </div>
                    <p className="text-sm text-white/40 mb-1">No evidence yet</p>
                    <p className="text-xs text-white/25">Preserve a URL or file to see the certificate here.</p>
                  </div>
                )}
              </>
            )}

            {/* ===== VERIFY right: result or empty ===== */}
            {activeTab === "verify" && (
              <>
                {verifyResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05]">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-emerald-400">Verified on Filecoin</p>
                        <p className="text-xs text-white/50 mt-0.5 break-all">
                          {verifyResult.gatewayUsed === "local-cache" ? "Served from local session cache — CID matches archived evidence" : verifyResult.gatewayUsed}
                        </p>
                      </div>
                    </div>
                    {verifyResult.isRawFile ? (
                      <div className="p-4 rounded-lg border border-white/[0.07]">
                        <p className="text-sm text-white">Raw file — {verifyResult.contentType}</p>
                        <a href={verifyResult.gatewayUsed} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-white/40 hover:text-white mt-2 block">View file on IPFS</a>
                      </div>
                    ) : verifyResult.data ? (
                      <Certificate result={verifyResult.data as EvidenceResult} cases={[]} copied={copied}
                        onCopy={copyText} onDownload={downloadCert}
                        assignCaseId="" onAssignCaseChange={() => {}} onAssign={() => {}} />
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-4">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                    </div>
                    <p className="text-sm text-white/40 mb-1">Enter a CID to verify</p>
                    <p className="text-xs text-white/25">Paste a Content ID on the left to retrieve its certificate.</p>
                  </div>
                )}
              </>
            )}

            {/* ===== CASES right: selected case detail or empty ===== */}
            {activeTab === "cases" && (
              <>
                {selectedCase ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selectedCase.name}</h2>
                      <p className="text-xs text-white/50 mt-1">{selectedCase.evidenceIds.length} items &middot; Created {new Date(selectedCase.createdAt).toLocaleDateString()}</p>
                    </div>

                    {caseEvidence.length === 0 ? (
                      <p className="text-sm text-white/50 py-8">No evidence assigned. Preserve something and assign it from the certificate.</p>
                    ) : (
                      <div className="space-y-2">
                        {caseEvidence.map((item) => {
                          const sev = SEVERITY_STYLE[item.analysis.severity as SeverityKey] || SEVERITY_STYLE.medium;
                          return (
                            <div key={item.evidenceId} className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.07] bg-white/[0.02]">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dot}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-white truncate">{item.fileName || item.sourceUrl}</p>
                                <p className="text-xs text-white/50 mt-0.5">{item.analysis.platform} &middot; {new Date(item.capturedAt).toLocaleString()}</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <a href={`/evidence/${item.cid}`} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-white/60 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors">View</a>
                                <button onClick={() => removeFromCase(item.evidenceId, selectedCase.id)}
                                  className="text-xs text-red-400/80 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 rounded px-2 py-1 transition-colors">Remove</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {caseEvidence.length >= 2 && (
                      <div>
                        <button onClick={() => buildTimeline(selectedCase)} disabled={timelineLoading}
                          className="w-full py-2.5 text-sm font-medium rounded-md border border-white/10 hover:border-white/20 hover:bg-white/[0.03] transition-colors disabled:opacity-40">
                          {timelineLoading ? "Building timeline..." : "Build AI Timeline"}
                        </button>
                        {timeline && (
                          <div className="mt-4 p-5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                            <p className="text-xs text-white/50 uppercase tracking-widest mb-3 font-medium">AI Case Timeline</p>
                            <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-sans">{timeline}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-4">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                    </div>
                    <p className="text-sm text-white/40 mb-1">No case selected</p>
                    <p className="text-xs text-white/25">Select a case on the left to view its evidence.</p>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      <style jsx global>{`
        .input-base {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 6px;
          padding: 10px 12px;
          color: white;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-base::placeholder { color: rgba(255,255,255,0.35); }
        .input-base:focus { border-color: rgba(255,255,255,0.25); }
        .input-base:disabled { opacity: 0.4; }
      `}</style>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-6 no-print shrink-0">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-white/50">Built for the Filecoin TLDR Builder Challenge</p>
            <p className="text-xs text-white/40 mt-0.5">AI agent memory + permanent evidence on Filecoin</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <a href="https://x.com/rohanbuilds" target="_blank" rel="noopener noreferrer"
              className="text-sm text-white/60 hover:text-white transition-colors">X</a>
            <a href="https://github.com/rohan-singla" target="_blank" rel="noopener noreferrer"
              className="text-sm text-white/60 hover:text-white transition-colors">GitHub</a>
            <a href="https://www.linkedin.com/in/rohan-singla100/" target="_blank" rel="noopener noreferrer"
              className="text-sm text-white/60 hover:text-white transition-colors">LinkedIn</a>
            <span className="text-sm text-white/50">Rohan Singla</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sub components

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs text-white/50">
        {label}
        {hint && <span className="text-white/40">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function PrimaryButton({ loading, step, label, disabled }: { loading: boolean; step: string; label: string; disabled: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="w-full py-2.5 text-sm font-medium rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40 transition-colors">
      {loading ? step || "Working..." : label}
    </button>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-md border border-red-500/20 bg-red-500/[0.05] text-red-400 text-xs mb-4">{message}</div>
  );
}

function Certificate({ result, cases, copied, onCopy, onDownload, assignCaseId, onAssignCaseChange, onAssign }: {
  result: EvidenceResult; cases: Case[]; copied: string | null;
  onCopy: (t: string) => void; onDownload: (r: EvidenceResult) => void;
  assignCaseId: string; onAssignCaseChange: (id: string) => void; onAssign: () => void;
}) {
  const sev = SEVERITY_STYLE[result.analysis.severity as SeverityKey] || SEVERITY_STYLE.medium;
  const { analysis } = result;
  const [proofData, setProofData] = useState<{ fileName: string; fileSize: number; mimeType: string; txHash?: string } | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  async function fetchProof() {
    if (proofData || proofLoading) return;
    setProofLoading(true);
    try {
      const res = await fetch("/api/filecoin-proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cid: result.cid }) });
      const data = await res.json();
      if (res.ok && data.info) setProofData(data.info);
    } finally { setProofLoading(false); }
  }

  return (
    <div className="space-y-3">
      {/* Certificate header */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <div>
          <p className="text-xs text-white/60 uppercase tracking-widest font-medium mb-1">Evidence Certificate</p>
          <p className="text-xs text-white/50 font-mono">{result.evidenceId}</p>
        </div>
        <div className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-2 py-1 rounded border ${sev.badge}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
          {result.analysis.severity.toUpperCase()}
        </div>
      </div>

      {/* Screenshot */}
      {(result.screenshotUrl || result.screenshotCid) && (
        <div className="overflow-hidden rounded-lg border border-white/[0.07]">
          <p className="text-xs text-white/60 uppercase tracking-widest px-3 pt-3 pb-2">Screenshot — Filecoin</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.screenshotUrl || `https://ipfs.io/ipfs/${result.screenshotCid}`} alt="Evidence screenshot" className="w-full" />
        </div>
      )}

      {/* Details */}
      <div className="rounded-lg border border-white/[0.07] divide-y divide-white/[0.05]">
        <div className="grid grid-cols-2 gap-0 divide-x divide-white/[0.05]">
          <DetailCell label="Platform" value={analysis.platform} />
          <DetailCell label="Content Type" value={analysis.contentType} />
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-white/[0.05]">
          <DetailCell label="Author" value={analysis.author} />
          <DetailCell label="Content Date" value={analysis.contentDate} />
        </div>
        <DetailCell label="Captured (UTC)" value={new Date(result.capturedAt).toUTCString()} />
        {result.sourceUrl && (
          <div className="px-4 py-3">
            <p className="text-xs text-white/60 uppercase tracking-widest mb-1">Source URL</p>
            <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/70 hover:text-white break-all transition-colors">{result.sourceUrl}</a>
          </div>
        )}
        <div className="px-4 py-3">
          <p className="text-xs text-white/60 uppercase tracking-widest mb-1.5">Summary</p>
          <p className="text-xs text-white/80 leading-relaxed">{analysis.summary}</p>
        </div>
        {analysis.keyStatements?.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-white/60 uppercase tracking-widest">Key Statements</p>
            {analysis.keyStatements.map((s, i) => (
              <div key={i} className="border-l-2 border-white/20 pl-3">
                <p className="text-xs text-white/75 italic">{s}</p>
              </div>
            ))}
          </div>
        )}
        {analysis.memoryInsight && (
          <div className="px-4 py-3 bg-indigo-500/[0.06] border-t border-indigo-500/20">
            <p className="text-xs text-indigo-400 uppercase tracking-widest mb-1.5">Agent Memory Insight</p>
            <p className="text-xs text-white/80 leading-relaxed">{analysis.memoryInsight}</p>
          </div>
        )}
        {analysis.threatAssessment && (
          <div className={`px-4 py-3 ${analysis.threatAssessment.isThreatening ? "bg-red-500/[0.05]" : ""}`}>
            <p className="text-xs text-white/60 uppercase tracking-widest mb-2">Threat Assessment</p>
            {analysis.threatAssessment.isThreatening ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">{analysis.threatAssessment.type}</p>
                <p className="text-xs text-white/75">{analysis.threatAssessment.description}</p>
                <p className="text-xs text-amber-400 mt-2">Recommendation: {analysis.threatAssessment.recommendedAction}</p>
              </div>
            ) : (
              <p className="text-xs text-white/60">{analysis.threatAssessment.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Filecoin proof */}
      <div className="rounded-lg border border-white/[0.07] divide-y divide-white/[0.05]">
        <div className="px-4 py-3">
          <p className="text-xs text-white/60 uppercase tracking-widest mb-2">Content ID (CID)</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-emerald-400 font-mono break-all flex-1">{result.cid}</code>
            <button onClick={() => onCopy(result.cid)} className="shrink-0 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded px-2 py-1 transition-colors">
              {copied === result.cid ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Filecoin storage proof */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/60 uppercase tracking-widest">Filecoin Storage</p>
            {!proofData && (
              <button onClick={fetchProof} disabled={proofLoading}
                className="text-xs text-white/50 hover:text-white/70 border border-white/10 hover:border-white/25 rounded px-2 py-0.5 transition-colors disabled:opacity-40">
                {proofLoading ? "Fetching..." : "Verify storage"}
              </button>
            )}
          </div>
          {proofData ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400 font-medium">Confirmed on Filecoin via Lighthouse</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {proofData.fileName && <p className="text-xs text-white/60">File: <span className="text-white/80">{proofData.fileName}</span></p>}
                {proofData.fileSize && <p className="text-xs text-white/60">Size: <span className="text-white/80">{(proofData.fileSize / 1024).toFixed(1)} KB</span></p>}
                {proofData.mimeType && <p className="text-xs text-white/60">Type: <span className="text-white/80">{proofData.mimeType}</span></p>}
              </div>
              <a href={`https://cid.ipfs.tech/#${result.cid}`} target="_blank" rel="noopener noreferrer"
                className="inline-block text-xs text-white/50 hover:text-white/80 mt-1.5 transition-colors">
                Inspect CID on IPFS ↗
              </a>
            </div>
          ) : (
            <p className="text-xs text-white/50">Click &quot;Verify storage&quot; to confirm this evidence is stored on Filecoin.</p>
          )}
        </div>

        <div className="px-4 py-3">
          <a href={`/evidence/${result.cid}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 group">
            <div>
              <p className="text-xs font-medium text-white group-hover:text-white/80 transition-colors">Share certificate</p>
              <p className="text-xs text-white/50 font-mono mt-0.5">/evidence/{result.cid.slice(0, 20)}...</p>
            </div>
            <span className="text-white/50 group-hover:text-white/80 transition-colors text-sm">↗</span>
          </a>
        </div>
      </div>

      {/* Assign to case */}
      {cases.length > 0 && (
        <div className="flex gap-2">
          <select value={assignCaseId} onChange={(e) => onAssignCaseChange(e.target.value)}
            className="input-base flex-1 text-xs">
            <option value="">Assign to case...</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={onAssign} disabled={!assignCaseId}
            className="px-4 py-2 text-sm bg-white/[0.06] hover:bg-white/10 disabled:opacity-30 text-white rounded-md transition-colors shrink-0">
            Assign
          </button>
        </div>
      )}

      {/* Actions */}
      <p className="text-xs text-white/60 leading-relaxed">
        Save a copy now. The CID is your permanent proof — without it you cannot verify this evidence later.
      </p>
      <div className="flex gap-2">
        <button onClick={() => onDownload(result)}
          className="flex-1 py-2.5 text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.13] border border-white/[0.12] rounded-md transition-colors">
          Download JSON
        </button>
        <button onClick={() => window.print()}
          className="flex-1 py-2.5 text-xs text-white/60 hover:text-white border border-white/[0.07] hover:border-white/20 rounded-md transition-colors">
          Print Certificate
        </button>
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs text-white/60 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xs text-white/80">{value}</p>
    </div>
  );
}
