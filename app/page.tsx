"use client";

import { useState } from "react";

interface Source {
  title: string;
  url: string;
  relevance: string;
  cid: string | null;
  archived: boolean;
}

interface ResearchResult {
  answer: string;
  sources: Source[];
  answerCid: string;
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 text-green-400 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Powered by Filecoin
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">
            EvidenceVault
          </h1>
          <p className="text-gray-400 text-lg">
            AI research agent that permanently archives every source on Filecoin.
            <br />
            Citations that never die.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex flex-col gap-3">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a research question... e.g. What caused the 2008 financial crisis?"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-green-500 transition-colors"
              rows={3}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="self-end bg-green-500 hover:bg-green-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {loading ? "Researching..." : "Research & Archive"}
            </button>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-gray-400 text-sm space-y-1">
                <p>Researching your question with AI...</p>
                <p>Archiving sources to Filecoin...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6">
            {/* Answer */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Research Answer
              </h2>
              <p className="text-gray-200 leading-relaxed whitespace-pre-line">
                {result.answer}
              </p>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-600 mb-1">Full research report archived on Filecoin</p>
                <a
                  href={`https://gateway.lighthouse.storage/ipfs/${result.answerCid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-500 hover:text-green-400 font-mono break-all"
                >
                  ipfs://{result.answerCid}
                </a>
              </div>
            </div>

            {/* Sources */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Sources Archived on Filecoin{" "}
                <span className="text-green-400 normal-case font-normal">
                  ({result.sources.filter((s) => s.archived).length}/{result.sources.length} archived)
                </span>
              </h2>
              <div className="space-y-3">
                {result.sources.map((source, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-medium text-white text-sm">{source.title}</h3>
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                          source.archived
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-gray-800 text-gray-500"
                        }`}
                      >
                        {source.archived ? "Archived" : "Unavailable"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{source.relevance}</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-14 shrink-0">Source:</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 truncate"
                        >
                          {source.url}
                        </a>
                      </div>
                      {source.cid && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-14 shrink-0">Filecoin:</span>
                          <a
                            href={`https://gateway.lighthouse.storage/ipfs/${source.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-500 hover:text-green-400 font-mono truncate"
                          >
                            ipfs://{source.cid}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer banner */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-sm text-green-400">
                All sources permanently stored on Filecoin. These links will work forever.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
