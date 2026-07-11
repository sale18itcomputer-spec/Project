'use client';

import React, { useState } from 'react';
import {
  Wrench, AlertCircle, Bot, Sparkles, Check, XCircle, Loader2,
  ArrowLeft, BookText, Plus, FileText, Trash2, Zap, Play, Users, Paperclip, X, Table2, Copy,
} from 'lucide-react';
import ChatMarkdown from '../common/ChatMarkdown';
import type { UiMessage, RoundtableMode, RoundtableConfig, Attachment } from '../../hooks/useAssistantChat';

/** Copy-to-clipboard button under an assistant reply (shows on hover). */
const MessageActions: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  return (
    <button type="button" onClick={copy}
      className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition">
      {copied ? <Check size={11} /> : <Copy size={11} />}{copied ? 'copied' : 'copy'}
    </button>
  );
};

/** Full-surface "Drop to attach" overlay shown while dragging over the chat. */
export const DropOverlay: React.FC<{ show: boolean }> = ({ show }) =>
  show ? (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-brand-600/10 backdrop-blur-[1px] border-2 border-dashed border-brand-600 rounded-2xl pointer-events-none">
      <div className="flex items-center gap-2 text-brand-600 font-semibold text-sm bg-card/95 px-4 py-2 rounded-full shadow-lg">
        <Paperclip size={16} /> Drop to attach
      </div>
    </div>
  ) : null;

/** Chips for data dragged from a table, shown above the composer. */
export const AttachmentChips: React.FC<{ items: Attachment[]; onRemove: (id: string) => void }> = ({ items, onRemove }) => {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-2">
      {items.map(a => (
        <span key={a.id} className="inline-flex items-center gap-1 text-[11px] bg-brand-600/10 text-brand-600 border border-brand-600/30 rounded-full pl-2 pr-1 py-0.5">
          <Table2 size={11} /> {a.label}
          <button type="button" onClick={() => onRemove(a.id)} className="rounded-full hover:bg-brand-600/20 p-0.5"><X size={11} /></button>
        </span>
      ))}
    </div>
  );
};

// ── Message thread ───────────────────────────────────────────────────────────

export const ChatThread: React.FC<{
  messages: UiMessage[];
  sending: boolean;
  chatError: string | null;
  emptyState?: React.ReactNode;
  onResolve: (id: string, confirm: boolean) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}> = ({ messages, sending, chatError, emptyState, onResolve, scrollRef, className }) => (
  <div ref={scrollRef} className={className ?? 'flex-1 overflow-y-auto px-4 py-3 space-y-3'}>
    {messages.length === 0 && !sending && emptyState}

    {messages.map(m => {
      if (m.role === 'proposal' && m.proposal) return <ProposalCard key={m.id} msg={m} onResolve={onResolve} />;
      return (
        <div key={m.id} className={`group flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-[85%]">
            {m.speaker && (
              <div className="flex items-center gap-1 text-[10px] font-semibold text-brand-600 mb-0.5 px-1">
                <Users size={10} /> {m.speaker}
              </div>
            )}
            {m.attached && m.attached.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1 justify-end">
                {m.attached.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    <Paperclip size={10} /> {a.label}
                  </span>
                ))}
              </div>
            )}
            {m.activity && m.activity.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {m.activity.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    <Wrench size={10} /> {a.name}
                  </span>
                ))}
              </div>
            )}
            <div className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
              m.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm whitespace-pre-wrap' : 'bg-muted text-foreground rounded-bl-sm'
            }`}>
              {m.role === 'user' ? m.content : <ChatMarkdown content={m.content ?? ''} />}
            </div>
            {m.role === 'assistant' && m.content && <MessageActions text={m.content} />}
          </div>
        </div>
      );
    })}

    {sending && (
      <div className="flex justify-start">
        <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
        </div>
      </div>
    )}
    {chatError && (
      <div className="flex items-start gap-2 text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span>{chatError}</span>
      </div>
    )}
  </div>
);

export const EmptyHint: React.FC<{ agent: boolean }> = ({ agent }) => (
  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground px-4">
    <Bot size={32} className="mb-2 opacity-40" />
    <p className="text-sm font-medium text-foreground">How can I help?</p>
    <p className="text-xs mt-1 max-w-sm">
      {agent
        ? 'Ask me to look something up (records, prices, the web, your documents), or to create a company, contact, or quotation — you’ll confirm before anything changes.'
        : 'Ask anything. Conversations stay on your own server.'}
    </p>
  </div>
);

// ── Proposal (confirm-before-write) card ─────────────────────────────────────

