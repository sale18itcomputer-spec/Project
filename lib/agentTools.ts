/**
 * Agent tool registry.
 * ─────────────────────────────────────────────────────────────
 * READ tools run automatically inside the agent loop (safe — no mutation).
 * WRITE tools are never executed by the loop; the agent proposes them and the
 * staff must confirm, after which /api/ai-chat/agent/execute runs them with a
 * permission check. Write handlers mirror the proven MCP CRUD logic.
 *
 * Scope of writes (per product decision): CRM only — companies & contacts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PermissionAction } from '../types';
import { webSearch, webFetch } from './agentWeb';
import { rememberFact, listFacts, forgetFact, saveSkill, listSkills, getSkill } from './agentMemory';
import { ragSearch } from './agentRag';
import { listMcpToolsInfo, callMcpTool } from './agentMcp';

export interface ToolContext {
  supabase: SupabaseClient;
  /** UserID of the staff member driving the agent (for user-scoped memory/skills). */
  userId: string;
  /** Display name of the staff member (stamped on documents they create). */
  userName?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON-schema object for the tool parameters (Ollama/OpenAI function shape). */
  parameters: Record<string, any>;
  /**
   * read  — safe lookup, runs automatically in the loop.
   * auto  — benign user-scoped write (memory/skills), runs automatically.
   * write — business-data mutation; proposed and only run after staff confirm.
   */
  kind: 'read' | 'write' | 'auto';
  /** For write tools: which permission module + action gates execution. */
  module?: string;
  action?: PermissionAction;
  /** True for the MCP meta-tools (mcp_call) — gated by role, not a module. */
  mcp?: boolean;
  /** For generic meta-tools whose target module depends on args (e.g. entity). */
  resolvePermission?: (args: Record<string, any>) => { module: string; action: PermissionAction } | null;
  run: (args: Record<string, any>, ctx: ToolContext) => Promise<any>;
  /** One-line human summary of a proposed write, shown on the confirm card. */
  summarize?: (args: Record<string, any>) => string;
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim();

// ── READ TOOLS ────────────────────────────────────────────────────────────────

const readTools: AgentTool[] = [
  {
    name: 'search_companies',
    description: 'Search customer companies in the CRM by name (case-insensitive). Returns up to 10 matches.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Company name or part of it' } },
      required: ['query'],
    },
    run: async ({ query }, { supabase }) => {
      const { data, error } = await supabase
        .from('companies').select('*')
        .ilike('Company Name', `%${str(query)}%`).limit(10);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'search_contacts',
    description: 'Search contact people by name, optionally narrowed to a company. Returns up to 10 matches.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Contact name or part of it' },
        company: { type: 'string', description: 'Optional company name to narrow the search' },
      },
      required: ['query'],
    },
    run: async ({ query, company }, { supabase }) => {
      let q = supabase.from('contacts').select('*');
      if (str(company)) q = q.ilike('Company Name', `%${str(company)}%`);
      if (str(query)) q = q.ilike('Name', `%${str(query)}%`);
      const { data, error } = await q.limit(10);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'get_pricelist',
    description: 'Look up product prices. Filter by brand, model, or a keyword in model/description. Returns up to 15.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        model: { type: 'string' },
        keyword: { type: 'string', description: 'Search in Model and Description' },
      },
    },
    run: async ({ brand, model, keyword }, { supabase }) => {
      let q = supabase.from('pricelist').select('*');
      if (str(brand)) q = q.ilike('Brand', `%${str(brand)}%`);
      if (str(model)) q = q.ilike('Model', `%${str(model)}%`);
      if (str(keyword)) q = (q as any).or(`Model.ilike.%${str(keyword)}%,Description.ilike.%${str(keyword)}%`);
      const { data, error } = await q.limit(15);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'get_invoices',
    description: 'List invoices, optionally filtered by company and/or status. Returns up to 15, newest first.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        status: { type: 'string', description: 'e.g. Draft, Processing, Completed, Cancel' },
      },
    },
    run: async ({ company, status }, { supabase }) => {
      let q = supabase.from('invoices').select('*').order('Inv No', { ascending: false });
      if (str(company)) q = q.ilike('Company Name', `%${str(company)}%`);
      if (str(status)) q = q.eq('Status', str(status));
      const { data, error } = await q.limit(15);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'get_quotations',
    description: 'List quotations, optionally filtered by company and/or status. Returns up to 15, newest first.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        status: { type: 'string', description: 'e.g. Open, Close (Win)' },
      },
    },
    run: async ({ company, status }, { supabase }) => {
      let q = supabase.from('quotations').select('*').order('Quote No', { ascending: false });
      if (str(company)) q = q.ilike('Company Name', `%${str(company)}%`);
      if (str(status)) q = q.eq('Status', str(status));
      const { data, error } = await q.limit(15);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'get_sale_orders',
    description: 'List sale orders, optionally filtered by company and/or status. Returns up to 15, newest first.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        status: { type: 'string', description: 'Pending | Completed | Cancel' },
      },
    },
    run: async ({ company, status }, { supabase }) => {
      let q = supabase.from('sale_orders').select('*').order('SO No', { ascending: false });
      if (str(company)) q = q.ilike('Company Name', `%${str(company)}%`);
      if (str(status)) q = q.eq('Status', str(status));
      const { data, error } = await q.limit(15);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'get_inventory',
    description: 'Search stock inventory by brand or a keyword in code/model/description. Returns up to 15.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        brand: { type: 'string' },
        query: { type: 'string', description: 'Search in code, model_name, description' },
      },
    },
    run: async ({ brand, query }, { supabase }) => {
      let q = supabase.from('inventory').select('*').order('id', { ascending: false });
      if (str(brand)) q = q.ilike('brand', `%${str(brand)}%`);
      if (str(query)) q = (q as any).or(`code.ilike.%${str(query)}%,model_name.ilike.%${str(query)}%,description.ilike.%${str(query)}%`);
      const { data, error } = await q.limit(15);
      if (error) throw new Error(error.message);
      return data;
    },
  },
];

