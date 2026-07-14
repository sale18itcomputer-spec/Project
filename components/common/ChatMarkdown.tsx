'use client';

import React, { useState, Suspense } from 'react';
import { Copy, Check, Download, Info, AlertTriangle, Lightbulb, AlertOctagon } from 'lucide-react';

// recharts is heavy — only load it when a chart actually appears.
const ChatChart = React.lazy(() => import('./ChatChart'));

/**
 * Rich, dependency-light Markdown renderer for AI chat replies. Builds React
 * elements (never dangerouslySetInnerHTML). Supports: headings, bold/italic,
 * inline code, links, fenced code (syntax highlight + copy), ```chart blocks,
 * bullet/numbered lists, task lists, GFM tables (copy/CSV export), blockquotes,
 * GitHub-style callouts ([!NOTE]/[!TIP]/[!WARNING]), and horizontal rules.
 */

const INLINE_RE =
  /(\*\*([^*]+?)\*\*|__([^_]+?)__|(?<![\w*])\*([^*\n]+?)\*(?![\w*])|(?<![\w_])_([^_\n]+?)_(?![\w_])|`([^`]+?)`|\[([^\]]+?)\]\(([^)\s]+?)\)|https?:\/\/[^\s)]+)/g;

function safeHref(url: string): string | null {
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
  return null;
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const key = `${keyBase}-${i++}`;
    if (m[2] || m[3]) out.push(<strong key={key}>{m[2] || m[3]}</strong>);
    else if (m[4] || m[5]) out.push(<em key={key}>{m[4] || m[5]}</em>);
    else if (m[6]) out.push(<code key={key} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/15 text-[0.85em] font-mono">{m[6]}</code>);
    else if (m[7] && m[8]) {
      const href = safeHref(m[8]);
      out.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline break-all">{m[7]}</a>
        : <span key={key}>{m[7]}</span>);
    } else if (m[0]) {
      const href = safeHref(m[0]);
      out.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline break-all">{m[0]}</a>
        : m[0]);
    }
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── Lightweight syntax highlighter (comments, strings, numbers, keywords) ────────
const HL_RE = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|if|else|elif|for|while|import|from|export|class|new|await|async|try|catch|finally|throw|typeof|instanceof|switch|case|break|continue|default|null|true|false|undefined|this|def|None|True|False|and|or|not|in|is|lambda|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|GROUP|ORDER|LIMIT|BY|AND|OR|NOT)\b)/g;

function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0, i = 0, m: RegExpExecArray | null;
  HL_RE.lastIndex = 0;
  while ((m = HL_RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'text-muted-foreground italic' : m[2] ? 'text-green-600 dark:text-green-400'
      : m[3] ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600 font-medium';
    out.push(<span key={i++} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-2.5 py-1 bg-muted/60 text-[10px] text-muted-foreground">
        <span className="font-mono uppercase tracking-wide">{lang || 'code'}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 hover:text-foreground transition">
          {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="text-[12px] font-mono bg-black/[0.06] dark:bg-white/[0.06] p-2.5 overflow-x-auto"><code>{highlight(code)}</code></pre>
    </div>
  );
};

// ── Callouts ─────────────────────────────────────────────────────────────────
const CALLOUTS: Record<string, { cls: string; icon: React.ReactNode }> = {
  note: { cls: 'border-brand-600/40 bg-brand-600/10 text-foreground', icon: <Info size={14} className="text-brand-600" /> },
  tip: { cls: 'border-green-500/40 bg-green-500/10 text-foreground', icon: <Lightbulb size={14} className="text-green-600" /> },
  warning: { cls: 'border-amber-500/40 bg-amber-500/10 text-foreground', icon: <AlertTriangle size={14} className="text-amber-600" /> },
  important: { cls: 'border-violet-500/40 bg-violet-500/10 text-foreground', icon: <AlertOctagon size={14} className="text-violet-600" /> },
  caution: { cls: 'border-destructive/40 bg-destructive/10 text-foreground', icon: <AlertOctagon size={14} className="text-destructive" /> },
};

// ── Table with copy / CSV export ─────────────────────────────────────────────
const MdTable: React.FC<{ header: string[]; rows: string[][]; kb: string }> = ({ header, rows, kb }) => {
  const [copied, setCopied] = useState(false);
  const all = [header, ...rows];
  const copyTsv = () => navigator.clipboard?.writeText(all.map(r => r.join('\t')).join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const downloadCsv = () => {
    const csv = all.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'table.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-1 text-[10px] text-muted-foreground">
        <button type="button" onClick={copyTsv} className="flex items-center gap-1 hover:text-foreground transition">{copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'copied' : 'copy'}</button>
        <button type="button" onClick={downloadCsv} className="flex items-center gap-1 hover:text-foreground transition"><Download size={11} /> CSV</button>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="text-[12px] border-collapse w-full">
          <thead>
            <tr>{header.map((h, hi) => <th key={hi} className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold whitespace-nowrap">{renderInline(h, `${kb}-h${hi}`)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="even:bg-muted/20">
                {header.map((_, ci) => <td key={ci} className="border border-border px-2 py-1 align-top">{renderInline(r[ci] ?? '', `${kb}-${ri}-${ci}`)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Block parsing ─────────────────────────────────────────────────────────────
interface Block {
  type: 'p' | 'h' | 'ul' | 'ol' | 'code' | 'quote' | 'hr' | 'table';
  level?: number;
  lines?: string[];
  items?: string[];
  header?: string[];
  rows?: string[][];
  lang?: string;
  callout?: string;
}

function isTableSeparator(line?: string): boolean {
  if (!line || !line.includes('-')) return false;
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length >= 1 && cells.every(c => /^\s*:?-+:?\s*$/.test(c));
}
const splitRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
const isTableStart = (lines: string[], i: number) => !!lines[i]?.includes('|') && isTableSeparator(lines[i + 1]);

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
      i++;
      blocks.push({ type: 'code', lines: body, lang: fence[1] });
      continue;
    }

    if (line.trim() === '') { i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: 'h', level: h[1].length, lines: [h[2]] }); i++; continue; }

    // Blockquote / callout
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      const co = body[0]?.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i);
      if (co) {
        const rest = [co[2], ...body.slice(1)].filter(Boolean);
        blocks.push({ type: 'quote', lines: rest, callout: co[1].toLowerCase() });
      } else {
        blocks.push({ type: 'quote', lines: body });
      }
      continue;
    }

    // Unordered / task list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      blocks.push({ type: 'ol', items });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() !== '' &&
      !/^```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) && !/^\s*([-*_])\1{2,}\s*$/.test(lines[i]) &&
      !isTableStart(lines, i)
    ) { para.push(lines[i]); i++; }
    blocks.push({ type: 'p', lines: para });
  }
  return blocks;
}