export const ProposalCard: React.FC<{ msg: UiMessage; onResolve: (id: string, confirm: boolean) => void }> = ({ msg, onResolve }) => {
  const p = msg.proposal!;
  const status = msg.status ?? 'pending';
  const lines: [string, string][] = [];
  for (const [k, v] of Object.entries(p.args ?? {})) {
    if (k === 'data' && v && typeof v === 'object') {
      for (const [dk, dv] of Object.entries(v as Record<string, any>)) lines.push([dk, String(dv)]);
    } else {
      lines.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    }
  }
  const done = status === 'done', canceled = status === 'canceled', error = status === 'error';
  const border = done ? 'border-green-500/40' : error ? 'border-destructive/40' : canceled ? 'border-border' : 'border-brand-600/40';

  return (
    <div className={`rounded-xl border ${border} bg-card overflow-hidden`}>
      <div className="px-3 py-2 bg-muted/50 flex items-center gap-2">
        <Sparkles size={14} className="text-brand-600 shrink-0" />
        <span className="text-xs font-semibold text-foreground flex-1">{p.summary}</span>
        {done && <span className="text-[10px] font-medium text-green-600 flex items-center gap-1"><Check size={12} /> applied</span>}
        {canceled && <span className="text-[10px] font-medium text-muted-foreground">canceled</span>}
        {error && <span className="text-[10px] font-medium text-destructive">failed</span>}
      </div>
      {lines.length > 0 && (
        <div className="px-3 py-2 space-y-0.5">
          {lines.slice(0, 8).map(([k, v], i) => (
            <div key={i} className="flex gap-2 text-[11px]">
              <span className="text-muted-foreground shrink-0 min-w-[90px]">{k}</span>
              <span className="text-foreground break-words">{v}</span>
            </div>
          ))}
        </div>
      )}
      {error && msg.resultMsg && <div className="px-3 pb-2 text-[11px] text-destructive">{msg.resultMsg}</div>}
      {status === 'pending' && (
        <div className="px-3 py-2 flex items-center justify-end gap-2 border-t border-border">
          <button type="button" onClick={() => onResolve(msg.id, false)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition">
            <XCircle size={14} /> Cancel
          </button>
          <button type="button" onClick={() => onResolve(msg.id, true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition">
            <Check size={14} /> Confirm
          </button>
        </div>
      )}
      {status === 'confirming' && (
        <div className="px-3 py-2 flex items-center justify-end gap-2 border-t border-border text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> applying…
        </div>
      )}
    </div>
  );
};

// ── Knowledge base panel (RAG upload) ────────────────────────────────────────

export const KnowledgePanel: React.FC<{
  docs: any[]; titleVal: string; textVal: string; busy: boolean; msg: string | null;
  onTitle: (v: string) => void; onText: (v: string) => void;
  onAdd: () => void; onDelete: (id: string) => void; onBack: () => void;
}> = ({ docs, titleVal, textVal, busy, msg, onTitle, onText, onAdd, onDelete, onBack }) => (
  <div className="flex-1 min-h-0 flex flex-col">
    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
      <button type="button" onClick={onBack} className="p-1 rounded-md text-muted-foreground hover:bg-muted"><ArrowLeft size={16} /></button>
      <BookText size={15} className="text-brand-600" />
      <span className="text-sm font-semibold text-foreground">Knowledge base</span>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <p className="text-[11px] text-muted-foreground">Add documents (specs, manuals, policies, price notes). The agent searches them with <span className="font-mono">rag_search</span>.</p>
      <input value={titleVal} onChange={e => onTitle(e.target.value)} placeholder="Document title"
        className="w-full text-sm bg-input-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      <textarea value={textVal} onChange={e => onText(e.target.value)} rows={5} placeholder="Paste the document text here…"
        className="w-full resize-none text-sm bg-input-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      <button type="button" onClick={onAdd} disabled={busy || !titleVal.trim() || !textVal.trim()}
        className="w-full flex items-center justify-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 disabled:opacity-40">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add to knowledge base
      </button>
      {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
      {docs.length > 0 && (
        <div className="pt-2 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Documents ({docs.length})</p>
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-2 text-xs rounded-lg border border-border px-2.5 py-1.5">
              <FileText size={13} className="text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-foreground">{d.title}</span>
              <button type="button" onClick={() => onDelete(d.id)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ── Skills panel ─────────────────────────────────────────────────────────────

export const SkillsPanel: React.FC<{ skills: any[]; onRun: (prompt: string) => void; onBack: () => void }> = ({ skills, onRun, onBack }) => (
  <div className="flex-1 min-h-0 flex flex-col">
    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
      <button type="button" onClick={onBack} className="p-1 rounded-md text-muted-foreground hover:bg-muted"><ArrowLeft size={16} /></button>
      <Zap size={15} className="text-brand-600" />
      <span className="text-sm font-semibold text-foreground">Skills</span>
    </div>
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      {skills.length === 0 ? (
        <div className="text-center text-muted-foreground pt-6">
          <Zap size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">No saved skills yet.</p>
          <p className="text-[11px] mt-1">In Agent chat, say “save this as a skill called …”.</p>
        </div>
      ) : skills.map((s, i) => (
        <div key={i} className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm font-medium text-foreground truncate">{s.name}</span>
            <button type="button" onClick={() => onRun(s.prompt)} className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-md px-2 py-1"><Play size={12} /> Run</button>
          </div>
          {s.prompt && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{s.prompt}</p>}
        </div>
      ))}
    </div>
  </div>
);

// ── Roundtable setup (models talk to each other) ─────────────────────────────

const MODE_INFO: Record<RoundtableMode, { label: string; hint: string; minModels: number }> = {
  discuss: { label: 'Discussion', hint: 'Models take turns building on each other, then one summarizes.', minModels: 2 },
  debate:  { label: 'Debate', hint: 'First two argue opposite sides; a third (optional) judges.', minModels: 2 },
  panel:   { label: 'Panel', hint: 'Each answers independently, then one merges the best answer.', minModels: 2 },
};

export const RoundtablePanel: React.FC<{
  models: string[]; running: boolean;
  onStart: (cfg: RoundtableConfig) => void; onStop: () => void; onBack: () => void;
}> = ({ models, running, onStart, onStop, onBack }) => {
  const [mode, setMode] = useState<RoundtableMode>('discuss');
  const [picked, setPicked] = useState<string[]>(models.slice(0, 2));
  const [rounds, setRounds] = useState(2);
  const [topic, setTopic] = useState('');

  const toggle = (m: string) => setPicked(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const info = MODE_INFO[mode];
  const canStart = !running && topic.trim().length > 0 && picked.length >= info.minModels;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <button type="button" onClick={onBack} className="p-1 rounded-md text-muted-foreground hover:bg-muted"><ArrowLeft size={16} /></button>
        <Users size={15} className="text-brand-600" />
        <span className="text-sm font-semibold text-foreground">Roundtable — models talk to each other</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Mode */}
        <div className="flex gap-1.5">
          {(Object.keys(MODE_INFO) as RoundtableMode[]).map(k => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={`flex-1 text-xs rounded-lg px-2 py-1.5 border transition ${mode === k ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              {MODE_INFO[k].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{info.hint}</p>

        {/* Participants */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">
            Participants {mode === 'debate' && <span>(order: 1st = for, 2nd = against, 3rd = judge)</span>}
          </p>
          <div className="space-y-1">
            {models.map(m => {
              const idx = picked.indexOf(m);
              return (
                <button key={m} type="button" onClick={() => toggle(m)}
                  className={`w-full flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border transition ${idx >= 0 ? 'border-brand-600/50 bg-brand-600/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  <span className={`h-4 w-4 rounded flex items-center justify-center text-[9px] font-bold ${idx >= 0 ? 'bg-brand-600 text-white' : 'border border-border'}`}>{idx >= 0 ? idx + 1 : ''}</span>
                  <span className="flex-1 text-left truncate">{m}</span>
                </button>
              );
            })}
            {models.length === 0 && <p className="text-[11px] text-muted-foreground">No models available.</p>}
          </div>
        </div>

        {/* Rounds */}
        {mode !== 'panel' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">Rounds</span>
            {[1, 2, 3].map(r => (
              <button key={r} type="button" onClick={() => setRounds(r)}
                className={`h-7 w-7 text-xs rounded-md border transition ${rounds === r ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>{r}</button>
            ))}
          </div>
        )}

        {/* Topic */}
        <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3}
          placeholder={mode === 'debate' ? 'The statement to debate, e.g. “We should standardize on Dell servers.”' : 'The question or topic for the models to discuss…'}
          className="w-full resize-none text-sm bg-input-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />

        {running ? (
          <button type="button" onClick={onStop}
            className="w-full flex items-center justify-center gap-1.5 text-sm bg-destructive/90 hover:bg-destructive text-white rounded-lg py-2">
            <Loader2 size={16} className="animate-spin" /> Running… tap to stop
          </button>
        ) : (
          <button type="button" onClick={() => { onStart({ mode, models: picked, topic, rounds }); onBack(); }} disabled={!canStart}
            className="w-full flex items-center justify-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 disabled:opacity-40">
            <Play size={16} /> Start roundtable
          </button>
        )}
      </div>
    </div>
  );
};