// ── WRITE TOOLS (CRM — confirm-gated) ──────────────────────────────────────────

const writeTools: AgentTool[] = [
  {
    name: 'create_company',
    description: 'Create a new customer company record. Use search_companies first to avoid duplicates.',
    kind: 'write',
    module: 'companies',
    action: 'create',
    parameters: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Company Name (required)' },
        data: {
          type: 'object',
          description: 'Optional extra fields, e.g. Industry, Address, Tel, Email, Website',
          additionalProperties: true,
        },
      },
      required: ['companyName'],
    },
    summarize: ({ companyName, data }) =>
      `Create company “${str(companyName)}”` + (data && Object.keys(data).length ? ` (+${Object.keys(data).length} fields)` : ''),
    run: async ({ companyName, data }, { supabase }) => {
      if (!str(companyName)) throw new Error('companyName is required');
      const payload = { 'Company Name': str(companyName), ...(data ?? {}) };
      const { data: row, error } = await supabase.from('companies').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'update_company',
    description: 'Update fields on an existing company, identified by its Company ID (get it from search_companies).',
    kind: 'write',
    module: 'companies',
    action: 'edit',
    parameters: {
      type: 'object',
      properties: {
        companyId: { type: 'string', description: 'Company ID (primary key)' },
        data: { type: 'object', description: 'Fields to change', additionalProperties: true },
      },
      required: ['companyId', 'data'],
    },
    summarize: ({ companyId, data }) =>
      `Update company ${str(companyId)}: ${Object.keys(data ?? {}).join(', ') || '(no fields)'}`,
    run: async ({ companyId, data }, { supabase }) => {
      if (!str(companyId)) throw new Error('companyId is required');
      if (!data || !Object.keys(data).length) throw new Error('data (fields to update) is required');
      const { data: row, error } = await supabase
        .from('companies').update(data).eq('Company ID', str(companyId)).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact person under a company. Use search_contacts/search_companies first.',
    kind: 'write',
    module: 'contacts',
    action: 'create',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Contact person name (required)' },
        companyName: { type: 'string', description: 'Company they belong to (required)' },
        data: {
          type: 'object',
          description: 'Optional extra fields, e.g. Position, "Tel (1)", Email',
          additionalProperties: true,
        },
      },
      required: ['name', 'companyName'],
    },
    summarize: ({ name, companyName }) => `Create contact “${str(name)}” at “${str(companyName)}”`,
    run: async ({ name, companyName, data }, { supabase }) => {
      if (!str(name)) throw new Error('name is required');
      if (!str(companyName)) throw new Error('companyName is required');
      const payload = { Name: str(name), 'Company Name': str(companyName), ...(data ?? {}) };
      const { data: row, error } = await supabase.from('contacts').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'update_contact',
    description: 'Update fields on an existing contact, identified by its Customer ID (from search_contacts).',
    kind: 'write',
    module: 'contacts',
    action: 'edit',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID (primary key)' },
        data: { type: 'object', description: 'Fields to change', additionalProperties: true },
      },
      required: ['customerId', 'data'],
    },
    summarize: ({ customerId, data }) =>
      `Update contact ${str(customerId)}: ${Object.keys(data ?? {}).join(', ') || '(no fields)'}`,
    run: async ({ customerId, data }, { supabase }) => {
      if (!str(customerId)) throw new Error('customerId is required');
      if (!data || !Object.keys(data).length) throw new Error('data (fields to update) is required');
      const { data: row, error } = await supabase
        .from('contacts').update(data).eq('Customer ID', str(customerId)).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'delete_company',
    description: 'Delete a company by Company ID (get it from search_companies). Permanent — related contacts/quotes are NOT auto-deleted.',
    kind: 'write', module: 'companies', action: 'delete',
    parameters: { type: 'object', properties: { companyId: { type: 'string', description: 'Company ID (primary key)' } }, required: ['companyId'] },
    summarize: ({ companyId }) => `Delete company ${str(companyId)} (permanent)`,
    run: async ({ companyId }, { supabase }) => {
      if (!str(companyId)) throw new Error('companyId is required');
      const { error } = await supabase.from('companies').delete().eq('Company ID', str(companyId));
      if (error) throw new Error(error.message);
      return { deleted: str(companyId) };
    },
  },
  {
    name: 'delete_contact',
    description: 'Delete a contact by Customer ID (from search_contacts). Permanent.',
    kind: 'write', module: 'contacts', action: 'delete',
    parameters: { type: 'object', properties: { customerId: { type: 'string', description: 'Customer ID (primary key)' } }, required: ['customerId'] },
    summarize: ({ customerId }) => `Delete contact ${str(customerId)} (permanent)`,
    run: async ({ customerId }, { supabase }) => {
      if (!str(customerId)) throw new Error('customerId is required');
      const { error } = await supabase.from('contacts').delete().eq('Customer ID', str(customerId));
      if (error) throw new Error(error.message);
      return { deleted: str(customerId) };
    },
  },
];

