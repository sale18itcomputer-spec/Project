'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared chat engine for both the floating widget and the full-page assistant.
 * Owns: model list, agent toggle, message thread, send/agent loop, write
 * proposals, knowledge base + skills, and (when persist=true) saved sessions.
 */

export type Activity = { name: string; args: Record<string, any> };
export type Proposal = { tool: string; module?: string; action?: string; args: Record<string, any>; summary: string };
export type ProposalStatus = 'pending' | 'confirming' | 'done' | 'canceled' | 'error';

export interface Attachment { id: string; label: string; text: string; }

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant' | 'proposal';
  content?: string;
  activity?: Activity[];
  proposal?: Proposal;
  status?: ProposalStatus;
  resultMsg?: string;
  /** Model name when this bubble is a participant in a multi-model roundtable. */
  speaker?: string;
  /** Data dragged in from a table, sent as context with this message. */
  attached?: { label: string; text: string }[];
}

export type RoundtableMode = 'discuss' | 'debate' | 'panel';
export interface RoundtableConfig {
  mode: RoundtableMode;
  models: string[];   // participants (debate uses first 2; a 3rd is the judge)
  topic: string;
  rounds: number;     // discuss/debate
}

export interface SessionSummary { id: string; title: string; model?: string; agent?: boolean; updated_at: string; }

const MODEL_KEY = 'lpt-ai-chat-model';
const AGENT_KEY = 'lpt-ai-chat-agent';
export const uid = () => Math.random().toString(36).slice(2);

