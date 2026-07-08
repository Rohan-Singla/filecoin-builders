# Verity

**Permanent proof, on Filecoin.**

Live demo: [filecoin-builders.vercel.app](https://filecoin-builders.vercel.app)  
Repo: [github.com/Rohan-Singla/filecoin-builders](https://github.com/Rohan-Singla/filecoin-builders)

Verity is an AI agent that captures, analyzes, and archives digital evidence on the Filecoin network. Built for harassment victims, journalists, legal teams, and anyone who needs to prove something happened online — before it disappears.

---

## The Problem

URLs die. Screenshots can be faked. Evidence gets deleted.

When someone harasses you online, posts a defamatory statement, or makes a promise in writing — that content can vanish within hours. Even if you screenshot it, there's no way to prove it hasn't been edited. There's no tamper-proof timestamp. There's no cryptographic proof it existed.

Verity solves this.

---

## How It Works

1. **Paste a URL or upload a file** (screenshot, PDF, image)
2. **The AI agent fetches and analyzes the content** — platform, author, key statements, threat type, severity
3. **The evidence and a visual screenshot are archived permanently on Filecoin** — producing a cryptographic CID
4. **The agent updates its memory on Filecoin** — so every future analysis builds on past evidence
5. **You receive a shareable, verifiable evidence certificate** at a permanent public URL

---

## How the App Uses Filecoin

Verity uses Filecoin for two distinct purposes:

### 1. Evidence Storage
Every piece of preserved evidence — the full page content, AI analysis, metadata, and screenshot — is stored on Filecoin via the Lighthouse SDK. The resulting CID is a cryptographic fingerprint: any tampering produces a completely different CID, making falsification detectable.

### 2. Agent Memory (the novel part)
The agent maintains a persistent memory index stored on Filecoin itself. After each preservation, the memory is updated with a new entry (platform, author, summary, threat type, severity) and re-uploaded to Filecoin as a new CID. When new evidence comes in, the agent reads this memory and gives contextual analysis across cases:

> "This is the 3rd piece of evidence involving this author. Severity has escalated from low to high across incidents — consistent with a targeted harassment campaign."

The memory has a full version history on Filecoin. Every update is a new CID. The entire knowledge trail is on-chain, permanent, and verifiable by anyone with the CID.

This makes Filecoin the agent's brain — not just its file cabinet.

---

## Agent Mechanic

```
User submits URL or file
Agent reads memory from Filecoin (previous cases)
Agent fetches content via Jina Reader + captures screenshot via Microlink
Groq (Llama-3.3-70B) analyzes content WITH memory context:
  - Platform, author, content date
  - Summary + key statements
  - Severity: low / medium / high
  - Threat type + recommended action
  - Memory insight: connections to past evidence
Evidence package + screenshot archived on Filecoin
Agent memory updated and stored on Filecoin (new CID, new version)
User receives: certificate + CID + memory insight + shareable link
```

---

## Features

| Feature | Description |
|---|---|
| URL Preservation | Fetch and archive any public webpage |
| File Upload | Upload screenshots, PDFs, images directly to Filecoin |
| Batch Preserve | Preserve multiple URLs in one operation |
| AI Threat Assessment | Classifies harassment, defamation, scam, misinformation |
| Agent Memory | Cross-session memory stored on Filecoin, grows with each case |
| Memory Insight | Agent surfaces patterns across evidence items |
| Case Folders | Group related evidence, generate AI case timelines |
| CID Verifier | Confirm evidence exists on Filecoin and retrieve certificate |
| Shareable Certificate | Public URL at `/evidence/[cid]` for every piece of evidence |
| Download + Print | Export certificate as JSON or print as PDF |

---

## Filecoin Stack

| Primitive | How it's used |
|---|---|
| Storage | Evidence packages and screenshots uploaded via Lighthouse SDK |
| Agent Memory | Memory index stored on Filecoin, versioned with every update |
| Content Addressing | CIDs used as tamper-proof identifiers throughout |
| Storage Proof | Lighthouse `getFileInfo` API confirms on-chain storage |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| AI Agent | Groq — Llama-3.3-70B-Versatile |
| Filecoin Storage | Lighthouse SDK (`@lighthouse-web3/sdk`) |
| Content Fetch | Jina AI Reader |
| Screenshot | Microlink API |
| Deployment | Vercel |

---

## Running Locally

```bash
git clone https://github.com/Rohan-Singla/filecoin-builders.git
cd filecoin-builders
npm install
```

Create `.env.local`:

```
LIGHTHOUSE_API_KEY=your_lighthouse_key
GROQ_API_KEY=your_groq_key
```

Get free API keys:
- **Lighthouse** — [files.lighthouse.storage](https://files.lighthouse.storage) (free tier, no card required)
- **Groq** — [console.groq.com](https://console.groq.com) (free tier, no card required)

```bash
npm run dev
# open http://localhost:3000
```

---

## AI Build Log

Built using **Claude Code** as the primary AI build partner.

**Ideation** — Evaluated multiple hackathon ideas against the judging criteria. Ruled out generic "AI memory agent" concepts, dead man's switch (hard to demo live), and citation archiver (weak Filecoin use). Landed on Verity after identifying that Filecoin's permanence and tamper-proof properties solve a real, emotional problem: digital evidence that disappears before you can act on it.

**Architecture** — Designed a two-layer Filecoin use: evidence storage (standard) plus agent memory stored on-chain (novel). The memory layer was added to make the agent genuinely agentic — building context across sessions rather than treating each preservation in isolation.

**Build** — Iterative development: Next.js 16 App Router, Lighthouse SDK, Groq for AI analysis, Microlink for screenshots, case folders, CID verifier, batch preserve, AI timeline builder, and shareable certificate pages.

**Key debugging** — IPFS gateway latency caused agent memory to return empty on fresh uploads. Root cause: gateways don't propagate instantly after upload. Fix: client caches memory data locally and sends it directly to the API on the next call, while the Filecoin CID serves as the permanent verifiable record.

**Design** — Split-panel layout (input left, certificate right). Geist font, pure dark theme, structured certificate that reads like a legal document.

---

## Submission

**Project:** Verity  
**Category:** AI Agent that uses Filecoin  
**Live demo:** [filecoin-builders.vercel.app](https://filecoin-builders.vercel.app)  
**Repo:** [github.com/Rohan-Singla/filecoin-builders](https://github.com/Rohan-Singla/filecoin-builders)  
**Filecoin primitives:** Storage, content addressing, agent memory on-chain, storage proof via Lighthouse  
**Agent mechanic:** Persistent cross-session memory stored on Filecoin; every analysis builds on past evidence retrieved from the network  