// ── WEB TOOLS (read) ───────────────────────────────────────────────────────────

const webToolDefs: AgentTool[] = [
  {
    name: 'web_search',
    description: 'Search the public web and return the top results (title + url). Use for company research, product specs, or current info not in our database.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number', description: 'max results (default 6)' } },
      required: ['query'],
    },
    run: async ({ query, limit }) => webSearch(str(query), Math.min(Number(limit) || 6, 10)),
  },
  {
    name: 'web_fetch',
    description: 'Fetch a web page by URL and return its readable text. Use after web_search to read a specific result.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
    run: async ({ url }) => webFetch(str(url)),
  },
];

// ── SALES DOCUMENTS — quotations + sale orders, full CRUD (write, confirm-gated) ──

interface DocItemInput { itemCode?: string; modelName?: string; description?: string; qty?: number | string; unitPrice?: number | string; }
const num = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };

/** Build ItemsJSON + totals (VAT 10% unless Non-VAT) the same way the app's own creators do. */
function buildDocItems(items: DocItemInput[], taxType?: string) {
  const list = Array.isArray(items) ? items : [];
  let subTotal = 0;
  const itemsJSON = list.map((it, idx) => {
    const up = num(it.unitPrice); const qty = num(it.qty) || 1; const amt = up * qty;
    subTotal += amt;
    return { id: `item-${idx}`, no: idx + 1, itemCode: str(it.itemCode), modelName: str(it.modelName),
      description: str(it.description), qty, unitPrice: up, amount: amt, commission: 0 };
  });
  const isVat = String(taxType ?? 'VAT').toUpperCase() !== 'NON-VAT';
  const vat = isVat ? subTotal * 0.1 : 0;
  return { itemsJSON, subTotal, vat, grand: subTotal + vat, isVat };
}