const HSIZE: Record<number, string> = { 1: 'text-base', 2: 'text-[15px]', 3: 'text-sm' };
const TASK_RE = /^\[([ xX])\]\s+(.*)$/;

export const ChatMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const blocks = parseBlocks(content || '');
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, bi) => {
        const k = `b${bi}`;
        switch (b.type) {
          case 'hr':
            return <hr key={k} className="border-border" />;
          case 'code': {
            const code = (b.lines ?? []).join('\n');
            if ((b.lang || '').toLowerCase() === 'chart') {
              return (
                <Suspense key={k} fallback={<div className="text-xs text-muted-foreground py-2">Loading chart…</div>}>
                  <ChatChart spec={code} />
                </Suspense>
              );
            }
            return <CodeBlock key={k} code={code} lang={b.lang} />;
          }
          case 'h':
            return <p key={k} className={`font-semibold ${HSIZE[b.level ?? 3] ?? 'text-sm'}`}>{renderInline((b.lines ?? [''])[0], k)}</p>;
          case 'quote': {
            if (b.callout && CALLOUTS[b.callout]) {
              const c = CALLOUTS[b.callout];
              return (
                <div key={k} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${c.cls}`}>
                  <span className="mt-0.5 shrink-0">{c.icon}</span>
                  <div className="min-w-0">{renderInline((b.lines ?? []).join(' '), k)}</div>
                </div>
              );
            }
            return <blockquote key={k} className="border-l-2 border-border pl-3 text-muted-foreground">{renderInline((b.lines ?? []).join(' '), k)}</blockquote>;
          }
          case 'ul': {
            const items = b.items ?? [];
            const isTasks = items.length > 0 && items.every(it => TASK_RE.test(it));
            if (isTasks) {
              return (
                <ul key={k} className="space-y-1">
                  {items.map((it, ii) => {
                    const m = it.match(TASK_RE)!;
                    return (
                      <li key={ii} className="flex items-start gap-2">
                        <input type="checkbox" checked={m[1].toLowerCase() === 'x'} readOnly className="mt-1 accent-brand-600" />
                        <span className={m[1].toLowerCase() === 'x' ? 'line-through text-muted-foreground' : ''}>{renderInline(m[2], `${k}-${ii}`)}</span>
                      </li>
                    );
                  })}
                </ul>
              );
            }
            return <ul key={k} className="list-disc pl-5 space-y-0.5">{items.map((it, ii) => <li key={ii}>{renderInline(it, `${k}-${ii}`)}</li>)}</ul>;
          }
          case 'ol':
            return <ol key={k} className="list-decimal pl-5 space-y-0.5">{(b.items ?? []).map((it, ii) => <li key={ii}>{renderInline(it, `${k}-${ii}`)}</li>)}</ol>;
          case 'table':
            return <MdTable key={k} header={b.header ?? []} rows={b.rows ?? []} kb={k} />;
          default: {
            const ls = b.lines ?? [];
            return (
              <p key={k}>
                {ls.map((ln, li) => (
                  <React.Fragment key={li}>{li > 0 && <br />}{renderInline(ln, `${k}-${li}`)}</React.Fragment>
                ))}
              </p>
            );
          }
        }
      })}
    </div>
  );
};

export default ChatMarkdown;
