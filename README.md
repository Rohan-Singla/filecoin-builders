# Evidence Locker

**Preserve digital evidence permanently on Filecoin. Tamper-proof. Timestamped. Forever.**

Evidence Locker is an AI agent that captures, analyzes, and archives digital evidence on the Filecoin network. Built for harassment victims, journalists, legal teams, and anyone who needs to prove something happened online — before it disappears.

---

## The Problem

URLs die. Screenshots can be faked. Evidence gets deleted.

When someone harasses you online, posts a defamatory statement, or makes a promise in writing — that content can vanish within hours. Even if you screenshot it, there's no way to prove it hasn't been edited. There's no tamper-proof timestamp. There's no cryptographic proof it existed.

Evidence Locker solves this.

---

## How It Works

1. **Paste a URL or upload a file** (screenshot, PDF, image)
2. **The AI agent fetches and analyzes the content** — platform, author, key statements, threat type, severity
3. **The evidence and a visual screenshot are archived permanently on Filecoin** — producing a cryptographic CID
4. **The agent updates its memory on Filecoin** — so every future analysis builds on past evidence
5. **You receive a shareable, verifiable evidence certificate** with multiple IPFS gateway links

---

## How the Agent Uses Filecoin

Evidence Locker uses Filecoin for two distinct purposes:

### 1. Evidence Storage
Every piece of preserved evidence — the full page content, AI analysis, metadata, and screenshot — is stored on Filecoin via Lighthouse. The resulting CID is a cryptographic fingerprint: any tampering produces a completely different CID, making falsification detectable.

### 2. Agent Memory
The agent maintains a persistent memory index stored on Filecoin itself. After each preservation, the memory is updated with a new entry (platform, author, summary, threat type, severity) and re-uploaded to Filecoin as a new CID. When new evidence comes in, the agent reads this memory and gives contextual analysis across cases:

> *"This is the 3rd piece of evidence involving this author. Severity has escalated from low to high across incidents — consistent with a targeted harassment campaign."*

The memory has a full version history on Filecoin. Every update is a new CID. The entire knowledge trail is on-chain, permanent, and verifiable by anyone.

This makes Filecoin the agent's brain — not just its file cabinet.

---

## Agent Mechanic

```
User submits URL or file
        ↓
Agent reads memory from Filecoin (previous cases)
        ↓
Agent fetches content via Jina Reader + captures screenshot via Microlink
        ↓
Groq (Llama-3.3-70B) analyzes content WITH memory context:
  - Platform, author, content date
  - Summary + key statements
  - Severity: low / medium / high
  - Threat type + recommended action
  - Memory insight: connections to past evidence
        ↓
Evidence package + screenshot archived on Filecoin
Agent memory updated and stored on Filecoin (new CID, new version)
        ↓
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
| Multiple Gateways | 4 IPFS gateway links per certificate |
| Download + Print | Export certificate as JSON or print as PDF |

---

## Filecoin Stack

| Primitive | How it's used |
|---|---|
| Storage | Evidence packages and screenshots uploaded via Lighthouse SDK |
| Agent Memory | Memory index stored on Filecoin, versioned with every update |
| Content Addressing | CIDs used as tamper-proof identifiers throughout |
| Decentralized Retrieval | Evidence accessible via ipfs.io, Cloudflare, dweb.link, Lighthouse |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI Agent | Groq — Llama-3.3-70B-Versatile |
| Filecoin Storage | Lighthouse SDK |
| Content Fetch | Jina AI Reader (free, no API key) |
| Screenshot | Microlink API (free tier) |
| Font | Geist |

---

## Running Locally

```bash
git clone <repo-url>
cd filecoin
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

Built entirely using **Claude Code** as the AI build partner over 3 days.

**Ideation** — Evaluated multiple hackathon ideas against the judging criteria with Claude. Ruled out generic "AI memory agent" ideas, dead man's switch (hard to demo live), and citation archiver (weak Filecoin use). Landed on Evidence Locker after identifying that Filecoin's permanence and tamper-proof properties solve a real, emotional problem: digital evidence that disappears before you can act on it.

**Architecture decisions** — Claude designed the two-layer Filecoin use: evidence storage (standard) plus agent memory stored on-chain (novel). The memory layer was added specifically to differentiate from basic "store a file" submissions and to make the agent genuinely agentic — building context across sessions rather than treating each preservation in isolation.

**Build** — Iterative development with Claude Code: scaffolded Next.js, wired Lighthouse SDK, integrated Groq for AI analysis, added screenshot capture via Microlink, built case folders, CID verifier, batch preserve, timeline builder, and shareable certificate pages.

**Key debugging** — IPFS gateway latency caused agent memory to return empty on fresh uploads. Claude identified the root cause (gateways don't propagate instantly after upload) and redesigned the memory flow: client caches the memory data locally and sends it directly to the API on the next call, while the Filecoin CID serves as the permanent verifiable record. This preserved the Filecoin integration while eliminating the latency dependency.

**Design** — UI redesigned twice based on feedback. Final version: Geist font, pure dark theme, no emojis, minimal borders, structured certificate layout that reads like a legal document.

---

## Submission

**Project:** Evidence Locker  
**Category:** AI Agent that uses Filecoin  
**Filecoin primitives:** Storage, content addressing, decentralized retrieval, agent memory on-chain  
**Agent mechanic:** Persistent cross-session memory stored on Filecoin; every analysis builds on past evidence retrieved from the network  
**Live demo:** _add after deploy_  
**X post:** _add after posting_