/** Next document number, e.g. Q-0000001 / SO-0000001, incremented from the current max. */
async function nextDocNo(supabase: SupabaseClient, table: string, col: string, prefix: string): Promise<string> {
  const { data } = await supabase.from(table).select(`"${col}"`).ilike(col, `${prefix}%`);
  let max = 0;
  for (const r of data ?? []) {
    const m = String((r as any)[col] ?? '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(7, '0')}`;
}

/** Copy a document (quotation/sale order) into a new one with a fresh number + date. */
async function duplicateDoc(
  supabase: SupabaseClient,
  cfg: { table: string; keyCol: string; prefix: string; status: string; dateCol?: string; srcKey: string; userName?: string; extra?: Record<string, any> },
) {
  const { data: src, error } = await supabase.from(cfg.table).select('*').eq(cfg.keyCol, cfg.srcKey).single();
  if (error || !src) throw new Error(`${cfg.srcKey} not found`);
  const newNo = await nextDocNo(supabase, cfg.table, cfg.keyCol, cfg.prefix);
  const copy: Record<string, any> = { ...src, ...(cfg.extra ?? {}) };
  delete copy.id; delete copy.created_at;
  copy[cfg.keyCol] = newNo;
  if (cfg.dateCol) copy[cfg.dateCol] = new Date().toISOString().slice(0, 10);
  copy['Status'] = cfg.status;
  copy['Created By'] = cfg.userName ?? src['Created By'] ?? 'AI Assistant';
  copy['Remark'] = `Duplicated from ${cfg.srcKey}`;
  copy['updated_at'] = new Date().toISOString();
  const { data: row, error: e2 } = await supabase.from(cfg.table).upsert(copy, { onConflict: cfg.keyCol }).select().single();
  if (e2) throw new Error(e2.message);
  return { new_no: newNo, source: cfg.srcKey, row };
}

const itemsSchema = {
  type: 'array',
  description: 'Line items: [{ itemCode, modelName, description, qty, unitPrice }]',
  items: {
    type: 'object',
    properties: {
      itemCode: { type: 'string' }, modelName: { type: 'string' }, description: { type: 'string' },
      qty: { type: 'number' }, unitPrice: { type: 'number' },
    },
  },
};

const documentTools: AgentTool[] = [
  {
    name: 'create_quotation',
    description: 'Draft a B2C quotation with line items. Auto-numbers (Q-XXXXXXX), computes VAT (10%) and grand total, stores items as ItemsJSON. Use get_pricelist to get real prices first.',
    kind: 'write', module: 'quotations', action: 'create',
    parameters: {
      type: 'object',
      properties: {
        companyName: { type: 'string', description: 'Customer company name (required)' },
        contactName: { type: 'string' },
        items: itemsSchema,
        taxType: { type: 'string', description: 'VAT (default) or Non-VAT' },
        currency: { type: 'string', description: 'USD (default) or KHR' },
        remark: { type: 'string' },
      },
      required: ['companyName', 'items'],
    },
    summarize: ({ companyName, items }) => `Create quotation for “${str(companyName)}” with ${Array.isArray(items) ? items.length : 0} item(s)`,
    run: async ({ companyName, contactName, items, taxType, currency, remark }, { supabase, userName }) => {
      if (!str(companyName)) throw new Error('companyName is required');
      if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item is required');
      const quoteNo = await nextDocNo(supabase, 'quotations', 'Quote No', 'Q-');
      const { itemsJSON, subTotal, vat, grand, isVat } = buildDocItems(items, taxType);
      const today = new Date().toISOString().slice(0, 10);
      const validity = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
      const { data: co } = await supabase.from('companies').select('*').ilike('Company Name', str(companyName)).limit(1);
      const company: any = co?.[0];
      const payload: Record<string, any> = {
        'Quote No': quoteNo, 'Quote Date': today, 'Validity Date': validity,
        'Company Name': company?.['Company Name'] ?? str(companyName),
        'Company Address': company?.['Address (English)'] ?? '',
        'Contact Name': str(contactName), 'Amount': String(grand), 'CM': '0', 'Status': 'Open',
        'Payment Term': company?.['Payment Term'] ?? '', 'Stock Status': 'Available',
        'Created By': userName ?? 'AI Assistant', 'Prepared By': userName ?? 'AI Assistant',
        'Currency': str(currency) || 'USD', 'Tax Type': isVat ? 'VAT' : 'Non-VAT',
        'Remark': str(remark) || 'Drafted by AI Assistant',
        'ItemsJSON': JSON.stringify(itemsJSON), updated_at: new Date().toISOString(),
      };
      const { data: row, error } = await supabase.from('quotations').upsert(payload, { onConflict: 'Quote No' }).select().single();
      if (error) throw new Error(error.message);
      return { quote_no: quoteNo, sub_total: subTotal, vat, grand_total: grand, items: itemsJSON.length, row };
    },
  },
  {
    name: 'update_quotation',
    description: 'Update a quotation by Quote No. Change header fields (Status e.g. "Close (Win)"/"Close (Lose)", Payment Term, Validity Date, Remark) and/or REPLACE its line items (recomputes VAT + total).',
    kind: 'write', module: 'quotations', action: 'edit',
    parameters: {
      type: 'object',
      properties: {
        quoteNo: { type: 'string' },
        data: { type: 'object', additionalProperties: true, description: 'Header fields to change, e.g. { "Status": "Close (Win)" }' },
        items: itemsSchema,
        taxType: { type: 'string' },
      },
      required: ['quoteNo'],
    },
    summarize: ({ quoteNo, data, items }) =>
      `Update quotation ${str(quoteNo)}` +
      (Array.isArray(items) && items.length ? ` — replace ${items.length} item(s)` : '') +
      (data && Object.keys(data).length ? ` — ${Object.keys(data).join(', ')}` : ''),
    run: async ({ quoteNo, data, items, taxType }, { supabase }) => {
      if (!str(quoteNo)) throw new Error('quoteNo is required');
      const payload: Record<string, any> = { ...(data ?? {}), updated_at: new Date().toISOString() };
      if (Array.isArray(items) && items.length) {
        const { itemsJSON, grand, isVat } = buildDocItems(items, taxType ?? (data?.['Tax Type']));
        payload['ItemsJSON'] = JSON.stringify(itemsJSON);
        payload['Amount'] = String(grand);
        payload['Tax Type'] = isVat ? 'VAT' : 'Non-VAT';
      }
      if (Object.keys(payload).length <= 1) throw new Error('Nothing to update — provide data fields or items');
      const { data: row, error } = await supabase.from('quotations').update(payload).eq('Quote No', str(quoteNo)).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'delete_quotation',
    description: 'Delete a quotation by Quote No. Refuses to delete won/lost/closed quotations unless force=true (protects finalized deals).',
    kind: 'write', module: 'quotations', action: 'delete',
    parameters: { type: 'object', properties: { quoteNo: { type: 'string' }, force: { type: 'boolean' } }, required: ['quoteNo'] },
    summarize: ({ quoteNo }) => `Delete quotation ${str(quoteNo)} (permanent)`,
    run: async ({ quoteNo, force }, { supabase }) => {
      if (!str(quoteNo)) throw new Error('quoteNo is required');
      if (!force) {
        const { data: q } = await supabase.from('quotations').select('Status').eq('Quote No', str(quoteNo)).single();
        if (/win|lost|close/i.test(String(q?.Status ?? ''))) throw new Error(`Refused: "${str(quoteNo)}" is finalized (${q?.Status}). Ask again with force to override.`);
      }
      const { error } = await supabase.from('quotations').delete().eq('Quote No', str(quoteNo));
      if (error) throw new Error(error.message);
      return { deleted: str(quoteNo) };
    },
  },
  {
    name: 'duplicate_quotation',
    description: 'Copy an existing quotation into a NEW Open quotation (new Q- number, today\'s date) with the same company, contact, items and terms. Use when staff say "duplicate/copy this quote".',
    kind: 'write', module: 'quotations', action: 'create',
    parameters: { type: 'object', properties: { quoteNo: { type: 'string', description: 'the quotation to copy' } }, required: ['quoteNo'] },
    summarize: ({ quoteNo }) => `Duplicate quotation ${str(quoteNo)} → new Open quote`,
    run: async ({ quoteNo }, { supabase, userName }) => {
      if (!str(quoteNo)) throw new Error('quoteNo is required');
      const validity = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
      const r = await duplicateDoc(supabase, {
        table: 'quotations', keyCol: 'Quote No', prefix: 'Q-', status: 'Open',
        dateCol: 'Quote Date', srcKey: str(quoteNo), userName, extra: { 'Validity Date': validity },
      });
      return { new_quote_no: r.new_no, source: r.source, row: r.row };
    },
  },
  {
    name: 'create_sale_order',
    description: 'Create a B2C sale order with line items. Auto-numbers (SO-XXXXXXX), computes VAT + total, stores items as ItemsJSON. Optionally link a source quotation via quoteNo.',
    kind: 'write', module: 'sale_orders', action: 'create',
    parameters: {
      type: 'object',
      properties: {
        companyName: { type: 'string' }, contactName: { type: 'string' }, quoteNo: { type: 'string', description: 'source quotation (optional)' },
        items: itemsSchema, taxType: { type: 'string' }, currency: { type: 'string' }, remark: { type: 'string' },
      },
      required: ['companyName', 'items'],
    },
    summarize: ({ companyName, items }) => `Create sale order for “${str(companyName)}” with ${Array.isArray(items) ? items.length : 0} item(s)`,
    run: async ({ companyName, contactName, quoteNo, items, taxType, currency, remark }, { supabase, userName }) => {
      if (!str(companyName)) throw new Error('companyName is required');
      if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item is required');
      const soNo = await nextDocNo(supabase, 'sale_orders', 'SO No', 'SO-');
      const { itemsJSON, subTotal, vat, grand, isVat } = buildDocItems(items, taxType);
      const { data: co } = await supabase.from('companies').select('*').ilike('Company Name', str(companyName)).limit(1);
      const company: any = co?.[0];
      const payload: Record<string, any> = {
        'SO No': soNo, 'SO Date': new Date().toISOString().slice(0, 10),
        'Company Name': company?.['Company Name'] ?? str(companyName),
        'Company Address': company?.['Address (English)'] ?? '',
        'Contact Name': str(contactName), 'Quote No': str(quoteNo), 'Amount': String(grand), 'Status': 'Pending',
        'Payment Term': company?.['Payment Term'] ?? '', 'Created By': userName ?? 'AI Assistant',
        'Currency': str(currency) || 'USD', 'Tax Type': isVat ? 'VAT' : 'Non-VAT',
        'Remark': str(remark) || 'Drafted by AI Assistant',
        'ItemsJSON': JSON.stringify(itemsJSON), updated_at: new Date().toISOString(),
      };
      const { data: row, error } = await supabase.from('sale_orders').upsert(payload, { onConflict: 'SO No' }).select().single();
      if (error) throw new Error(error.message);
      return { so_no: soNo, sub_total: subTotal, vat, grand_total: grand, items: itemsJSON.length, row };
    },
  },
  {
    name: 'update_sale_order',
    description: 'Update a sale order by SO No. Change header fields (Status: Pending/Completed/Cancel, Payment Term, Remark) and/or REPLACE line items (recomputes total).',
    kind: 'write', module: 'sale_orders', action: 'edit',
    parameters: {
      type: 'object',
      properties: { soNo: { type: 'string' }, data: { type: 'object', additionalProperties: true }, items: itemsSchema, taxType: { type: 'string' } },
      required: ['soNo'],
    },
    summarize: ({ soNo, data, items }) =>
      `Update sale order ${str(soNo)}` +
      (Array.isArray(items) && items.length ? ` — replace ${items.length} item(s)` : '') +
      (data && Object.keys(data).length ? ` — ${Object.keys(data).join(', ')}` : ''),
    run: async ({ soNo, data, items, taxType }, { supabase }) => {
      if (!str(soNo)) throw new Error('soNo is required');
      const payload: Record<string, any> = { ...(data ?? {}), updated_at: new Date().toISOString() };
      if (Array.isArray(items) && items.length) {
        const { itemsJSON, grand, isVat } = buildDocItems(items, taxType ?? (data?.['Tax Type']));
        payload['ItemsJSON'] = JSON.stringify(itemsJSON);
        payload['Amount'] = String(grand);
        payload['Tax Type'] = isVat ? 'VAT' : 'Non-VAT';
      }
      if (Object.keys(payload).length <= 1) throw new Error('Nothing to update — provide data fields or items');
      const { data: row, error } = await supabase.from('sale_orders').update(payload).eq('SO No', str(soNo)).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'delete_sale_order',
    description: 'Delete a sale order by SO No. Refuses to delete Completed orders unless force=true.',
    kind: 'write', module: 'sale_orders', action: 'delete',
    parameters: { type: 'object', properties: { soNo: { type: 'string' }, force: { type: 'boolean' } }, required: ['soNo'] },
    summarize: ({ soNo }) => `Delete sale order ${str(soNo)} (permanent)`,
    run: async ({ soNo, force }, { supabase }) => {
      if (!str(soNo)) throw new Error('soNo is required');
      if (!force) {
        const { data: so } = await supabase.from('sale_orders').select('Status').eq('SO No', str(soNo)).single();
        if (/complete/i.test(String(so?.Status ?? ''))) throw new Error(`Refused: "${str(soNo)}" is Completed. Ask again with force to override.`);
      }
      const { error } = await supabase.from('sale_orders').delete().eq('SO No', str(soNo));
      if (error) throw new Error(error.message);
      return { deleted: str(soNo) };
    },
  },
  {
    name: 'duplicate_sale_order',
    description: 'Copy an existing sale order into a NEW Pending sale order (new SO- number, today\'s date) with the same company, contact, items and terms.',
    kind: 'write', module: 'sale_orders', action: 'create',
    parameters: { type: 'object', properties: { soNo: { type: 'string', description: 'the sale order to copy' } }, required: ['soNo'] },
    summarize: ({ soNo }) => `Duplicate sale order ${str(soNo)} → new Pending order`,
    run: async ({ soNo }, { supabase, userName }) => {
      if (!str(soNo)) throw new Error('soNo is required');
      const r = await duplicateDoc(supabase, {
        table: 'sale_orders', keyCol: 'SO No', prefix: 'SO-', status: 'Pending',
        dateCol: 'SO Date', srcKey: str(soNo), userName,
      });
      return { new_so_no: r.new_no, source: r.source, row: r.row };
    },
  },
];

// ── MEMORY & SKILLS (auto — benign, user-scoped) ────────────────────────────────

const memoryTools: AgentTool[] = [
  {
    name: 'remember',
    description: 'Save a durable fact or preference about this user so you recall it in future chats (e.g. "prefers prices in KHR").',
    kind: 'auto',
    parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
    run: async ({ content }, { userId }) => rememberFact(userId, str(content)),
  },
  {
    name: 'list_memories',
    description: 'List what you currently remember about this user.',
    kind: 'auto',
    parameters: { type: 'object', properties: {} },
    run: async (_args, { userId }) => listFacts(userId),
  },
  {
    name: 'forget',
    description: 'Delete a remembered fact by id or by matching text.',
    kind: 'auto',
    parameters: { type: 'object', properties: { id: { type: 'string' }, contains: { type: 'string' } } },
    run: async ({ id, contains }, { userId }) => forgetFact(userId, { id: str(id) || undefined, contains: str(contains) || undefined }),
  },
  {
    name: 'save_skill',
    description: 'Save a reusable named prompt/instruction the user can re-run later.',
    kind: 'auto',
    parameters: { type: 'object', properties: { name: { type: 'string' }, prompt: { type: 'string' } }, required: ['name', 'prompt'] },
    run: async ({ name, prompt }, { userId }) => saveSkill(userId, str(name), str(prompt)),
  },
  {
    name: 'list_skills',
    description: 'List the saved skills (reusable prompts) for this user.',
    kind: 'auto',
    parameters: { type: 'object', properties: {} },
    run: async (_args, { userId }) => listSkills(userId),
  },
];

// ── KNOWLEDGE BASE (RAG — read) ─────────────────────────────────────────────────

const ragTools: AgentTool[] = [
  {
    name: 'rag_search',
    description: 'Search the uploaded company knowledge base (manuals, specs, policies, price sheets) and return the most relevant passages. Use for questions about internal documents.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        k: { type: 'number', description: 'how many passages (default 6)' },
      },
      required: ['query'],
    },
    run: async ({ query, k }) => ragSearch(str(query), Math.min(Number(k) || 6, 10)),
  },
];

// ── SKILLS (run — auto) ─────────────────────────────────────────────────────────

const skillRunTools: AgentTool[] = [
  {
    name: 'run_skill',
    description: 'Fetch a saved skill (reusable prompt) by name and follow its instructions.',
    kind: 'auto',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    run: async ({ name }, { userId }) => getSkill(userId, str(name)),
  },
];

// ── MCP meta-tools (bridge to the LPT MCP server's ~70 tools) ────────────────────
// mcp_list_tools is a safe read. mcp_call is special-cased by the agent route:
// it inspects the *target* tool name — read targets auto-run, write targets
// become a confirm card. See inferMcpKind in lib/agentMcp.

const mcpTools: AgentTool[] = [
  {
    name: 'mcp_list_tools',
    description: 'List tools available on the LPT MCP server (procurement, accounting, sheets, and more). Pass a keyword to filter. Use this to discover a tool, then call it with mcp_call.',
    kind: 'read',
    parameters: { type: 'object', properties: { filter: { type: 'string', description: 'keyword to filter tool names/descriptions' } } },
    run: async ({ filter }) => listMcpToolsInfo(str(filter) || undefined),
  },
  {
    name: 'mcp_call',
    description: 'Call a tool on the LPT MCP server. Provide the tool name (from mcp_list_tools) and its arguments as an object. Write actions (db_create/db_update/db_delete/…) require staff confirmation.',
    kind: 'write', // safe default; the route lets read targets auto-run
    mcp: true,
    parameters: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'MCP tool name, e.g. db_get_purchase_orders' },
        args: { type: 'object', description: 'arguments object for that tool', additionalProperties: true },
      },
      required: ['tool'],
    },
    summarize: ({ tool, args }) => `Run MCP tool ${str(tool)}(${Object.keys(args ?? {}).join(', ')})`,
    run: async ({ tool, args }) => callMcpTool(str(tool), (args ?? {}) as Record<string, any>),
  },
];

