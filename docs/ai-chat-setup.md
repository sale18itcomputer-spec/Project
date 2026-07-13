# AI Chat Widget — setup

A floating **AI Assistant** button (bottom-right of every dashboard page) lets
staff pick an installed model and chat with your **self-hosted Ollama** server.

## How it's wired (and why it's safe)

```
Browser (staff) ─► /api/ai-chat          ─► AI_PROXY_URL ─► server.js :3000 ─► Ollama :11434
                   (same-origin, session     (x-api-key       (checks key,      /models, /chat
                    cookie — no secret)        added here)      fronts Ollama)
```

The browser **never** sees the `x-api-key`. It calls our own Next.js API routes
(`/api/ai-chat`, `/api/ai-chat/models`), which attach the key on the server and
forward to your proxy. So the key can't leak from DevTools, and no CORS setup is
needed. The model dropdown is populated **live** from your proxy, so it always
matches what's been `ollama pull`-ed.

## Confirmed live contract (your server.js on 192.168.10.131:3000)

| Method + path   | Purpose         | Response                                             |
| --------------- | --------------- | ---------------------------------------------------- |
| `GET  /models`  | list models     | `{ models: [{ name, size }] }`                       |
| `POST /chat`    | chat completion | Ollama NDJSON stream (chunks of `message.content`)   |

Both require header `x-api-key`. The Next.js side reassembles the streamed
NDJSON chunks into one reply, and also transparently falls back to
`/api/tags`·`/api/chat` (Ollama native) or `/v1/models`·`/v1/chat/completions`
(OpenAI-shaped) if server.js is ever swapped out.

Currently installed models (from `GET /models`):
`phi4:14b`, `qwen3:8b`, `llama3.1:8b`, `deepseek-r1:8b`, `qwen2.5-coder:7b`.

## Point the app at the proxy

Already set in `.env.local` (gitignored — never commit it):

```env
AI_PROXY_URL=http://192.168.10.131:3000   # LAN — works on the same WiFi, no tunnel
AI_PROXY_KEY=<your-x-api-key>             # the 64-char key server.js checks
```

Restart the Next.js dev server after changing these so it re-reads the env.

> **Same WiFi** → the LAN URL above is all you need. **Hosting the app off-LAN**
> (e.g. the cloudflared tunnel to the dashboard) → the Next.js *server* must be
> able to reach `192.168.10.131:3000`. If it can't, expose server.js with its
> own tunnel (`cloudflared tunnel --url http://192.168.10.131:3000`) and put
> that https URL in `AI_PROXY_URL` instead.

## Agent mode (look up data + create/edit records)

Toggle **Agent** in the chat header (the 🛠 icon marks tool-capable models).
In agent mode the assistant can:

- **Read live data** automatically — search companies/contacts, look up prices,
  invoices, quotations, sale orders, inventory — and answer from real records.
- **Search the web** — `web_search` (public web) + `web_fetch` (read a page).
  `web_fetch` has an SSRF guard that blocks localhost / private-network targets.
- **Create companies, contacts, and quotations** — but it never writes on its
  own. It shows a **confirmation card** with exactly what it will do; nothing is
  written until the staff clicks **Confirm**, and the write is checked against
  that staff member's permissions server-side (a Sales user can't create what
  their role forbids). Quotations auto-number (`Q-XXXXXXX`), compute VAT, and
  store line items as `ItemsJSON` — same shape the app's own creator uses.
- **Remember things** — per-user memory of preferences/facts (recalled into
  future chats) and a saved-skills library. These are benign, user-scoped, and
  apply without a confirm step.

**How tool-calling works (important):** the model emits `<invoke name="tool">`
XML blocks that we parse out of its reply (the Odysseus technique). This means
agent mode works **through the authed `server.js` gateway** and on **every
model** — the gateway stripping the native `tools` field no longer matters.
`qwen3:8b` (🛠) follows the tool format most reliably; `llama3.1:8b` and
`qwen2.5-coder:7b` also do well; `phi4:14b` / `deepseek-r1:8b` work but are less
consistent for multi-step actions.