// Strip internal/noisy fields and parse embedded JSON (e.g. ItemsJSON) so the
// model sees clean, readable business data instead of raw rows.
const NOISY_KEY = /^(id|uuid|user_id|created_at|updated_at|file|.*_id|commission|no)$/i;
function cleanAny(x: any): any {
  if (Array.isArray(x)) return x.map(cleanAny);
  if (x && typeof x === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(x)) {
      if (NOISY_KEY.test(k)) continue;
      if (v == null || v === '') continue;
      out[k.replace(/JSON$/i, '')] = cleanValue(v);
    }
    return out;
  }
  return x;
}
function cleanValue(v: any): any {
  if (typeof v === 'string' && /^\s*[[{]/.test(v)) {
    try { return cleanAny(JSON.parse(v)); } catch { /* keep string */ }
  }
  return v;
}
const LABEL_KEYS = ['Quote No', 'Inv No', 'SO No', 'DO No', 'po_number', 'PO No', 'Pipeline No', 'Company Name', 'Name', 'code', 'serial_number', 'part_no', 'ticket_no', 'pdi_no', 'inquiry_no'];
function rowLabel(row: any): string | null {
  for (const k of LABEL_KEYS) if (row?.[k]) return String(row[k]);
  return null;
}

export function useAssistantChat({ persist }: { persist: boolean }) {
  const [models, setModels] = useState<string[]>([]);
  const [toolModels, setToolModels] = useState<string[]>([]);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [model, setModelState] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [agent, setAgent] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  // knowledge base + skills
  const [docs, setDocs] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [kbTitle, setKbTitle] = useState('');
  const [kbText, setKbText] = useState('');
  const [kbBusy, setKbBusy] = useState(false);
  const [kbMsg, setKbMsg] = useState<string | null>(null);

  // sessions
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const modelsLoadedRef = useRef(false);
  const agentPrefRef = useRef(false);
  const modelSupportsTools = !model || toolModels.length === 0 ? false : toolModels.includes(model);

  const setModel = useCallback((m: string) => {
    setModelState(m);
    try { localStorage.setItem(MODEL_KEY, m); } catch { /* ignore */ }
  }, []);

  // Agent mode is sharpest on qwen3 (best reasoning + tools). When it's turned
  // on, switch to a qwen3 model automatically — but respect a later manual pick.
  useEffect(() => {
    if (!agent) { agentPrefRef.current = false; return; }
    if (agentPrefRef.current || toolModels.length === 0) return;
    agentPrefRef.current = true;
    const pref = toolModels.find(m => /qwen3/i.test(m));
    if (pref && !/qwen3/i.test(model)) setModel(pref);
  }, [agent, toolModels, model, setModel]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch('/api/ai-chat/models');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Error ${res.status}`);
      const list: string[] = data.models ?? [];
      setModels(list);
      setToolModels(data.toolModels ?? []);
      setAgentEnabled(!!data.agentEnabled);
      if (list.length) {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(MODEL_KEY) : null;
        setModelState(saved && list.includes(saved) ? saved : list[0]);
      }
    } catch (e: any) {
      setModelsError(e?.message || 'Could not reach the AI server.');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const ensureLoaded = useCallback(() => {
    if (modelsLoadedRef.current) return;
    modelsLoadedRef.current = true;
    setAgent(typeof window !== 'undefined' && localStorage.getItem(AGENT_KEY) === '1');
    loadModels();
  }, [loadModels]);

  const toggleAgent = useCallback(() => {
    setAgent(prev => {
      const next = !prev;
      try { localStorage.setItem(AGENT_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const apiHistory = (msgs: UiMessage[]) =>
    msgs
      .filter(m => (m.role === 'user' || m.role === 'assistant') && (!!m.content || (m.role === 'user' && !!m.attached?.length)))
      .map(m => {
        let content = m.content ?? '';
        if (m.role === 'user' && m.attached?.length) {
          const ctx = m.attached.map(a => `Attached data — ${a.label}:\n\`\`\`json\n${a.text}\n\`\`\``).join('\n\n');
          content = ctx + (content ? `\n\n${content}` : '');
        }
        return { role: m.role as 'user' | 'assistant', content };
      });

  const addAttachment = useCallback((a: { label: string; text: string }) => {
    setPendingAttachments(prev => [...prev, { id: uid(), ...a }]);
  }, []);
  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  }, []);
  /** Attach rows dragged from a table — cleaned to readable business data. */
  const addRowsAttachment = useCallback((payload: { source?: string; count?: number; rows?: any[] }) => {
    const rows = Array.isArray(payload?.rows) ? payload.rows.slice(0, 50) : [];
    if (rows.length === 0) return;
    const kind = (payload.source || 'record').replace(/[-_]?(table|dashboard)$/i, '').replace(/[-_]+/g, ' ').trim() || 'record';
    const label = rows.length === 1 ? (rowLabel(rows[0]) || `1 ${kind}`) : `${rows.length} ${kind} rows`;
    const cleaned = rows.map(cleanAny);
    const text = JSON.stringify(cleaned, null, rows.length === 1 ? 1 : 0).slice(0, 16_000);
    addAttachment({ label, text });
  }, [addAttachment]);

  const [attaching, setAttaching] = useState(false);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  /** Attach uploaded files (documents extracted to text; images need a vision model). */
  const attachFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setAttachNote(null);
    setAttaching(true);
    try {
      for (const f of list) {
        if (f.type.startsWith('image/')) {
          setAttachNote('Images need a vision model, which isn’t installed yet — run “ollama pull llava” on the server to enable photo analysis.');
          continue;
        }
        const fd = new FormData();
        fd.append('file', f);
        try {
          const res = await fetch('/api/ai-chat/extract', { method: 'POST', body: fd });
          const d = await res.json();
          if (!res.ok || !d.ok) { setAttachNote(d.error || `Couldn’t read ${f.name}.`); continue; }
          if (d.kind === 'text') addAttachment({ label: d.title || f.name, text: d.text || '' });
        } catch { setAttachNote(`Couldn’t read ${f.name}.`); }
      }
    } finally {
      setAttaching(false);
    }
  }, [addAttachment]);

  const runText = useCallback(async (text: string, onError?: () => void) => {
    if ((!text && pendingAttachments.length === 0) || sending || !model) return;
    const attached = pendingAttachments.length ? pendingAttachments.map(a => ({ label: a.label, text: a.text })) : undefined;
    const userMsg: UiMessage = { id: uid(), role: 'user', content: text, attached };
    setPendingAttachments([]);
    const base = [...messages, userMsg];
    setMessages(base);
    setChatError(null);
    setSending(true);
    try {
      if (agent && agentEnabled) {
        const res = await fetch('/api/ai-chat/agent', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: apiHistory(base) }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || `Error ${res.status}`);
        if (data.type === 'confirm') {
          const extra: UiMessage[] = [];
          if (data.assistantText) extra.push({ id: uid(), role: 'assistant', content: data.assistantText, activity: data.activity });
          extra.push({ id: uid(), role: 'proposal', proposal: data.proposal, status: 'pending', activity: data.activity });
          setMessages(prev => [...prev, ...extra]);
        } else {
          setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: data.reply ?? '', activity: data.activity }]);
        }
      } else {
        const res = await fetch('/api/ai-chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: apiHistory(base) }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || `Error ${res.status}`);
        setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: data.reply ?? '' }]);
      }
    } catch (e: any) {
      setChatError(e?.message || 'Request failed.');
      onError?.();
      setMessages(messages);
    } finally {
      setSending(false);
    }
  }, [sending, model, messages, agent, agentEnabled, pendingAttachments]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text && pendingAttachments.length === 0) return;
    setInput('');
    runText(text, () => setInput(text));
  }, [input, runText, pendingAttachments.length]);

  const resolveProposal = useCallback(async (id: string, confirm: boolean) => {
    const card = messages.find(m => m.id === id);
    if (!card?.proposal) return;
    if (!confirm) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'canceled' as const } : m)
        .concat({ id: uid(), role: 'assistant', content: '(You canceled that action.)' }));
      return;
    }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'confirming' as const } : m));
    try {
      const res = await fetch('/api/ai-chat/agent/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: card.proposal.tool, args: card.proposal.args }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Error ${res.status}`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'done' as const, resultMsg: data.message } : m)
        .concat({ id: uid(), role: 'assistant', content: `✓ ${data.message || 'Done.'}` }));
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'error' as const, resultMsg: e?.message || 'Failed.' } : m));
    }
  }, [messages]);

  // ── Multi-model roundtable ──────────────────────────────────────────────────
  const [groupRunning, setGroupRunning] = useState(false);
  const stopRef = useRef(false);

  const runRoundtable = useCallback(async (cfg: RoundtableConfig) => {
    const models = (cfg.models || []).filter(Boolean);
    const topic = (cfg.topic || '').trim();
    if (!topic || models.length < 1 || groupRunning) return;
    stopRef.current = false;
    setGroupRunning(true);
    setChatError(null);
    setMessages(prev => [...prev, { id: uid(), role: 'user', content: topic }]);

    const transcript: { speaker: string; content: string }[] = [];
    type Plan = { model: string; kind: string; side?: string; label: string; independent?: boolean };
    const plan: Plan[] = [];
    const rounds = Math.max(1, Math.min(cfg.rounds || 2, 4));

    if (cfg.mode === 'discuss') {
      for (let r = 0; r < rounds; r++) for (const m of models) plan.push({ model: m, kind: 'discuss', label: m });
      plan.push({ model: models[0], kind: 'summarize', label: `Summary · ${models[0]}` });
    } else if (cfg.mode === 'debate') {
      const [a, b, judge] = models;
      for (let r = 0; r < rounds; r++) {
        plan.push({ model: a, kind: 'debate', side: 'for', label: `${a} · for` });
        if (b) plan.push({ model: b, kind: 'debate', side: 'against', label: `${b} · against` });
      }
      if (judge) plan.push({ model: judge, kind: 'judge', label: `Judge · ${judge}` });
    } else {
      for (const m of models) plan.push({ model: m, kind: 'draft', label: m, independent: true });
      plan.push({ model: models[0], kind: 'aggregate', label: `Final · ${models[0]}` });
    }

    try {
      for (const p of plan) {
        if (stopRef.current) break;
        const res = await fetch('/api/ai-chat/roundtable', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: p.model, kind: p.kind, topic, side: p.side, participants: models, transcript: p.independent ? [] : transcript }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || `Error ${res.status}`);
        if (stopRef.current) break;
        transcript.push({ speaker: p.label, content: data.content });
        setMessages(prev => [...prev, { id: uid(), role: 'assistant', speaker: p.label, content: data.content }]);
      }
    } catch (e: any) {
      setChatError(e?.message || 'Roundtable failed.');
    } finally {
      setGroupRunning(false);
    }
  }, [groupRunning]);

  const stopRoundtable = useCallback(() => { stopRef.current = true; }, []);

  // ── Knowledge base + skills ─────────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    try { const r = await fetch('/api/ai-chat/rag'); const d = await r.json(); if (d.ok) setDocs(d.documents ?? []); } catch { /* ignore */ }
  }, []);
  const loadSkills = useCallback(async () => {
    try { const r = await fetch('/api/ai-chat/skills'); const d = await r.json(); if (d.ok) setSkills(d.skills ?? []); } catch { /* ignore */ }
  }, []);
  const addDoc = useCallback(async () => {
    const title = kbTitle.trim(); const text = kbText.trim();
    if (!title || !text || kbBusy) return;
    setKbBusy(true); setKbMsg(null);
    try {
      const r = await fetch('/api/ai-chat/rag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, text }) });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || `Error ${r.status}`);
      setKbTitle(''); setKbText(''); setKbMsg(`Added “${d.title}” (${d.chunks} chunks).`);
      loadDocs();
    } catch (e: any) { setKbMsg(e?.message || 'Failed to add.'); }
    finally { setKbBusy(false); }
  }, [kbTitle, kbText, kbBusy, loadDocs]);
  const delDoc = useCallback(async (id: string) => {
    try { await fetch(`/api/ai-chat/rag?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* ignore */ }
    setDocs(prev => prev.filter(d => d.id !== id));
  }, []);
  const runSkill = useCallback((prompt: string) => { runText(prompt); }, [runText]);

  // ── Sessions (persist=true only) ────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!persist) return;
    try { const r = await fetch('/api/ai-chat/sessions'); const d = await r.json(); if (d.ok) setSessions(d.sessions ?? []); } catch { /* ignore */ }
  }, [persist]);

  const newChat = useCallback(() => {
    setMessages([]); setSessionId(null); setChatError(null); setInput('');
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/ai-chat/sessions?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!r.ok || !d.ok) return;
      const s = d.session;
      setMessages(Array.isArray(s.messages) ? s.messages : []);
      setSessionId(s.id);
      if (s.model && models.includes(s.model)) setModelState(s.model);
      setAgent(!!s.agent);
      setChatError(null);
    } catch { /* ignore */ }
  }, [models]);

  const renameSession = useCallback(async (id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    try { await fetch('/api/ai-chat/sessions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title }) }); } catch { /* ignore */ }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (id === sessionId) newChat();
    try { await fetch(`/api/ai-chat/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* ignore */ }
  }, [sessionId, newChat]);

  // Auto-save the thread after each completed turn.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!persist || sending) return;
    const hasAssistant = messages.some(m => m.role !== 'user');
    if (messages.length === 0 || !hasAssistant) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await fetch('/api/ai-chat/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sessionId ?? undefined, model, agent, messages }),
        });
        const d = await r.json();
        if (d.ok && d.id) {
          if (!sessionId) setSessionId(d.id);
          setSessions(prev => {
            const now = new Date().toISOString();
            const others = prev.filter(s => s.id !== d.id);
            return [{ id: d.id, title: d.title, model, agent, updated_at: now }, ...others];
          });
        }
      } catch { /* ignore */ }
    }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [persist, sending, messages, sessionId, model, agent]);

  return {
    // models
    models, toolModels, agentEnabled, model, setModel, modelsLoading, modelsError, loadModels, ensureLoaded, modelSupportsTools,
    // agent
    agent, toggleAgent,
    // chat
    messages, setMessages, input, setInput, sending, chatError, runText, send, resolveProposal,
    // attachments (drag data from tables + uploaded files)
    pendingAttachments, addAttachment, removeAttachment, addRowsAttachment, attachFiles, attaching, attachNote, setAttachNote,
    // roundtable
    groupRunning, runRoundtable, stopRoundtable,
    // knowledge/skills
    docs, skills, kbTitle, setKbTitle, kbText, setKbText, kbBusy, kbMsg, loadDocs, loadSkills, addDoc, delDoc, runSkill,
    // sessions
    sessionId, sessions, loadSessions, newChat, loadSession, renameSession, deleteSession,
  };
}