// ── GENERIC DATA CRUD (all remaining operations, via one small tool set) ─────────
// One registry → four tools, instead of ~40 hand-written ones. Each write is
// permission-gated by the entity's own module (resolvePermission) + confirm-gated.
// Numbered/financial docs (quotations, sale orders, invoices, receipts, delivery
// orders, journal entries) are deliberately NOT here — they go through dedicated
// tools / posting logic, so raw table writes can't bypass their integrity rules.

interface EntityDef {
  label: string; table: string; keyCol: string; module: string;
  searchCol?: string; orderCol?: string;
  /** Separate line-item table + its FK to this table's id (for duplicate). */
  itemTable?: string; itemFk?: string;
}
const ENTITIES: Record<string, EntityDef> = {
  contact_log:     { label: 'contact log', table: 'contact_logs', keyCol: 'Log ID', module: 'contact_logs', searchCol: 'Company Name', orderCol: 'Log ID' },
  pipeline:        { label: 'pipeline', table: 'pipelines', keyCol: 'Pipeline No', module: 'pipelines', searchCol: 'Company Name', orderCol: 'Pipeline No' },
  site_survey:     { label: 'site survey', table: 'site_survey_logs', keyCol: 'Site ID', module: 'site_surveys', searchCol: 'Location', orderCol: 'Site ID' },
  meeting:         { label: 'meeting', table: 'meeting_logs', keyCol: 'Meeting ID', module: 'meetings', searchCol: 'Company Name', orderCol: 'Meeting ID' },
  vendor:          { label: 'vendor', table: 'vendors', keyCol: 'id', module: 'vendors', searchCol: 'vendor_name', orderCol: 'vendor_name' },
  vendor_price:    { label: 'vendor pricelist item', table: 'vendor_pricelist', keyCol: 'id', module: 'vendor_pricelist', searchCol: 'model_name', orderCol: 'model_name' },
  price:           { label: 'pricelist item', table: 'pricelist', keyCol: 'Code', module: 'pricelist', searchCol: 'Model', orderCol: 'Model' },
  inventory:       { label: 'inventory item', table: 'inventory', keyCol: 'id', module: 'inventory', searchCol: 'model_name', orderCol: 'id' },
  product_inquiry: { label: 'product inquiry', table: 'product_inquiries', keyCol: 'inquiry_no', module: 'product_inquiries', searchCol: 'company_name', orderCol: 'inquiry_date', itemTable: 'inquiry_items', itemFk: 'inquiry_id' },
  service_ticket:  { label: 'service ticket', table: 'service_tickets', keyCol: 'ticket_no', module: 'service_tickets', searchCol: 'company_name', orderCol: 'ticket_date' },
  pdi_record:      { label: 'PDI record', table: 'pdi_records', keyCol: 'pdi_no', module: 'pdi_records', searchCol: 'company_name', orderCol: 'pdi_date', itemTable: 'pdi_items', itemFk: 'pdi_id' },
  serial_number:   { label: 'serial number', table: 'serial_numbers', keyCol: 'serial_number', module: 'serial_numbers', searchCol: 'model_name', orderCol: 'created_at' },
  spare_part:      { label: 'spare part', table: 'spare_parts', keyCol: 'part_no', module: 'spare_parts', searchCol: 'part_name', orderCol: 'part_name' },
  purchase_order:  { label: 'purchase order', table: 'purchase_orders', keyCol: 'po_number', module: 'purchase_orders', searchCol: 'vendor_name', orderCol: 'po_number', itemTable: 'purchase_order_items', itemFk: 'po_id' },
};
const ENTITY_NAMES = Object.keys(ENTITIES).join(', ');
const getEntity = (name: unknown): EntityDef => {
  const e = ENTITIES[str(name)];
  if (!e) throw new Error(`Unknown entity "${str(name)}". Valid: ${ENTITY_NAMES}`);
  return e;
};

