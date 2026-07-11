'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, Send, X, Loader2, Trash2, AlertCircle, RefreshCw,
  Sparkles, BookText, Zap, Maximize2, Paperclip,
} from 'lucide-react';
import { useAssistantChat } from '../../hooks/useAssistantChat';
import { ChatThread, EmptyHint, KnowledgePanel, SkillsPanel, AttachmentChips, DropOverlay } from '../assistant/ChatParts';

const ROWS_MIME = 'application/x-lpt-rows';
const WINDOW_KEY = 'lpt-ai-chat-window';
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

/**
 * Floating quick-access chat. Uses the shared useAssistantChat engine (no
 * persistence). The full-page /assistant (with saved history) is one click
 * away via the expand button.
 */
const AiChatWidget: React.FC = () => {
  const router = useRouter();
  const c = useAssistantChat({ persist: false });
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<'kb' | 'skills' | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dropHover, setDropHover] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  // ── Window (draggable + resizable) ──────────────────────────────────────────
  const [win, setWin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const moveRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Restore saved geometry (or default to bottom-right) the first time it opens.
  useEffect(() => {
    if (!open || win) return;
    let saved: any = null;
    try { saved = JSON.parse(localStorage.getItem(WINDOW_KEY) || 'null'); } catch { /* ignore */ }
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = clamp(saved?.w ?? 410, 300, vw - 16);
    const h = clamp(saved?.h ?? 620, 360, vh - 16);
    const x = clamp(saved?.x ?? vw - w - 20, 8, Math.max(8, vw - w - 8));
    const y = clamp(saved?.y ?? vh - h - 20, 8, Math.max(8, vh - h - 8));
    setWin({ x, y, w, h });
  }, [open, win]);

  // Keep the window on-screen when the viewport resizes.
  useEffect(() => {
    const onResize = () => setWin(prev => {
      if (!prev) return prev;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = clamp(prev.w, 300, vw - 16), h = clamp(prev.h, 360, vh - 16);
      return { w, h, x: clamp(prev.x, 8, Math.max(8, vw - w - 8)), y: clamp(prev.y, 8, Math.max(8, vh - h - 8)) };
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const persistWin = (g: { x: number; y: number; w: number; h: number }) => {
    try { localStorage.setItem(WINDOW_KEY, JSON.stringify(g)); } catch { /* ignore */ }
  };

  const startMove = (e: React.PointerEvent) => {
    if (!win || (e.target as HTMLElement).closest('button')) return;
    moveRef.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!win) return;
    if (moveRef.current) {
      const vw = window.innerWidth, vh = window.innerHeight;
      setWin({ ...win, x: clamp(e.clientX - moveRef.current.dx, 8, vw - win.w - 8), y: clamp(e.clientY - moveRef.current.dy, 8, vh - win.h - 8) });
    } else if (resizeRef.current) {
      const r = resizeRef.current, vw = window.innerWidth, vh = window.innerHeight;
      setWin({ ...win, w: clamp(r.w + (e.clientX - r.x), 300, vw - win.x - 8), h: clamp(r.h + (e.clientY - r.y), 360, vh - win.y - 8) });
    }
  };
  const endMove = (e: React.PointerEvent) => {
    if ((moveRef.current || resizeRef.current) && win) persistWin(win);
    moveRef.current = null; resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const startResize = (e: React.PointerEvent) => {
    if (!win) return;
    e.stopPropagation();
    resizeRef.current = { x: e.clientX, y: e.clientY, w: win.w, h: win.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (open) { c.ensureLoaded(); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [open, c.ensureLoaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [c.messages, c.sending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Highlight the drop target while a table row is being dragged anywhere.
  useEffect(() => {
    const onStart = (e: DragEvent) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes(ROWS_MIME)) setDragActive(true); };
    const onEnd = () => setDragActive(false);
    window.addEventListener('dragstart', onStart);
    window.addEventListener('dragend', onEnd);
    window.addEventListener('drop', onEnd);
    return () => { window.removeEventListener('dragstart', onStart); window.removeEventListener('dragend', onEnd); window.removeEventListener('drop', onEnd); };
  }, []);

  const canDrop = (e: React.DragEvent) => {
    const t = Array.from(e.dataTransfer.types);
    return t.includes(ROWS_MIME) || t.includes('Files');
  };
  const acceptDrag = (e: React.DragEvent) => { if (canDrop(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
  const onDragEnter = (e: React.DragEvent) => { if (canDrop(e)) { dragDepth.current++; setDropHover(true); } };
  const onDragLeave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDropHover(false); };
  const onDropData = (e: React.DragEvent, openAfter: boolean) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    dragDepth.current = 0; setDropHover(false); setDragActive(false);
    const raw = e.dataTransfer.getData(ROWS_MIME);
    if (raw) { try { c.addRowsAttachment(JSON.parse(raw)); } catch { /* ignore */ } }
    else if (e.dataTransfer.files?.length) { c.attachFiles(e.dataTransfer.files); }
    if (openAfter) setOpen(true);
  };

  const openPanel = (p: 'kb' | 'skills') => { setPanel(p); if (p === 'kb') c.loadDocs(); else c.loadSkills(); };
  const expand = () => { setOpen(false); router.push('/assistant'); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.send(); }
  };
  const agentOn = c.agent && c.agentEnabled;

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Open AI assistant"
          onDragOver={acceptDrag} onDrop={(e) => onDropData(e, true)}
          className={`fixed bottom-5 right-5 z-[85] h-14 w-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/30 flex items-center justify-center transition hover:scale-105 active:scale-95 ${dragActive ? 'ring-4 ring-brand-600/40 scale-110 animate-pulse' : ''}`}>
          <Bot size={26} />
        </button>
      )}

      {open && (
        <div onDragOver={acceptDrag} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={(e) => onDropData(e, false)}
          style={win ? { left: win.x, top: win.y, width: win.w, height: win.h } : { right: 20, bottom: 20, width: 410, height: 620 }}
          className={`fixed z-[85] flex flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden animate-slide-up ${dragActive ? 'border-brand-600 ring-2 ring-brand-600/30' : 'border-border'}`}>
          <DropOverlay show={dropHover} />
          {/* Header (drag handle) */}
          <div onPointerDown={startMove} onPointerMove={onMove} onPointerUp={endMove}
            className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40 cursor-move select-none touch-none">
            <div className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0"><Bot size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground leading-tight">AI Assistant</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{agentOn ? 'Agent · looks up data & drafts changes' : 'Self-hosted · private'}</p>
            </div>
            <button type="button" onClick={expand} title="Open full chat" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"><Maximize2 size={16} /></button>
            {c.messages.length > 0 && (
              <button type="button" onClick={() => c.setMessages([])} title="Clear conversation" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"><Trash2 size={16} /></button>
            )}
            <button type="button" onClick={() => setOpen(false)} title="Close" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"><X size={18} /></button>
          </div>

          {/* Model + agent toggle */}
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <label className="text-[11px] font-medium text-muted-foreground shrink-0">Model</label>
            {c.modelsLoading ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> loading…</span>
            ) : c.models.length > 0 ? (
              <select value={c.model} onChange={e => c.setModel(e.target.value)}
                className="flex-1 min-w-0 text-xs bg-input-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {c.models.map(m => <option key={m} value={m}>{m}{c.toolModels.includes(m) ? '  🛠' : ''}</option>)}
              </select>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <input value={c.model} onChange={e => c.setModel(e.target.value)} placeholder="type a model id"
                  className="flex-1 min-w-0 text-xs bg-input-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <button type="button" onClick={c.loadModels} title="Retry" className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition shrink-0"><RefreshCw size={14} /></button>
              </div>
            )}
            <button type="button" onClick={c.toggleAgent} disabled={!c.agentEnabled}
              title={!c.agentEnabled ? 'Agent not available' : c.agent ? 'Agent mode on' : 'Turn on Agent mode'}
              className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-md border transition disabled:opacity-40 disabled:cursor-not-allowed ${c.agent ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              <Sparkles size={13} /> Agent
            </button>
          </div>
          {agentOn && !c.modelSupportsTools && c.models.length > 0 && (
            <div className="px-4 py-1.5 text-[11px] text-muted-foreground bg-muted/40 border-b border-border">Tip: 🛠 models (e.g. qwen3) follow tool steps most reliably.</div>
          )}
          {agentOn && !panel && (
            <div className="px-4 py-1.5 border-b border-border flex items-center gap-2">
              <button type="button" onClick={() => openPanel('kb')} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition"><BookText size={12} /> Knowledge</button>
              <button type="button" onClick={() => openPanel('skills')} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted-foreground hover:bg-muted transition"><Zap size={12} /> Skills</button>
            </div>
          )}

          {panel === 'kb' ? (
            <KnowledgePanel docs={c.docs} titleVal={c.kbTitle} textVal={c.kbText} busy={c.kbBusy} msg={c.kbMsg}
              onTitle={c.setKbTitle} onText={c.setKbText} onAdd={c.addDoc} onDelete={c.delDoc} onBack={() => setPanel(null)} />
          ) : panel === 'skills' ? (
            <SkillsPanel skills={c.skills} onRun={p => { setPanel(null); c.runSkill(p); }} onBack={() => setPanel(null)} />
          ) : (
            <>
              {c.modelsError && (
                <div className="mx-4 mt-3 flex items-start gap-2 text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{c.modelsError} Type a model id above once the server is reachable, or press retry.</span>
                </div>
              )}
              <ChatThread messages={c.messages} sending={c.sending} chatError={c.chatError}
                emptyState={!c.modelsError ? <EmptyHint agent={agentOn} /> : null}
                onResolve={c.resolveProposal} scrollRef={scrollRef} />
              <div className="border-t border-border p-3">
                {c.attachNote && <p className="text-[11px] text-amber-600 mb-1.5 px-1">{c.attachNote}</p>}
                <AttachmentChips items={c.pendingAttachments} onRemove={c.removeAttachment} />
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" multiple hidden
                    accept=".pdf,.txt,.md,.csv,.json,.xlsx,.xls,.log,.xml,.html,image/*"
                    onChange={e => { if (e.target.files) c.attachFiles(e.target.files); e.target.value = ''; }} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={c.attaching} title="Attach a document or photo"
                    className="h-10 w-10 shrink-0 rounded-xl border border-border text-muted-foreground hover:bg-muted flex items-center justify-center transition disabled:opacity-40">
                    {c.attaching ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                  </button>
                  <textarea ref={inputRef} value={c.input} onChange={e => c.setInput(e.target.value)} onKeyDown={onKeyDown} rows={1}
                    placeholder={c.model ? (agentOn ? 'Ask, or request a change…' : 'Message…  (Enter to send)') : 'Select a model first'}
                    disabled={!c.model && c.models.length > 0}
                    className="flex-1 resize-none max-h-32 text-sm bg-input-background border border-border rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                  <button type="button" onClick={c.send} disabled={(!c.input.trim() && c.pendingAttachments.length === 0) || c.sending || !c.model} aria-label="Send"
                    className="h-10 w-10 shrink-0 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {c.sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}
          <div onPointerDown={startResize} onPointerMove={onMove} onPointerUp={endMove}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none z-[60]" aria-label="Resize window">
            <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-muted-foreground/50" />
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