**Optional config (`.env.local`):**
- `SEARXNG_URL` — point web_search at a self-hosted SearXNG JSON endpoint. If
  unset, web_search falls back to a no-key DuckDuckGo query.
- `AI_OLLAMA_URL` — only used now to mark which models natively support tools
  (the 🛠 hint). Agent mode itself runs through `AI_PROXY_URL`.

Memory/skills are stored in `ai_memory` / `ai_skills` (migration
`supabase/migrations/20260710_ai_memory_skills.sql`, already applied).

**Extending it:** all tools live in [`lib/agentTools.ts`](../lib/agentTools.ts)
(reads run automatically; `write` tools are confirm-gated with a `module`/
`action` permission check; `auto` tools are benign user-scoped writes). Add a
tool there and the loop, confirm flow, and XML prompt pick it up automatically.
Writes execute only in
[`app/api/ai-chat/agent/execute/route.ts`](../app/api/ai-chat/agent/execute/route.ts).

## Attach data, documents & photos

Three ways to give the AI something to work on — all land as removable chips
above the composer and are sent as context (and stay in context for follow-ups):

1. **📎 Attach button** (in the composer) — pick documents or photos.
2. **Drag files from your desktop** onto the chat — a "Drop to attach" overlay
   appears; release to attach.
3. **Drag a table row** (or the whole checkbox selection) from any dashboard
   onto the chat or the floating button.

**Documents** are read to text server-side (`/api/ai-chat/extract`): **PDF**
(pdfjs), **Excel/CSV** (xlsx), and plain-text/markdown/JSON/code. Up to 15 MB.

**Photos** need a **vision model**, which none of the 5 installed models are —
attaching an image shows a note to run `ollama pull llava` (or
`llama3.2-vision`). Once one is installed, image analysis can be wired on.

Table-row drag is on for every table (`enableDragToAI`, opt-out per table);
drags starting on a checkbox, inline-edit field, link, or row-action button are
ignored. Desktop only (mobile cards aren't draggable). Note: making rows
draggable disables in-cell text selection on desktop — pass
`enableDragToAI={false}` on a table if you need selection there.

## Roundtable — models talk to each other

On the full **/assistant** page, the **Roundtable** button (👥) lets several
models converse in the same chat, each in a bubble tagged with its name:

- **Discussion** — pick 2–3 models + a topic; they take turns building on/
  challenging each other for N rounds, then one model summarizes.
- **Debate** — the first two picked argue opposite sides; an optional third
  model judges and gives a verdict.
- **Panel (mixture-of-agents)** — each model answers independently, then one
  merges the best points into a single final answer.

It runs one model turn per call (streamed in live) through the authed gateway —
no server changes, works on all models. A 3-model × 3-round discussion is ~10
calls, so it takes a bit longer; a **Stop** button halts it. Roundtables are
saved in history like any chat.

## Full-page chat + saved history

Beyond the floating popup, there's a full **/assistant** page (open it with the
⤢ expand button in the popup header). It's a real chat workspace like Odysseus:

- **Conversation sidebar** — every chat is saved per-user; click to reopen,
  rename (pencil), delete (trash), or start a **New chat**.
- **Auto-saved** — each turn is persisted to `ai_chat_sessions` (migration
  `20260710_ai_chat_sessions.sql`, applied), titled from your first message.
- Same engine as the popup (model picker, Agent, Knowledge, Skills, confirm
  cards) — the popup and page share one `useAssistantChat` hook, so they never
  drift.

The page is reachable at `/assistant` by any signed-in user (no module
permission required).

## Skills, Knowledge base (RAG), and MCP

Three more agent capabilities, all wired into the same Agent mode.

### Skills (reusable prompts)
Ask the agent to "save this as a skill called X" (`save_skill`), then re-run it
from the chat's **Skills** button (⚡) or by asking it to `run_skill`. Stored
per-user in `ai_skills`. **No server work.**

