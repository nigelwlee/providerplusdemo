# Audit-Ready Gap Checker

A proof-of-concept AI tool that analyses an NDIS provider's policy documents against
the NDIS Practice Standards and produces a structured, audit-style gap analysis.
Built as a pitch demo for **Provider+**, an Australian NDIS consultancy — the
demo scenario is a Supported Independent Living (SIL) provider transitioning to
mandatory registration (Module 5A / Registration Group 0138).

This is a one-sitting POC: no database, no auth, everything lives in memory for
the duration of a single analysis.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Claude via [OpenRouter](https://openrouter.ai) (`openai` SDK pointed at OpenRouter's OpenAI-compatible endpoint), called server-side only
- `pdf-parse` / `mammoth` for PDF and .docx text extraction
- `jspdf` for client-side PDF export of the report

## Setup

```bash
npm install
cp .env.example .env.local
# then edit .env.local and set OPENROUTER_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | API key from [openrouter.ai/keys](https://openrouter.ai/keys). Server-side only, never exposed to the client. |
| `OPENROUTER_MODEL` | No | Overrides the model used for analysis (defaults to `deepseek/deepseek-v3.2` — cheap and strong at structured JSON; swap in `anthropic/claude-sonnet-4.6` or similar if you want higher quality at higher cost). |
| `ANALYSIS_BATCH_SIZE` | No | How many standards each parallel analysis call assesses at once (default `3`). See "How the analysis works" below. |
| `OPENROUTER_SORT_THROUGHPUT` | No | Set to `0` to disable throughput-optimised routing (on by default). |
| `LLM_DEBUG` | No | Set to any value to log per-call timing/token usage and batch info to the server console. |

## Using the demo

1. On the landing screen, click **"Try with sample document"** to load the
   bundled fictional policy manual for *Harbour Care Services Pty Ltd*
   (`data/sample-policy.txt`) — a SIL provider transitioning from Group 0115 to
   Group 0138. This works fully offline from any upload, so it's what you should
   use for a live demo.
2. Core Module + Module 5A (SIL) are pre-selected, matching the sample scenario.
   You can also upload your own PDF/.docx/.txt policy document, or paste text
   directly.
3. Click **Analyse document**. The app streams real progress from the server
   (live "N of M sections analysed" updates) as it works — typically ~15-20
   seconds end to end for the full Core + Module 5A demo scenario.
4. Review the report: overall readiness score, executive summary, top 3 risks,
   and a standards-by-division breakdown with evidence quotes and suggested
   fixes. Use the filter chips to jump straight to gaps or partial findings.
5. Click **Download report as PDF** to export a styled audit-style document.

## How the analysis works

Rather than one giant request asking the model to assess all ~31 standards at
once (which took 3-4 minutes and risked timing out on Vercel), the analysis
is split into small parallel batches:

1. Each Practice Standards division is split into batches of `ANALYSIS_BATCH_SIZE`
   standards (default 3) — e.g. Core + Module 5A becomes 12 batches.
2. All batches run concurrently (`Promise.all`), each assessing only its own
   handful of standards but with the full document as context. Each batch
   validates its own response and retries once on malformed/incomplete output
   — cheap, since a retry only costs one small batch, not the whole analysis.
3. Once every batch completes, a final lightweight "synthesis" call writes the
   executive summary and top 3 risks from the merged findings. The overall
   score and readiness verdict are computed deterministically in code from the
   met/partial/gap/not-addressed distribution (not left to the model), so
   they're reproducible run-to-run and can never disagree with each other.
4. Progress is streamed to the client as newline-delimited JSON
   (`app/api/analyse/route.ts`) as each batch completes, driving the real
   progress bar shown during analysis — not a fake timer.

## Project structure

```
app/
  page.tsx                 # client-side step orchestration (input → analysing → report)
  api/parse/route.ts       # server route: extracts text from uploaded PDF/.docx
  api/analyse/route.ts     # server route: calls Claude, returns the structured report
components/                # UI: InputStep, ProgressStep, ReportView, StatusPill, etc.
lib/
  types.ts                 # shared types for the analysis pipeline
  practiceStandards.ts     # loads/queries the Practice Standards dataset
  prompt.ts                 # builds the batch and synthesis prompts sent to the model
  analyse.ts                # orchestrates batching, parallel calls, retry, deterministic scoring
  llm.ts                      # OpenRouter (Claude) client + robust JSON extraction
  parseDocument.ts           # PDF/.docx/.txt parsing (server-side)
  pdfReport.ts                # client-side PDF export (jsPDF, no DOM screenshot)
data/
  practice-standards.json  # condensed NDIS Practice Standards dataset (Core + Module 5A in depth)
  glossary.json             # ~25 NDIS terms, also used for in-report tooltips
  sample-policy.txt          # bundled sample policy document for the demo
public/sample-policy.txt    # static copy served to the client for the sample-document button
```

## Notes on the Practice Standards dataset

`data/practice-standards.json` is a **condensed dataset built for demonstration
purposes**, paraphrased from publicly available NDIS Quality and Safeguards
Commission material — it is not a verbatim reproduction of the NDIS (Provider
Registration and Practice Standards) Rules 2018, and Module 5A content in
particular should be treated as a faithful paraphrase rather than an exact
citation (it was authored from general knowledge of the new SIL Practice
Standards, not fetched live from NDIS Commission publications). This disclaimer
is also surfaced in the app's report footer and PDF export. Do not use this
tool, or this dataset, for real compliance or audit advice.

## Error handling

- Unsupported file types, unreadable/scanned PDFs, and oversized documents
  (>50 pages, truncated with a visible warning) are all handled with
  human-readable messages in the upload step.
- If a batch (or the final synthesis) call fails or returns malformed/incomplete
  JSON, it retries once with a corrective instruction before surfacing a
  friendly error and returning the user to the input screen (nothing is lost).
- Long documents (>~80,000 characters) are condensed with a preliminary
  summarisation pass before the main analysis call.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add the `OPENROUTER_API_KEY` environment variable in the Vercel project settings.
4. Deploy — no other configuration is required.
