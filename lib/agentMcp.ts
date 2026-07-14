/**
 * MCP client — lets the agent use the LPT MCP server's ~70 tools.
 * ─────────────────────────────────────────────────────────────
 * Rather than dumping all MCP tools into the prompt (token bloat, worse tool
 * selection), the agent gets two meta-tools: mcp_list_tools (discover) and
 * mcp_call (invoke). Write-safety is preserved because the agent route inspects
 * the *target* tool name via inferMcpKind() — MCP writes become confirm cards.
 *
 * Config (.env.local): AGENT_MCP_URL, AGENT_MCP_KEY (Bearer; blank if no auth).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function cfg(): { url: string; key: string } | null {
  const url = (process.env.AGENT_MCP_URL || '').trim();
  return url ? { url, key: (process.env.AGENT_MCP_KEY || '').trim() } : null;
}
export function mcpConfigured(): boolean {
  return !!cfg();
}

/** Read tools are safe to auto-run; everything else is treated as a write. */
export function inferMcpKind(name: string): 'read' | 'write' {
  return /^(db_get|db_search|sheets_read|sheets_list)/.test(name || '') ? 'read' : 'write';
}

let clientPromise: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const c = cfg();
  if (!c) throw new Error('MCP not configured');
  const transport = new StreamableHTTPClientTransport(new URL(c.url), {
    requestInit: { headers: c.key ? { Authorization: `Bearer ${c.key}` } : {} },
  });
  const client = new Client({ name: 'lpt-agent', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connect().catch(e => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

export interface McpToolInfo { name: string; description: string; }

let infoCache: { at: number; tools: McpToolInfo[] } | null = null;

/** List available MCP tool names + descriptions, optionally keyword-filtered. */
export async function listMcpToolsInfo(filter?: string): Promise<McpToolInfo[]> {
  if (!cfg()) return [];
  if (!infoCache || Date.now() - infoCache.at > 5 * 60_000) {
    try {
      const client = await getClient();
      const list: any = await client.listTools();
      infoCache = {
        at: Date.now(),
        tools: (list?.tools ?? []).map((t: any) => ({ name: t.name, description: (t.description || '').slice(0, 160) })),
      };
    } catch {
      clientPromise = null;
      if (!infoCache) return [];
    }
  }
  const f = (filter || '').trim().toLowerCase();
  const all = infoCache.tools;
  return f ? all.filter(t => t.name.toLowerCase().includes(f) || t.description.toLowerCase().includes(f)) : all;
}

/** Invoke an MCP tool and return its parsed result. */
export async function callMcpTool(name: string, args: Record<string, any>): Promise<any> {
  if (!cfg()) throw new Error('MCP not configured');
  let client: Client;
  try { client = await getClient(); }
  catch { throw new Error('MCP server unreachable'); }
  try {
    const res: any = await client.callTool({ name, arguments: args ?? {} });
    const text = (res?.content ?? []).map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('\n');
    try { return JSON.parse(text); } catch { return text || res; }
  } catch (e: any) {
    clientPromise = null; // force reconnect next time
    throw new Error(e?.message || 'MCP call failed');
  }
}