### Knowledge base / RAG (chat over your documents)
Open the chat's **Knowledge** button (📚) → paste a document (specs, manuals,
policies, price notes). It's chunked, embedded, and stored in Supabase
`pgvector`; the agent retrieves relevant passages with `rag_search`.

- **One-time server step:** the embeddings need an embedding model on Ollama.
  On the server run:
  ```bash
  ollama pull nomic-embed-text
  ```
  Until then, adding a document returns *"Embedding model … is not installed"* —
  everything else keeps working. (Change the model with `AI_EMBED_MODEL`; it
  must be 768-dim to match the `vector(768)` column, or adjust the migration.)
- Storage/search were added by migration `20260710_rag_documents.sql` (pgvector
  + `rag_documents` / `rag_chunks` + `match_rag_chunks()`), already applied.

### MCP (reuse your LPT MCP server's tools)
The agent can discover and call the tools on your running MCP server
(`src/mcp.ts`) via two meta-tools — `mcp_list_tools` (discover) and `mcp_call`
(invoke) — so it gains ~50–70 procurement/accounting/sheets tools without
bloating the prompt.

- Config (`.env.local`): `AGENT_MCP_URL=http://192.168.10.131:8080/mcp` and
  `AGENT_MCP_KEY` (must match the server's `MCP_API_KEY`; blank if no auth).
- **No new server work** — your MCP server already runs on the PC. If it's off,
  the agent simply doesn't get those tools.
- **Safety:** MCP *reads* auto-run; MCP *writes* (`db_create/db_update/db_delete/
  db_upsert/…`) become confirm cards and are restricted to **Admin/Manager**
  roles (they run with the MCP admin key).

## Making it work on Vercel (off-LAN) too

Vercel's servers can't reach the LAN, so each AI service needs a public HTTPS
tunnel. The app calls them **server-side**, so once the URLs are set as Vercel
env vars, every visitor gets AI regardless of their network.

**Chat + agent** — tunnel the authed gateway (`:3000`) and set on Vercel:
`AI_PROXY_URL=https://<tunnel>` and `AI_PROXY_KEY=<key>`. That alone gives chat +
the full agent (CRM, quotations, web search, memory, skills — its data tools hit
Supabase, which Vercel already reaches).

**MCP tools** — the MCP server (`:8080`) is already authed, so tunnel it and set:
`AGENT_MCP_URL=https://<tunnel-8080>/mcp` and `AGENT_MCP_KEY=<key>`.

**RAG (document search)** — do NOT expose Ollama `:11434` (it has no auth). Instead
proxy embeddings through the gateway. Add this route to `server.js` (keeps Ollama
private, reuses the same key):

```js
// server.js — embeddings behind the same x-api-key, proxied to Ollama
app.post('/embed', async (req, res) => {
  const key = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!API_KEY || key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const r = await fetch('http://127.0.0.1:11434/api/embed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: String(e) }); }
});
```

Then on Vercel **leave `AI_OLLAMA_URL` unset** — `lib/agentEmbed.ts` automatically
falls back to `POST <AI_PROXY_URL>/embed`. On the LAN app keep `AI_OLLAMA_URL`
set (it embeds directly against Ollama, faster). Pull the model once:
`ollama pull nomic-embed-text`.

> Quick `trycloudflare` URLs change on restart. For staff-facing use, run a
> **named tunnel** with a domain (e.g. `ai.example.com` → `:3000`,
> `mcp.example.com` → `:8080`) so the URLs are stable.

## Manage models

```bash
ollama list            # names here are exactly what the dropdown shows
ollama pull mistral    # add more; they appear in the dropdown on next open
```

## Troubleshooting

- **"Could not reach the AI server"** in the dropdown → `AI_PROXY_URL` wrong, or
  server.js / Ollama not running, or the key doesn't match. The widget falls
  back to a manual model-id box + retry button.
- **401 from the widget** → your dashboard session expired; sign in again.
- **502 "Proxy error"** → the app reached server.js but it couldn't reach Ollama;
  confirm Ollama is up on `192.168.10.131:11434`.
- **No button at all** → the widget only mounts for signed-in users inside the
  dashboard shell.