/** Next key from a sample with a trailing number, e.g. PO-2026-014 → PO-2026-015. */
async function nextByPrefix(supabase: SupabaseClient, table: string, col: string, sample: string): Promise<string> {
  const m = String(sample).match(/^(.*?)(\d+)$/);
  if (!m) return `${sample}-copy`;
  const prefix = m[1], width = m[2].length;
  const { data } = await supabase.from(table).select(`"${col}"`).ilike(col, `${prefix}%`);
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$');
  let max = 0;
  for (const r of data ?? []) {
    const mm = String((r as any)[col] ?? '').match(re);
    if (mm) max = Math.max(max, parseInt(mm[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}

const dataTools: AgentTool[] = [
  {
    name: 'list_records',
    description: `List/search operational records. entity ∈ {${ENTITY_NAMES}}. Returns up to 15 rows with their keys + fields — use it to find the record's key before update_record/delete_record.`,
    kind: 'read',
    parameters: { type: 'object', properties: { entity: { type: 'string' }, search: { type: 'string', description: 'optional keyword' } }, required: ['entity'] },
    run: async ({ entity, search }, { supabase }) => {
      const e = getEntity(entity);
      let q = supabase.from(e.table).select('*');
      if (str(search) && e.searchCol) q = q.ilike(e.searchCol, `%${str(search)}%`);
      if (e.orderCol) q = q.order(e.orderCol, { ascending: false });
      const { data, error } = await q.limit(15);
      if (error) throw new Error(error.message);
      return data;
    },
  },
  {
    name: 'create_record',
    description: `Create an operational record. entity ∈ {${ENTITY_NAMES}}. Provide the full record as "data" (include the key field + relevant columns; use list_records to see the shape). Quotations/sale orders/invoices have their own tools — don't use this for those.`,
    kind: 'write',
    parameters: { type: 'object', properties: { entity: { type: 'string' }, data: { type: 'object', additionalProperties: true } }, required: ['entity', 'data'] },
    resolvePermission: (a) => { const e = ENTITIES[str(a.entity)]; return e ? { module: e.module, action: 'create' } : null; },
    summarize: ({ entity, data }) => { const e = ENTITIES[str(entity)]; return `Create ${e?.label ?? str(entity)}${e && data?.[e.keyCol] ? ` ${data[e.keyCol]}` : ''}`; },
    run: async ({ entity, data }, { supabase }) => {
      const e = getEntity(entity);
      if (!data || typeof data !== 'object') throw new Error('data (the record) is required');
      const { data: row, error } = await supabase.from(e.table).insert(data).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'update_record',
    description: `Update an operational record by its key. entity ∈ {${ENTITY_NAMES}}. Pass "key" (the ${'`keyCol`'} value from list_records) and "data" (changed fields only).`,
    kind: 'write',
    parameters: { type: 'object', properties: { entity: { type: 'string' }, key: { type: 'string' }, data: { type: 'object', additionalProperties: true } }, required: ['entity', 'key', 'data'] },
    resolvePermission: (a) => { const e = ENTITIES[str(a.entity)]; return e ? { module: e.module, action: 'edit' } : null; },
    summarize: ({ entity, key, data }) => { const e = ENTITIES[str(entity)]; return `Update ${e?.label ?? str(entity)} ${str(key)}: ${Object.keys(data ?? {}).join(', ') || '(no fields)'}`; },
    run: async ({ entity, key, data }, { supabase }) => {
      const e = getEntity(entity);
      if (!str(key)) throw new Error('key is required');
      if (!data || !Object.keys(data).length) throw new Error('data (fields to change) is required');
      const { data: row, error } = await supabase.from(e.table).update(data).eq(e.keyCol, str(key)).select().single();
      if (error) throw new Error(error.message);
      return row;
    },
  },
  {
    name: 'delete_record',
    description: `Delete an operational record by key. entity ∈ {${ENTITY_NAMES}}. Permanent.`,
    kind: 'write',
    parameters: { type: 'object', properties: { entity: { type: 'string' }, key: { type: 'string' } }, required: ['entity', 'key'] },
    resolvePermission: (a) => { const e = ENTITIES[str(a.entity)]; return e ? { module: e.module, action: 'delete' } : null; },
    summarize: ({ entity, key }) => { const e = ENTITIES[str(entity)]; return `Delete ${e?.label ?? str(entity)} ${str(key)} (permanent)`; },
    run: async ({ entity, key }, { supabase }) => {
      const e = getEntity(entity);
      if (!str(key)) throw new Error('key is required');
      const { error } = await supabase.from(e.table).delete().eq(e.keyCol, str(key));
      if (error) throw new Error(error.message);
      return { deleted: str(key) };
    },
  },
  {
    name: 'duplicate_record',
    description: `Duplicate an operational record into a new copy (fresh key/number; line items are copied too for purchase orders, inquiries, and PDI records). entity ∈ {${ENTITY_NAMES}}. Use for "duplicate/copy this PO/ticket/...".`,
    kind: 'write',
    parameters: { type: 'object', properties: { entity: { type: 'string' }, key: { type: 'string', description: 'the record to copy' } }, required: ['entity', 'key'] },
    resolvePermission: (a) => { const e = ENTITIES[str(a.entity)]; return e ? { module: e.module, action: 'create' } : null; },
    summarize: ({ entity, key }) => { const e = ENTITIES[str(entity)]; return `Duplicate ${e?.label ?? str(entity)} ${str(key)} → new copy`; },
    run: async ({ entity, key }, { supabase, userName }) => {
      const e = getEntity(entity);
      if (!str(key)) throw new Error('key is required');
      const { data: src, error } = await supabase.from(e.table).select('*').eq(e.keyCol, str(key)).single();
      if (error || !src) throw new Error(`${e.label} ${str(key)} not found`);

      const copy: Record<string, any> = { ...src };
      const oldId = (src as any).id;
      delete copy.id; delete copy.created_at;
      if ('updated_at' in src) copy.updated_at = new Date().toISOString();
      if (e.keyCol !== 'id') copy[e.keyCol] = await nextByPrefix(supabase, e.table, e.keyCol, str(key));
      if ('Created By' in src && userName) copy['Created By'] = userName;

      const { data: newRow, error: e2 } = await supabase.from(e.table).insert(copy).select().single();
      if (e2) throw new Error(e2.message);

      // Copy line items (separate table) onto the new parent id.
      let itemsCopied = 0;
      if (e.itemTable && e.itemFk && oldId && (newRow as any)?.id) {
        const { data: items } = await supabase.from(e.itemTable).select('*').eq(e.itemFk, oldId);
        if (items?.length) {
          const rows = items.map((it: any) => { const c = { ...it }; delete c.id; delete c.created_at; c[e.itemFk!] = (newRow as any).id; return c; });
          const { error: e3 } = await supabase.from(e.itemTable).insert(rows);
          if (!e3) itemsCopied = rows.length;
        }
      }
      return { new_key: e.keyCol === 'id' ? (newRow as any).id : copy[e.keyCol], source: str(key), items_copied: itemsCopied, row: newRow };
    },
  },
];

// ── Registry ────────────────────────────────────────────────────────────────

export const AGENT_TOOLS: Record<string, AgentTool> = Object.fromEntries(
  [...readTools, ...webToolDefs, ...ragTools, ...documentTools, ...memoryTools, ...skillRunTools, ...dataTools, ...mcpTools, ...writeTools]
    .map(t => [t.name, t]),
);

export function getTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS[name];
}

/** Ollama/OpenAI-shaped function schemas for the whole toolset. */
export const TOOL_SCHEMAS = Object.values(AGENT_TOOLS).map(t => ({
  type: 'function' as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));
