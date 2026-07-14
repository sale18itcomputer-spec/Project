'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Send, Loader2, RefreshCw, Sparkles, BookText, Zap, Plus,
  MessageSquare, Trash2, Pencil, Check, X, PanelLeft, Users, Paperclip,
} from 'lucide-react';
import { useAssistantChat, type SessionSummary } from '../../../hooks/useAssistantChat';
import { ChatThread, EmptyHint, KnowledgePanel, SkillsPanel, RoundtablePanel, AttachmentChips, DropOverlay } from '../../assistant/ChatParts';

const ROWS_MIME = 'application/x-lpt-rows';

const AssistantPage: React.FC = () => {
  const c = useAssistantChat({ persist: true });
  const [panel, setPanel] = useState<'kb' | 'skills' | 'roundtable' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [dropHover, setDropHover] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => { c.ensureLoaded(); c.loadSessions(); }, [c.ensureLoaded, c.loadSessions]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [c.messages, c.sending]);

  const openPanel = (p: 'kb' | 'skills') => { setPanel(p); if (p === 'kb') c.loadDocs(); else c.loadSkills(); };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.send(); }
  };
  const agentOn = c.agent && c.agentEnabled;

  const startRename = (s: SessionSummary) => { setEditingId(s.id); setEditTitle(s.title); };
  const commitRename = () => { if (editingId && editTitle.trim()) c.renameSession(editingId, editTitle.trim()); setEditingId(null); };

  const canDrop = (e: React.DragEvent) => {
    const t = Array.from(e.dataTransfer.types);
    return t.includes(ROWS_MIME) || t.includes('Files');
  };
  const acceptDrag = (e: React.DragEvent) => { if (canDrop(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
  const onDragEnter = (e: React.DragEvent) => { if (canDrop(e)) { dragDepth.current++; setDropHover(true); } };
  const onDragLeave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDropHover(false); };
  const onDropData = (e: React.DragEvent) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    dragDepth.current = 0; setDropHover(false);
    const raw = e.dataTransfer.getData(ROWS_MIME);
    if (raw) { try { c.addRowsAttachment(JSON.parse(raw)); } catch { /* ignore */ } }
    else if (e.dataTransfer.files?.length) { c.attachFiles(e.dataTransfer.files); }
    setPanel(null);
  };

  const pick = (id: string) => { c.loadSession(id); setSidebarOpen(false); setPanel(null); };
  const startNew = () => { c.newChat(); setSidebarOpen(false); setPanel(null); requestAnimationFrame(() => inputRef.current?.focus()); };

  return (
    <div className="h-full flex relative overflow-hidden">
      {/* Sessions sidebar */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-30 lg:hidden" />}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform absolute lg:static z-40 h-full w-72 shrink-0 border-r border-border bg-card flex flex-col`}>
        <div className="p-3 border-b border-border">
          <button type="button" onClick={startNew} className="w-full flex items-center justify-center gap-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 transition">
            <Plus size={16} /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {c.sessions.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No saved chats yet.</p>}
          {c.sessions.map(s => (
            <div key={s.id} className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition ${s.id === c.sessionId ? 'bg-muted' : 'hover:bg-muted/60'}`}>
              {editingId === s.id ? (
                <>
                  <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 min-w-0 text-xs bg-input-background border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                  <button type="button" onClick={commitRename} className="p-1 text-muted-foreground hover:text-foreground"><Check size={13} /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X size={13} /></button>
                </>
              ) : (
                <>
                  <MessageSquare size={14} className="text-muted-foreground shrink-0" />
                  <button type="button" onClick={() => pick(s.id)} className="flex-1 min-w-0 text-left text-xs text-foreground truncate">{s.title}</button>
                  <button type="button" onClick={() => startRename(s)} className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition"><Pencil size={12} /></button>
                  <button type="button" onClick={() => c.deleteSession(s.id)} className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"><Trash2 size={12} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat column */}
      <section className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <button type="button" onClick={() => setSidebarOpen(o => !o)} className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:bg-muted"><PanelLeft size={18} /></button>
          <div className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0"><Bot size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">AI Assistant</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{agentOn ? 'Agent · looks up data, drafts changes, searches your docs' : 'Self-hosted · private'}</p>
          </div>

          {c.modelsLoading ? (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> loading…</span>
          ) : c.models.length > 0 ? (
            <select value={c.model} onChange={e => c.setModel(e.target.value)}
              className="text-xs bg-input-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-[180px]">
              {c.models.map(m => <option key={m} value={m}>{m}{c.toolModels.includes(m) ? '  🛠' : ''}</option>)}
            </select>
          ) : (
            <button type="button" onClick={c.loadModels} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"><RefreshCw size={14} /></button>
          )}
          <button type="button" onClick={c.toggleAgent} disabled={!c.agentEnabled}
            title={!c.agentEnabled ? 'Agent not available' : c.agent ? 'Agent mode on' : 'Turn on Agent mode'}
            className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-md border transition disabled:opacity-40 ${c.agent ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            <Sparkles size={13} /> Agent
          </button>
          <button type="button" onClick={() => setPanel('roundtable')} title="Roundtable — models talk to each other"
            className={`shrink-0 p-1.5 rounded-md border transition ${c.groupRunning ? 'bg-brand-600 text-white border-brand-600' : 'border-border text-muted-foreground hover:bg-muted'}`}><Users size={15} /></button>
          {agentOn && (
            <>
              <button type="button" onClick={() => openPanel('kb')} title="Knowledge base" className="shrink-0 p-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"><BookText size={15} /></button>
              <button type="button" onClick={() => openPanel('skills')} title="Skills" className="shrink-0 p-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"><Zap size={15} /></button>
            </>
          )}
        </div>

        {panel === 'kb' ? (
          <KnowledgePanel docs={c.docs} titleVal={c.kbTitle} textVal={c.kbText} busy={c.kbBusy} msg={c.kbMsg}
            onTitle={c.setKbTitle} onText={c.setKbText} onAdd={c.addDoc} onDelete={c.delDoc} onBack={() => setPanel(null)} />
        ) : panel === 'skills' ? (
          <SkillsPanel skills={c.skills} onRun={p => { setPanel(null); c.runSkill(p); }} onBack={() => setPanel(null)} />
        ) : panel === 'roundtable' ? (
          <RoundtablePanel models={c.models} running={c.groupRunning} onStart={c.runRoundtable} onStop={c.stopRoundtable} onBack={() => setPanel(null)} />
        ) : (
          <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto flex flex-col relative"
            onDragOver={acceptDrag} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDrop={onDropData}>
            <DropOverlay show={dropHover} />
            {c.modelsError && (
              <div className="mx-4 mt-3 text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2">{c.modelsError}</div>
            )}
            <ChatThread messages={c.messages} sending={c.sending || c.groupRunning} chatError={c.chatError}
              emptyState={!c.modelsError ? <EmptyHint agent={agentOn} /> : null}
              onResolve={c.resolveProposal} scrollRef={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-6 space-y-4" />
            <div className="p-3 md:p-4">
              {c.attachNote && <p className="text-[11px] text-amber-600 mb-1.5 px-1">{c.attachNote}</p>}
              <AttachmentChips items={c.pendingAttachments} onRemove={c.removeAttachment} />
              <div className="flex items-end gap-2 border border-border rounded-2xl bg-input-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                <input ref={fileInputRef} type="file" multiple hidden
                  accept=".pdf,.txt,.md,.csv,.json,.xlsx,.xls,.log,.xml,.html,image/*"
                  onChange={e => { if (e.target.files) c.attachFiles(e.target.files); e.target.value = ''; }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={c.attaching} title="Attach a document or photo"
                  className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:bg-muted flex items-center justify-center transition disabled:opacity-40">
                  {c.attaching ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                </button>
                <textarea ref={inputRef} value={c.input} onChange={e => c.setInput(e.target.value)} onKeyDown={onKeyDown} rows={1}
                  placeholder={c.model ? (agentOn ? 'Ask, or request a change…  (Enter to send, Shift+Enter for newline)' : 'Message…  (Enter to send)') : 'Select a model first'}
                  className="flex-1 resize-none max-h-40 text-sm bg-transparent px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <button type="button" onClick={c.send} disabled={(!c.input.trim() && c.pendingAttachments.length === 0) || c.sending || !c.model} aria-label="Send"
                  className="h-9 w-9 shrink-0 rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center transition disabled:opacity-40">
                  {c.sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AssistantPage;
