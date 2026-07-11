/**
 * XML tool-calling — the Odysseus technique.
 * ─────────────────────────────────────────────────────────────
 * Native function-calling only works on some models and gets stripped by the
 * server.js gateway. Instead we teach the model to emit tool calls as text:
 *
 *   <invoke name="search_companies">
 *     <parameter name="query">Acme</parameter>
 *   </invoke>
 *
 * …and parse those blocks out of the reply. This makes agent mode work on ALL
 * models and THROUGH the authenticated gateway (no direct Ollama needed).
 *
 * Parameter values are parsed as JSON when possible (so objects/numbers/bools
 * survive), otherwise kept as trimmed strings.
 */
import type { AgentTool } from './agentTools';

const INVOKE_RE = /<invoke\s+name=["']([\w-]+)["']\s*>([\s\S]*?)<\/invoke>/gi;
const PARAM_RE = /<parameter\s+name=["']([\w-]+)["']\s*>([\s\S]*?)<\/parameter>/gi;

export interface ParsedInvoke {
  name: string;
  args: Record<string, any>;
}

function coerce(raw: string): any {
  const t = raw.trim();
  if (t === '') return '';
  // Try JSON first so objects/arrays/numbers/booleans round-trip.
  if (/^[[{]/.test(t) || /^(true|false|null|-?\d)/.test(t)) {
    try { return JSON.parse(t); } catch { /* fall through to string */ }
  }
  return t;
}

/** Extract all <invoke> tool calls from a model reply. */
export function parseInvokes(text: string): ParsedInvoke[] {
  const out: ParsedInvoke[] = [];
  if (!text) return out;
  for (const m of text.matchAll(INVOKE_RE)) {
    const name = m[1];
    const body = m[2] ?? '';
    const args: Record<string, any> = {};
    let hadParam = false;
    for (const p of body.matchAll(PARAM_RE)) {
      hadParam = true;
      args[p[1]] = coerce(p[2] ?? '');
    }
    // Some models put a JSON object directly inside <invoke> instead of <parameter>s.
    if (!hadParam) {
      const inner = body.trim();
      if (inner.startsWith('{')) {
        try { Object.assign(args, JSON.parse(inner)); } catch { /* ignore */ }
      }
    }
    out.push({ name, args });
  }
  return out;
}

/** Remove <invoke> blocks from text so only the model's prose is shown. */
export function stripInvokes(text: string): string {
  return (text || '').replace(INVOKE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Build the system-prompt section that documents the tools + the call format. */
export function buildToolInstructions(tools: AgentTool[]): string {
  const lines: string[] = [
    'You have tools. To use one, output an <invoke> block EXACTLY like this and nothing else in that turn:',
    '<invoke name="tool_name">',
    '  <parameter name="argument">value</parameter>',
    '</invoke>',
    'For object arguments, put JSON as the parameter value, e.g. <parameter name="data">{"Industry":"IT"}</parameter>.',
    'You may call a tool, then use its result to answer. When you have the answer, reply in plain text with NO <invoke> block.',
    '',
    'Available tools:',
  ];
  for (const t of tools) {
    const props = (t.parameters?.properties ?? {}) as Record<string, any>;
    const req: string[] = t.parameters?.required ?? [];
    const params = Object.entries(props)
      .map(([k, v]) => `${k}${req.includes(k) ? '' : '?'}: ${v?.type ?? 'any'}`)
      .join(', ');
    const tag = t.kind === 'write' ? ' [needs user confirmation]' : '';
    lines.push(`- ${t.name}(${params}) — ${t.description}${tag}`);
  }
  return lines.join('\n');
}
