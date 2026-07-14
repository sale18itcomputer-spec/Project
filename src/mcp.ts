import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';

// ── Constants ──────────────────────────────────────────────────────────────────

const SHEET_IDS = [
  '1_MC0BhvzSw5aUBCPg_E79leRNLtuYqXzAq9FqJcSao8',
  '1kChB8LQL1gSN4z0i7B3auFeDIPQjNIRg3sU9Qjrze9k',
  '1MzF6aF3AxM-1sVEGTeZbQ-gCOg0iILGNTDUSTTIn39s',
  '1D4l5BXB3ehUdX_obQ63-1D2h3LJFFJBoGHWeGe-1Cu0',
  '1DDdpK5ThssYe--r-3sWMgZHSzdiENuH6vF2UveVYTfY',
  '14rhFDASi0zy4lxt8WnWpfIInZBwbtYnJ-K69PbytIXM',
];

// ── Supabase client ────────────────────────────────────────────────────────────
// Defaults keep createClient() from throwing on startup when env vars aren't
// set yet (e.g. first Railway deploy before Variables are configured).
// Real requests will fail at query time with a clear network/auth error.

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://not-configured.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'not-configured';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Google Auth ────────────────────────────────────────────────────────────────

async function getGoogleAuth() {
  const oauthPath = path.join(__dirname, '..', 'google-oauth.json');
  const tokenPath = path.join(__dirname, '..', 'google-token.json');

  if (fs.existsSync(oauthPath) && fs.existsSync(tokenPath)) {
    const oauthCreds = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const { client_id, client_secret, redirect_uris } =
      oauthCreds.installed || oauthCreds.web;
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0],
    );
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  const keyFile =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    'C:\\Users\\tonns\\mcp-gsheets\\google-service-account.json';
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

// ── Sheets helpers ─────────────────────────────────────────────────────────────

async function getSheetsClient() {
  const auth = await getGoogleAuth();
  return google.sheets({ version: 'v4', auth: auth as any });
}

async function resolveSpreadsheetId(sheetParam: string): Promise<string | null> {
  if (SHEET_IDS.includes(sheetParam)) return sheetParam;
  const sheetsClient = await getSheetsClient();
  for (const id of SHEET_IDS) {
    try {
      const meta = await sheetsClient.spreadsheets.get({
        spreadsheetId: id,
        fields: 'properties.title',
      });
      const title = meta.data.properties?.title ?? '';
      if (title.toLowerCase().includes(sheetParam.toLowerCase())) return id;
    } catch {
      // continue
    }
  }
  return null;
}

async function resolveTabName(
  sheetsClient: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabParam: string,
): Promise<{ name: string; available: string[] } | null> {
  const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const available: string[] = (meta.data.sheets ?? []).map(
    (s: any) => s.properties?.title ?? '',
  );
  const exact = available.find(t => t.toLowerCase() === tabParam.toLowerCase());
  if (exact) return { name: exact, available };
  const partial = available.find(t =>
    t.toLowerCase().includes(tabParam.toLowerCase()),
  );
  if (partial) return { name: partial, available };
  return null;
}

function detectHeaderRow(rows: any[][]): { headerIndex: number; header: string[] } {
  const scanRows = rows.slice(0, 15);
  let bestIdx = 0;
  let bestCount = 0;
  for (let i = 0; i < scanRows.length; i++) {
    const count = (scanRows[i] ?? []).filter(
      (c: any) => c !== null && c !== undefined && String(c).trim() !== '',
    ).length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return {
    headerIndex: bestIdx,
    header: (rows[bestIdx] ?? []).map((c: any) => String(c ?? '')),
  };
}

// ── Response helpers ───────────────────────────────────────────────────────────

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const err = (msg: string) => ({
  content: [{ type: 'text' as const, text: `Error: ${msg}` }],
});

// ── Role-based access control ─────────────────────────────────────────────────

type Role = 'admin' | 'marketing';

const MARKETING_TOOLS = [
  // Pricelist (read + write)
  'db_get_pricelist',
  'db_upsert_pricelist',
  // Vendor pricelist (read)
  'db_get_vendor_pricelist',
  // CRM read-only
  'db_search_companies',
  'db_search_contacts',
  'db_get_quotations',
  'db_get_sale_orders',
  'db_get_pipelines',
  'db_get_contact_logs',
  'db_get_product_inquiries',
];

function resolveRole(authHeader: string): { role: Role; authorized: boolean } {
  const adminKey = process.env.MCP_API_KEY;
  const marketingKey = process.env.MCP_API_KEY_MARKETING;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (adminKey && token === adminKey) return { role: 'admin', authorized: true };
  if (marketingKey && token === marketingKey) return { role: 'marketing', authorized: true };
  // No keys configured → open access (dev mode)
  if (!adminKey && !marketingKey) return { role: 'admin', authorized: true };
  return { role: 'admin', authorized: false };
}

// ── Server factory ────────────────────────────────────────────────────────────
// Called once per stdio session, or once per HTTP request (stateless mode).

function createMcpServer(role: Role = 'admin') {
const server = new McpServer({ name: 'lpt-mcp', version: '1.0.0' });
const allowedTools: string[] | '*' = role === 'admin' ? '*' : MARKETING_TOOLS;
const reg = (name: string, ...args: any[]) => {
  if (allowedTools === '*' || allowedTools.includes(name))
    (server.tool as any)(name, ...args);
};

// ══════════════════════════════════════════════════════════════════════════════
// READ — Supabase
// ══════════════════════════════════════════════════════════════════════════════

reg(
  'db_search_companies',
  'Search companies by name (case-insensitive contains)',
  { query: z.string().describe('Company name to search') },
  async ({ query }) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .ilike('Company Name', `%${query}%`)
        .limit(50);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_search_contacts',
  'Search contacts by name or company name',
  {
    query: z.string().describe('Name or company keyword'),
    company: z.string().optional().describe('Narrow to specific company name'),
  },
  async ({ query, company }) => {
    try {
      let q = supabase.from('contacts').select('*');
      if (company) {
        q = q.ilike('Company Name', `%${company}%`);
        if (query) q = q.ilike('Name', `%${query}%`);
      } else {
        q = (q as any).or(`Name.ilike.%${query}%,"Company Name".ilike.%${query}%`);
      }
      const { data, error } = await q.limit(50);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_pricelist',
  'Get pricelist items. Filter by brand / model / keyword / status. Max 50 rows.',
  {
    brand: z.string().optional(),
    model: z.string().optional(),
    keyword: z.string().optional().describe('Search in Model + Description'),
    status: z.string().optional().describe('e.g. Available, Out of Stock'),
  },
  async ({ brand, model, keyword, status }) => {
    try {
      let q = supabase.from('pricelist').select('*');
      if (brand) q = q.ilike('Brand', `%${brand}%`);
      if (model) q = q.ilike('Model', `%${model}%`);
      if (keyword)
        q = (q as any).or(`Model.ilike.%${keyword}%,Description.ilike.%${keyword}%`);
      if (status) q = q.eq('Status', status);
      const { data, error } = await q.limit(50);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_quotations',
  'Get quotations. Filter by type (b2c/b2b), company, dateFrom/dateTo, status, or quote number keyword.',
  {
    type: z.enum(['b2c', 'b2b']).optional().describe('b2c (default) or b2b'),
    company: z.string().optional(),
    dateFrom: z.string().optional().describe('ISO date — Quote Date >='),
    dateTo: z.string().optional().describe('ISO date — Quote Date <='),
    status: z.string().optional().describe('e.g. Open, Close (Win)'),
    quote_no: z.string().optional().describe('Quote No contains'),
    limit: z.number().optional().describe('Max rows to return (default 200)'),
  },
  async ({ type, company, dateFrom, dateTo, status, quote_no, limit }) => {
    try {
      const table = type === 'b2b' ? 'b2b_quotations' : 'quotations';
      let q = supabase.from(table).select('*').order('Quote No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (dateFrom) q = q.gte('Quote Date', dateFrom);
      if (dateTo) q = q.lte('Quote Date', dateTo);
      if (status) q = q.eq('Status', status);
      if (quote_no) q = q.ilike('Quote No', `%${quote_no}%`);
      const { data, error } = await q.limit(limit ?? 200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_sale_orders',
  'Get sale orders. Filter by company, status, dateFrom/dateTo, SO number, or type (b2c/b2b).',
  {
    type: z.enum(['b2c', 'b2b']).optional(),
    company: z.string().optional(),
    status: z.string().optional().describe('Pending | Completed | Cancel'),
    dateFrom: z.string().optional().describe('ISO date — SO Date >='),
    dateTo: z.string().optional().describe('ISO date — SO Date <='),
    so_no: z.string().optional().describe('SO No contains'),
    limit: z.number().optional().describe('Max rows (default 200)'),
  },
  async ({ type, company, status, dateFrom, dateTo, so_no, limit }) => {
    try {
      const table = type === 'b2b' ? 'b2b_sale_orders' : 'sale_orders';
      let q = supabase.from(table).select('*').order('SO No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (status) q = q.eq('Status', status);
      if (dateFrom) q = q.gte('SO Date', dateFrom);
      if (dateTo) q = q.lte('SO Date', dateTo);
      if (so_no) q = q.ilike('SO No', `%${so_no}%`);
      const { data, error } = await q.limit(limit ?? 200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_invoices',
  'Get invoices. Filter by type (b2c/b2b/service), company, status, dateFrom/dateTo, or Inv No keyword. type=service returns SI-prefix service invoices only.',
  {
    type: z.enum(['b2c', 'b2b', 'service']).optional(),
    company: z.string().optional(),
    status: z.string().optional().describe('Draft | Processing | Completed | Cancel'),
    dateFrom: z.string().optional().describe('ISO date — Inv Date >='),
    dateTo: z.string().optional().describe('ISO date — Inv Date <='),
    inv_no: z.string().optional().describe('Inv No contains'),
    limit: z.number().optional().describe('Max rows (default 200)'),
  },
  async ({ type, company, status, dateFrom, dateTo, inv_no, limit }) => {
    try {
      const table = type === 'b2b' ? 'b2b_invoices' : 'invoices';
      let q = supabase.from(table).select('*').order('Inv No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (status) q = q.eq('Status', status);
      if (dateFrom) q = q.gte('Inv Date', dateFrom);
      if (dateTo) q = q.lte('Inv Date', dateTo);
      if (inv_no) q = q.ilike('Inv No', `%${inv_no}%`);
      if (type === 'service') q = q.ilike('Inv No', 'SI%');
      const { data, error } = await q.limit(limit ?? 200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_pipelines',
  'Get pipeline projects. status=open (default) excludes closed pipelines.',
  {
    type: z.enum(['b2c', 'b2b']).optional(),
    status: z.string().optional().describe('open (default) | closed | exact Status value'),
    company: z.string().optional(),
    responsible: z.string().optional().describe('Filter by responsible person name (contains)'),
    dateFrom: z.string().optional().describe('ISO date — Pipeline Date >='),
    limit: z.number().optional().describe('Max rows (default 200)'),
  },
  async ({ type, status, company, responsible, dateFrom, limit }) => {
    try {
      const table = type === 'b2b' ? 'b2b_pipelines' : 'pipelines';
      let q = supabase.from(table).select('*').order('Pipeline No', { ascending: false });
      const s = status ?? 'open';
      if (s === 'open') {
        q = (q as any).not('Status', 'ilike', '%close%');
      } else if (s === 'closed') {
        q = q.ilike('Status', '%close%');
      } else {
        q = q.eq('Status', s);
      }
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (responsible) q = q.ilike('Responsible', `%${responsible}%`);
      if (dateFrom) q = q.gte('Pipeline Date', dateFrom);
      const { data, error } = await q.limit(limit ?? 200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_purchase_orders',
  'Get purchase orders. Filter by status, dateFrom.',
  {
    status: z.string().optional().describe('Draft | Approved | Sent | Completed | Cancelled'),
    dateFrom: z.string().optional().describe('ISO date — order_date >='),
  },
  async ({ status, dateFrom }) => {
    try {
      let q = supabase
        .from('purchase_orders')
        .select('*')
        .order('po_number', { ascending: false });
      if (status) q = q.eq('status', status);
      if (dateFrom) q = q.gte('order_date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_inventory',
  'Get inventory items. Filter by brand, keyword (code/model/description), or low_stock.',
  {
    brand: z.string().optional(),
    query: z.string().optional().describe('Search in code, model_name, description'),
    low_stock: z.boolean().optional().describe('If true, return items with qty <= 0'),
  },
  async ({ brand, query, low_stock }) => {
    try {
      let q = supabase.from('inventory').select('*').order('id', { ascending: false });
      if (brand) q = q.ilike('brand', `%${brand}%`);
      if (query)
        q = (q as any).or(
          `code.ilike.%${query}%,model_name.ilike.%${query}%,description.ilike.%${query}%`,
        );
      if (low_stock) q = q.lte('qty', 0);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_contact_logs',
  'Get contact logs. Filter by contact name, company, dateFrom.',
  {
    contact: z.string().optional().describe('Contact Name contains'),
    company: z.string().optional().describe('Company Name contains'),
    dateFrom: z.string().optional().describe('ISO date — Contact Date >='),
  },
  async ({ contact, company, dateFrom }) => {
    try {
      let q = supabase
        .from('contact_logs')
        .select('*')
        .order('Log ID', { ascending: false });
      if (contact) q = q.ilike('Contact Name', `%${contact}%`);
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (dateFrom) q = q.gte('Contact Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_vendor_pricelist',
  'Get vendor pricelist items. Filter by brand or keyword.',
  {
    brand: z.string().optional(),
    query: z.string().optional().describe('Search in model_name, specification'),
  },
  async ({ brand, query }) => {
    try {
      let q = supabase.from('vendor_pricelist').select('*');
      if (brand) q = q.ilike('brand', `%${brand}%`);
      if (query)
        q = (q as any).or(
          `model_name.ilike.%${query}%,specification.ilike.%${query}%`,
        );
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_categories',
  'Get all category labels from the category_labels table',
  {},
  async () => {
    try {
      const { data, error } = await supabase
        .from('category_labels')
        .select('*')
        .order('id');
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_meeting_logs',
  'Get meeting logs. Filter by company, dateFrom.',
  {
    company: z.string().optional(),
    dateFrom: z.string().optional().describe('ISO date — Meeting Date >='),
  },
  async ({ company, dateFrom }) => {
    try {
      let q = supabase
        .from('meeting_logs')
        .select('*')
        .order('Meeting ID', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (dateFrom) q = q.gte('Meeting Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_site_surveys',
  'Get site survey logs. Filter by company, dateFrom.',
  {
    company: z.string().optional(),
    dateFrom: z.string().optional().describe('ISO date — Date >='),
  },
  async ({ company, dateFrom }) => {
    try {
      let q = supabase
        .from('site_survey_logs')
        .select('*')
        .order('Site ID', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (dateFrom) q = q.gte('Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_consignments',
  'Get consignments with their items joined by consignment_id.',
  {
    status: z.string().optional().describe('Filter by consignment status'),
    company: z.string().optional().describe('Filter by to_location (company name)'),
  },
  async ({ status, company }) => {
    try {
      let q = supabase
        .from('consignments')
        .select('*, consignment_items(*)')
        .order('transfer_date', { ascending: false });
      if (status) q = q.eq('status', status);
      if (company) q = q.ilike('to_location', `%${company}%`);
      const { data, error } = await q.limit(100);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_accounting',
  'Get journal entries with their lines. Filter by dateFrom, dateTo, posted status, or search query.',
  {
    dateFrom: z.string().optional().describe('ISO date — entry_date >='),
    dateTo: z.string().optional().describe('ISO date — entry_date <='),
    posted: z.boolean().optional().describe('Filter by is_posted'),
    query: z.string().optional().describe('Search in description or reference'),
  },
  async ({ dateFrom, dateTo, posted, query }) => {
    try {
      let q = supabase
        .from('journal_entries')
        .select('*, journal_entry_lines(*)')
        .order('entry_date', { ascending: false });
      if (dateFrom) q = q.gte('entry_date', dateFrom);
      if (dateTo) q = q.lte('entry_date', dateTo);
      if (posted !== undefined) q = q.eq('is_posted', posted);
      if (query)
        q = (q as any).or(
          `description.ilike.%${query}%,reference.ilike.%${query}%`,
        );
      const { data, error } = await q.limit(100);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_chart_of_accounts',
  'Get chart of accounts (hidden accounts excluded). Filter by account_type or keyword.',
  {
    type: z.string().optional().describe('account_type filter'),
    query: z.string().optional().describe('Search in account_number or account_name'),
  },
  async ({ type, query }) => {
    try {
      let q = supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_hidden', false)
        .order('sort_order');
      if (type) q = q.eq('account_type', type);
      if (query)
        q = (q as any).or(
          `account_number.ilike.%${query}%,account_name.ilike.%${query}%`,
        );
      const { data, error } = await q;
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_delivery_orders',
  'Get delivery orders. Filter by company, status, SO number, or dateFrom.',
  {
    company: z.string().optional().describe('Company Name contains'),
    status: z.string().optional().describe('e.g. Draft, Delivered, Cancelled'),
    so_no: z.string().optional().describe('SO No contains'),
    dateFrom: z.string().optional().describe('ISO date — DO Date >='),
  },
  async ({ company, status, so_no, dateFrom }) => {
    try {
      let q = supabase
        .from('delivery_orders')
        .select('*')
        .order('DO No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (status) q = q.eq('Status', status);
      if (so_no) q = q.ilike('SO No', `%${so_no}%`);
      if (dateFrom) q = q.gte('DO Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_receipts',
  'Get receipts (payment vouchers). Filter by company, status, payment method, or dateFrom.',
  {
    company: z.string().optional().describe('Company Name contains'),
    status: z.string().optional().describe('e.g. Draft, Confirmed, Cancelled'),
    payment_method: z.string().optional().describe('e.g. Cash, Bank Transfer, Cheque'),
    so_no: z.string().optional().describe('SO No contains'),
    inv_no: z.string().optional().describe('Inv No contains'),
    dateFrom: z.string().optional().describe('ISO date — RV Date >='),
  },
  async ({ company, status, payment_method, so_no, inv_no, dateFrom }) => {
    try {
      let q = supabase
        .from('receipts')
        .select('*')
        .order('RV No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (status) q = q.eq('Status', status);
      if (payment_method) q = q.eq('Payment Method', payment_method);
      if (so_no) q = q.ilike('SO No', `%${so_no}%`);
      if (inv_no) q = q.ilike('Inv No', `%${inv_no}%`);
      if (dateFrom) q = q.gte('RV Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_vendors',
  'Get vendors (Vendor Master). Filter by name, category, or status.',
  {
    query: z.string().optional().describe('Search in vendor_name or contact_person'),
    category: z.string().optional(),
    status: z.string().optional().describe('e.g. Active, Inactive'),
  },
  async ({ query, category, status }) => {
    try {
      let q = supabase.from('vendors').select('*').order('vendor_name');
      if (query)
        q = (q as any).or(
          `vendor_name.ilike.%${query}%,contact_person.ilike.%${query}%`,
        );
      if (category) q = q.eq('category', category);
      if (status) q = q.eq('status', status);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_product_inquiries',
  'Get product inquiries with their line items. Filter by company, status, priority, or dateFrom.',
  {
    company: z.string().optional().describe('Company name contains'),
    status: z.string().optional().describe('e.g. Open, In Progress, Fulfilled, Cancelled'),
    priority: z.string().optional().describe('e.g. Low, Normal, High, Urgent'),
    responsible_by: z.string().optional().describe('Responsible person name contains'),
    dateFrom: z.string().optional().describe('ISO date — inquiry_date >='),
  },
  async ({ company, status, priority, responsible_by, dateFrom }) => {
    try {
      let q = supabase
        .from('product_inquiries')
        .select('*, inquiry_items(*)')
        .order('inquiry_date', { ascending: false });
      if (company) q = q.ilike('company_name', `%${company}%`);
      if (status) q = q.eq('status', status);
      if (priority) q = q.eq('priority', priority);
      if (responsible_by) q = q.ilike('responsible_by', `%${responsible_by}%`);
      if (dateFrom) q = q.gte('inquiry_date', dateFrom);
      const { data, error } = await q.limit(100);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_serial_numbers',
  'Get serial numbers. Filter by brand, model, company, SO number, or status.',
  {
    brand: z.string().optional(),
    model: z.string().optional().describe('Model name contains'),
    company: z.string().optional().describe('Company name contains'),
    so_no: z.string().optional().describe('Sale order number contains'),
    status: z.string().optional().describe('e.g. Active, Warranty Expired, In Service'),
    query: z.string().optional().describe('Search in serial_number, model_name, description'),
  },
  async ({ brand, model, company, so_no, status, query }) => {
    try {
      let q = supabase.from('serial_numbers').select('*').order('created_at', { ascending: false });
      if (brand) q = q.ilike('brand', `%${brand}%`);
      if (model) q = q.ilike('model_name', `%${model}%`);
      if (company) q = q.ilike('company_name', `%${company}%`);
      if (so_no) q = q.ilike('so_no', `%${so_no}%`);
      if (status) q = q.eq('status', status);
      if (query)
        q = (q as any).or(
          `serial_number.ilike.%${query}%,model_name.ilike.%${query}%,description.ilike.%${query}%`,
        );
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_service_tickets',
  'Get service tickets. Filter by status, company, serial number, engineer, or dateFrom.',
  {
    status: z.string().optional().describe('e.g. Open, In Progress, Resolved, Closed'),
    company: z.string().optional().describe('Company name contains'),
    serial_number: z.string().optional().describe('Serial number contains'),
    engineer: z.string().optional().describe('Assigned engineer name contains'),
    ticket_type: z.string().optional().describe('e.g. Repair, Warranty, Maintenance'),
    dateFrom: z.string().optional().describe('ISO date — ticket_date >='),
  },
  async ({ status, company, serial_number, engineer, ticket_type, dateFrom }) => {
    try {
      let q = supabase.from('service_tickets').select('*').order('ticket_date', { ascending: false });
      if (status) q = q.eq('status', status);
      if (company) q = q.ilike('company_name', `%${company}%`);
      if (serial_number) q = q.ilike('serial_number', `%${serial_number}%`);
      if (engineer) q = q.ilike('assigned_engineer', `%${engineer}%`);
      if (ticket_type) q = q.eq('ticket_type', ticket_type);
      if (dateFrom) q = q.gte('ticket_date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_pdi_records',
  'Get PDI records with their line items. Filter by status, SO number, company, or engineer.',
  {
    status: z.string().optional().describe('e.g. Pending, In Progress, Completed'),
    so_no: z.string().optional().describe('Sale order number contains'),
    company: z.string().optional().describe('Company name contains'),
    engineer: z.string().optional().describe('Assigned engineer name contains'),
    dateFrom: z.string().optional().describe('ISO date — pdi_date >='),
  },
  async ({ status, so_no, company, engineer, dateFrom }) => {
    try {
      let q = supabase
        .from('pdi_records')
        .select('*, pdi_items(*)')
        .order('pdi_date', { ascending: false });
      if (status) q = q.eq('status', status);
      if (so_no) q = q.ilike('so_no', `%${so_no}%`);
      if (company) q = q.ilike('company_name', `%${company}%`);
      if (engineer) q = q.ilike('assigned_engineer', `%${engineer}%`);
      if (dateFrom) q = q.gte('pdi_date', dateFrom);
      const { data, error } = await q.limit(100);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_spare_parts',
  'Get spare parts inventory. Filter by brand, category, status, or low stock.',
  {
    brand: z.string().optional(),
    category: z.string().optional().describe('e.g. Spare Part, Accessory, Consumable'),
    status: z.string().optional().describe('e.g. In Stock, Out of Stock, Discontinued'),
    query: z.string().optional().describe('Search in part_no, part_name, model_name'),
    low_stock: z.boolean().optional().describe('If true, return items where qty <= min_qty'),
  },
  async ({ brand, category, status, query, low_stock }) => {
    try {
      let q = supabase.from('spare_parts').select('*').order('part_name');
      if (brand) q = q.ilike('brand', `%${brand}%`);
      if (category) q = q.eq('category', category);
      if (status) q = q.eq('status', status);
      if (query)
        q = (q as any).or(
          `part_no.ilike.%${query}%,part_name.ilike.%${query}%,model_name.ilike.%${query}%`,
        );
      if (low_stock) q = q.lte('qty', 0);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// WRITE — Supabase
// ══════════════════════════════════════════════════════════════════════════════

reg(
  'db_create_contact',
  'Create a new contact record',
  {
    name: z.string().describe('Contact name'),
    companyName: z.string().describe('Company Name'),
    data: z.record(z.string(), z.any()).optional().describe('Extra fields as key/value'),
  },
  async ({ name, companyName, data: extra }) => {
    try {
      const payload = { Name: name, 'Company Name': companyName, ...(extra ?? {}) };
      const { data, error } = await supabase
        .from('contacts')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_company',
  'Create a new company record',
  {
    companyName: z.string().describe('Company Name'),
    data: z.record(z.string(), z.any()).optional().describe('Extra fields as key/value'),
  },
  async ({ companyName, data: extra }) => {
    try {
      const payload = { 'Company Name': companyName, ...(extra ?? {}) };
      const { data, error } = await supabase
        .from('companies')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_pipeline',
  'Create a new pipeline project',
  {
    companyName: z.string().describe('Company Name'),
    data: z.record(z.string(), z.any()).optional().describe('Additional pipeline fields'),
    type: z.enum(['b2c', 'b2b']).optional(),
  },
  async ({ companyName, data: extra, type }) => {
    try {
      const table = type === 'b2b' ? 'b2b_pipelines' : 'pipelines';
      const payload = { 'Company Name': companyName, ...(extra ?? {}) };
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_pipeline',
  'Update a pipeline project by Pipeline No',
  {
    pipelineNo: z.string().describe('Pipeline No (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
    type: z.enum(['b2c', 'b2b']).optional(),
  },
  async ({ pipelineNo, data: updates, type }) => {
    try {
      const table = type === 'b2b' ? 'b2b_pipelines' : 'pipelines';
      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('Pipeline No', pipelineNo)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_sale_order',
  'Create a new sale order',
  {
    companyName: z.string().describe('Company Name'),
    data: z.record(z.string(), z.any()).optional().describe('Additional SO fields'),
    type: z.enum(['b2c', 'b2b']).optional(),
  },
  async ({ companyName, data: extra, type }) => {
    try {
      const table = type === 'b2b' ? 'b2b_sale_orders' : 'sale_orders';
      const payload = {
        'Company Name': companyName,
        updated_at: new Date().toISOString(),
        ...(extra ?? {}),
      };
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_inventory',
  'Update an inventory item. Identify by id (UUID, preferred) or code.',
  {
    id: z.string().optional().describe('Inventory item UUID (preferred — from db_get_inventory)'),
    code: z.string().optional().describe('Inventory item code (used if id not given)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (qty, unit_price, status, serial_number, description, etc.)'),
  },
  async ({ id, code, data: updates }) => {
    try {
      if (!id && !code) return err('Provide id or code');
      const payload = { ...updates, updated_at: new Date().toISOString() };
      let q = supabase.from('inventory').update(payload);
      q = id ? q.eq('id', id) : q.eq('code', code!);
      const { data, error } = await q.select().single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_quotation',
  'Update a quotation by Quote No',
  {
    quoteNo: z.string().describe('Quote No (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
    type: z.enum(['b2c', 'b2b']).optional(),
  },
  async ({ quoteNo, data: updates, type }) => {
    try {
      const table = type === 'b2b' ? 'b2b_quotations' : 'quotations';
      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('Quote No', quoteNo)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_quotation',
  'Create a new quotation',
  {
    companyName: z.string().describe('Company Name'),
    type: z.enum(['b2c', 'b2b']).optional(),
    data: z.record(z.string(), z.any()).optional().describe('Additional quotation fields'),
  },
  async ({ companyName, type, data: extra }) => {
    try {
      const table = type === 'b2b' ? 'b2b_quotations' : 'quotations';
      const payload = { 'Company Name': companyName, ...(extra ?? {}) };
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_sale_order',
  'Update a sale order by SO No',
  {
    soNo: z.string().describe('SO No (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
    type: z.enum(['b2c', 'b2b']).optional(),
  },
  async ({ soNo, data: updates, type }) => {
    try {
      const table = type === 'b2b' ? 'b2b_sale_orders' : 'sale_orders';
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('SO No', soNo)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_contact',
  'Update a contact by Customer ID',
  {
    customerId: z.string().describe('Customer ID (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
  },
  async ({ customerId, data: updates }) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('Customer ID', customerId)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_company',
  'Update a company by Company ID',
  {
    companyId: z.string().describe('Company ID (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
  },
  async ({ companyId, data: updates }) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('Company ID', companyId)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_upsert_pricelist',
  'Upsert a pricelist item by Code (insert or update)',
  {
    code: z.string().describe('Product Code (upsert key)'),
    data: z.record(z.string(), z.any()).describe('Pricelist fields to set'),
  },
  async ({ code, data: fields }) => {
    try {
      const payload = {
        Code: code,
        ...fields,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('pricelist')
        .upsert(payload, { onConflict: 'Code' })
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_journal_entry',
  'Create a balanced journal entry. Validates debit total == credit total before inserting.',
  {
    entry_date: z.string().describe('Entry date (YYYY-MM-DD)'),
    description: z.string(),
    reference: z.string().optional(),
    created_by: z.string().optional(),
    lines: z
      .array(
        z.object({
          account_number: z.string(),
          account_name: z.string().optional(),
          description: z.string().optional(),
          debit: z.number(),
          credit: z.number(),
        }),
      )
      .describe('Journal lines — debits must equal credits'),
  },
  async ({ entry_date, description, reference, created_by, lines }) => {
    try {
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        return err(
          `Not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`,
        );
      }

      const { data: entry, error: entryErr } = await supabase
        .from('journal_entries')
        .insert({
          entry_date,
          description,
          reference: reference ?? '',
          created_by: created_by ?? 'MCP',
          is_posted: false,
        })
        .select()
        .single();
      if (entryErr) return err(entryErr.message);

      const lineRows = lines.map(l => ({
        account_number: l.account_number,
        account_name: l.account_name ?? '',
        description: l.description ?? '',
        debit: l.debit,
        credit: l.credit,
        journal_entry_id: entry.id,
      }));
      const { data: createdLines, error: linesErr } = await supabase
        .from('journal_entry_lines')
        .insert(lineRows)
        .select();
      if (linesErr) return err(linesErr.message);

      return ok({
        ...entry,
        lines: createdLines,
        total_debit: totalDebit,
        total_credit: totalCredit,
      });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_service_ticket',
  'Create a new service ticket',
  {
    ticket_no: z.string().describe('Unique ticket number (e.g. ST-2026-001)'),
    ticket_type: z.string().optional().describe('Repair | Warranty | Maintenance | Other'),
    priority: z.string().optional().describe('Low | Normal | High | Critical'),
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
    serial_number: z.string().optional(),
    brand: z.string().optional(),
    model_name: z.string().optional(),
    problem_description: z.string().optional(),
    assigned_engineer: z.string().optional(),
    created_by: z.string().optional(),
    data: z.record(z.string(), z.any()).optional().describe('Any additional fields'),
  },
  async ({ ticket_no, ticket_type, priority, company_name, contact_name, contact_phone,
           serial_number, brand, model_name, problem_description, assigned_engineer,
           created_by, data: extra }) => {
    try {
      const payload = {
        ticket_no,
        ...(ticket_type && { ticket_type }),
        ...(priority && { priority }),
        ...(company_name && { company_name }),
        ...(contact_name && { contact_name }),
        ...(contact_phone && { contact_phone }),
        ...(serial_number && { serial_number }),
        ...(brand && { brand }),
        ...(model_name && { model_name }),
        ...(problem_description && { problem_description }),
        ...(assigned_engineer && { assigned_engineer }),
        ...(created_by && { created_by }),
        ...(extra ?? {}),
      };
      const { data, error } = await supabase
        .from('service_tickets')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_service_ticket',
  'Update a service ticket by ticket_no',
  {
    ticket_no: z.string().describe('Ticket number (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (status, resolution_notes, assigned_engineer, etc.)'),
  },
  async ({ ticket_no, data: updates }) => {
    try {
      const { data, error } = await supabase
        .from('service_tickets')
        .update(updates)
        .eq('ticket_no', ticket_no)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_product_inquiry',
  'Update a product inquiry header by inquiry_no (status, procurement_notes, priority, etc.)',
  {
    inquiry_no: z.string().describe('Inquiry number (e.g. INQ-2026-0001)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (status, procurement_notes, priority, remarks, etc.)'),
  },
  async ({ inquiry_no, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('product_inquiries')
        .update(payload)
        .eq('inquiry_no', inquiry_no)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_inquiry_item',
  'Update a single inquiry line item by its UUID id. Use this to fill in procurement responses: vendor_name, actual_price, lead_time_days, item_status, item_notes.',
  {
    id: z.string().describe('inquiry_items UUID (from db_get_product_inquiries → inquiry_items[].id)'),
    data: z.record(z.string(), z.any()).describe('Fields to update — e.g. { vendor_name, actual_price, item_status, lead_time_days, item_notes }'),
  },
  async ({ id, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('inquiry_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_pdi_record',
  'Create a new PDI (Pre-Delivery Inspection) record',
  {
    pdi_no: z.string().describe('PDI number (e.g. PDI-2026-0001)'),
    so_no: z.string().optional().describe('Related sale order number'),
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    assigned_engineer: z.string().optional(),
    created_by: z.string().optional(),
    data: z.record(z.string(), z.any()).optional().describe('Any additional pdi_records fields'),
  },
  async ({ pdi_no, so_no, company_name, contact_name, assigned_engineer, created_by, data: extra }) => {
    try {
      const payload = {
        pdi_no,
        ...(so_no && { so_no }),
        ...(company_name && { company_name }),
        ...(contact_name && { contact_name }),
        ...(assigned_engineer && { assigned_engineer }),
        ...(created_by && { created_by }),
        ...(extra ?? {}),
      };
      const { data, error } = await supabase
        .from('pdi_records')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_pdi_record',
  'Update a PDI record by pdi_no (status, inspection_notes, overall_condition, etc.)',
  {
    pdi_no: z.string().describe('PDI number (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (status, inspection_notes, overall_condition, software_installed, warranty_seal_applied, etc.)'),
  },
  async ({ pdi_no, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('pdi_records')
        .update(payload)
        .eq('pdi_no', pdi_no)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_serial_number',
  'Register a new serial number / warranty record',
  {
    serial_number: z.string().describe('Unique serial number'),
    brand: z.string().optional(),
    model_name: z.string().optional(),
    description: z.string().optional(),
    so_no: z.string().optional().describe('Sale order this unit was sold under'),
    company_name: z.string().optional().describe('Customer company'),
    contact_name: z.string().optional(),
    warranty_start_date: z.string().optional().describe('ISO date YYYY-MM-DD'),
    warranty_end_date: z.string().optional().describe('ISO date YYYY-MM-DD'),
    warranty_period_months: z.number().optional().describe('Default 12'),
    created_by: z.string().optional(),
    data: z.record(z.string(), z.any()).optional().describe('Any additional fields'),
  },
  async ({ serial_number, brand, model_name, description, so_no, company_name,
           contact_name, warranty_start_date, warranty_end_date,
           warranty_period_months, created_by, data: extra }) => {
    try {
      const payload = {
        serial_number,
        ...(brand && { brand }),
        ...(model_name && { model_name }),
        ...(description && { description }),
        ...(so_no && { so_no }),
        ...(company_name && { company_name }),
        ...(contact_name && { contact_name }),
        ...(warranty_start_date && { warranty_start_date }),
        ...(warranty_end_date && { warranty_end_date }),
        ...(warranty_period_months !== undefined && { warranty_period_months }),
        ...(created_by && { created_by }),
        ...(extra ?? {}),
      };
      const { data, error } = await supabase
        .from('serial_numbers')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_serial_number',
  'Update a serial number / warranty record by serial_number',
  {
    serial_number: z.string().describe('Serial number (unique key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (status, warranty_end_date, notes, company_name, etc.)'),
  },
  async ({ serial_number, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('serial_numbers')
        .update(payload)
        .eq('serial_number', serial_number)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_spare_part',
  'Add a new spare part to inventory',
  {
    part_no: z.string().describe('Unique part number (e.g. PRT-0001)'),
    part_name: z.string().describe('Part name / label'),
    brand: z.string().optional(),
    model_name: z.string().optional().describe('Compatible model'),
    category: z.string().optional().describe('e.g. Spare Part, Accessory, Consumable'),
    qty: z.number().optional().describe('Initial quantity'),
    unit_cost: z.number().optional(),
    currency: z.string().optional().describe('USD (default) or KHR'),
    supplier_name: z.string().optional(),
    created_by: z.string().optional(),
    data: z.record(z.string(), z.any()).optional().describe('Any additional fields'),
  },
  async ({ part_no, part_name, brand, model_name, category, qty, unit_cost,
           currency, supplier_name, created_by, data: extra }) => {
    try {
      const payload = {
        part_no,
        part_name,
        ...(brand && { brand }),
        ...(model_name && { model_name }),
        ...(category && { category }),
        ...(qty !== undefined && { qty }),
        ...(unit_cost !== undefined && { unit_cost }),
        ...(currency && { currency }),
        ...(supplier_name && { supplier_name }),
        ...(created_by && { created_by }),
        ...(extra ?? {}),
      };
      const { data, error } = await supabase
        .from('spare_parts')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_spare_part',
  'Update a spare part by part_no (qty, status, unit_cost, location, etc.)',
  {
    part_no: z.string().describe('Part number (unique key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (qty, status, unit_cost, location, min_qty, remarks, etc.)'),
  },
  async ({ part_no, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('spare_parts')
        .update(payload)
        .eq('part_no', part_no)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT WORKFLOW — full CRUD (Purchase Orders, Vendors, Vendor Pricelist, Inventory)
// ══════════════════════════════════════════════════════════════════════════════

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
};

// Generate the next PO number for a given year: PO-YYYY-NNN
async function nextPoNumber(year: number): Promise<string> {
  const prefix = `PO-${year}-`;
  const { data } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .ilike('po_number', `${prefix}%`)
    .order('po_number', { ascending: false })
    .limit(1);
  const last = data?.[0]?.po_number as string | undefined;
  const seq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  return `${prefix}${String((isNaN(seq) ? 0 : seq) + 1).padStart(3, '0')}`;
}

// Map incoming item objects to purchase_order_items rows for a given PO id.
function buildPoItemRows(poId: string, items: any[]): any[] {
  return (items ?? []).map((it, i) => {
    const qty = toNum(it.qty);
    const unit = toNum(it.unit_price ?? it.unitPrice);
    return {
      po_id: poId,
      line_number: it.line_number ?? i + 1,
      item_number: it.item_number ?? it.itemCode ?? '',
      description: it.description ?? '',
      qty,
      unit_price: unit,
      total: it.total != null ? toNum(it.total) : qty * unit,
      brand: it.brand ?? '',
      category: it.category ?? '',
      model_name: it.model_name ?? it.modelName ?? '',
      serial_number: it.serial_number ?? it.serialNumber ?? '',
      is_promotion: !!it.is_promotion,
    };
  });
}

reg(
  'db_get_purchase_order_items',
  'Get the line items of a purchase order by po_number.',
  {
    po_number: z.string().describe('Purchase order number, e.g. PO-2026-011'),
  },
  async ({ po_number }) => {
    try {
      const { data: po, error: pe } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('po_number', po_number)
        .single();
      if (pe) return err(pe.message);
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', po.id)
        .order('line_number');
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_create_purchase_order',
  'Create a purchase order (header + optional line items). Auto-generates po_number (PO-YYYY-NNN) if not supplied. If items are given and sub_total/grand_total are omitted, they are computed from the items (VAT tax_type adds 10%).',
  {
    data: z.record(z.string(), z.any()).describe('Header fields: vendor_name, vendor_id, order_date, delivery_date, payment_term, currency, status, tax_type, prepared_by, remarks, etc.'),
    items: z.array(z.record(z.string(), z.any())).optional().describe('Line items: { item_number, model_name, description, qty, unit_price, brand, category, serial_number }'),
  },
  async ({ data: header, items }) => {
    try {
      const now = new Date().toISOString();
      const orderDate = header.order_date ? new Date(header.order_date) : new Date();
      const year = isNaN(orderDate.getTime()) ? new Date().getFullYear() : orderDate.getFullYear();
      const po_number = header.po_number || (await nextPoNumber(year));

      const lineTotals = (items ?? []).map(it => (it.total != null ? toNum(it.total) : toNum(it.qty) * toNum(it.unit_price ?? it.unitPrice)));
      const computedSub = lineTotals.reduce((s, n) => s + n, 0);
      const isVat = String(header.tax_type ?? '').toUpperCase() === 'VAT';
      const sub_total = header.sub_total != null ? toNum(header.sub_total) : computedSub;
      const vat_amount = header.vat_amount != null ? toNum(header.vat_amount) : (isVat ? sub_total * 0.1 : 0);
      const grand_total = header.grand_total != null ? toNum(header.grand_total) : sub_total + vat_amount;

      const payload = {
        ...header,
        po_number,
        currency: header.currency ?? 'USD',
        status: header.status ?? 'Draft',
        sub_total,
        vat_amount,
        grand_total,
        created_at: now,
        updated_at: now,
      };
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .insert(payload)
        .select()
        .single();
      if (error) return err(error.message);

      let insertedItems: any[] = [];
      if (items && items.length) {
        const rows = buildPoItemRows(po.id, items);
        const { data: itData, error: itErr } = await supabase
          .from('purchase_order_items')
          .insert(rows)
          .select();
        if (itErr) return err(`PO ${po_number} created, but items failed: ${itErr.message}`);
        insertedItems = itData ?? [];
      }
      return ok({ purchase_order: po, items: insertedItems });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_purchase_order',
  'Update a purchase order header by po_number. If items are provided, they REPLACE all existing line items for that PO.',
  {
    po_number: z.string().describe('Purchase order number (key)'),
    data: z.record(z.string(), z.any()).optional().describe('Header fields to update (status, delivery_date, sub_total, grand_total, remarks, etc.)'),
    items: z.array(z.record(z.string(), z.any())).optional().describe('If given, deletes existing line items and inserts these instead'),
  },
  async ({ po_number, data: updates, items }) => {
    try {
      const { data: existing, error: findErr } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('po_number', po_number)
        .single();
      if (findErr) return err(findErr.message);

      let po = null;
      if (updates && Object.keys(updates).length) {
        const { data, error } = await supabase
          .from('purchase_orders')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('po_number', po_number)
          .select()
          .single();
        if (error) return err(error.message);
        po = data;
      }

      let replacedItems: any[] | undefined;
      if (items) {
        await supabase.from('purchase_order_items').delete().eq('po_id', existing.id);
        if (items.length) {
          const { data: itData, error: itErr } = await supabase
            .from('purchase_order_items')
            .insert(buildPoItemRows(existing.id, items))
            .select();
          if (itErr) return err(`Header updated, but items replace failed: ${itErr.message}`);
          replacedItems = itData ?? [];
        } else {
          replacedItems = [];
        }
      }
      return ok({ purchase_order: po ?? { po_number, id: existing.id }, items: replacedItems });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_delete_purchase_order',
  'Delete a purchase order (and its line items) by po_number. This does not touch inventory rows already created from it.',
  {
    po_number: z.string().describe('Purchase order number to delete'),
  },
  async ({ po_number }) => {
    try {
      const { data: po, error: findErr } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('po_number', po_number)
        .single();
      if (findErr) return err(findErr.message);
      await supabase.from('purchase_order_items').delete().eq('po_id', po.id);
      const { error } = await supabase.from('purchase_orders').delete().eq('po_number', po_number);
      if (error) return err(error.message);
      return ok({ deleted: po_number });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ── Vendors ─────────────────────────────────────────────────────────────────────

reg(
  'db_create_vendor',
  'Create a vendor (Vendor Master).',
  {
    vendor_name: z.string().describe('Vendor name'),
    data: z.record(z.string(), z.any()).optional().describe('Optional fields: contact_person, email, phone, address, website, payment_terms, tax_id, category, status, remarks'),
  },
  async ({ vendor_name, data: extra }) => {
    try {
      const now = new Date().toISOString();
      const payload = { vendor_name, status: 'Active', ...(extra ?? {}), created_at: now, updated_at: now };
      const { data, error } = await supabase.from('vendors').insert(payload).select().single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_vendor',
  'Update a vendor by id (preferred) or by vendor_name.',
  {
    id: z.string().optional().describe('Vendor UUID (preferred key)'),
    vendor_name: z.string().optional().describe('Vendor name (used if id not given)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
  },
  async ({ id, vendor_name, data: updates }) => {
    try {
      if (!id && !vendor_name) return err('Provide id or vendor_name');
      let q = supabase.from('vendors').update({ ...updates, updated_at: new Date().toISOString() });
      q = id ? q.eq('id', id) : q.eq('vendor_name', vendor_name!);
      const { data, error } = await q.select();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_delete_vendor',
  'Delete a vendor by id.',
  { id: z.string().describe('Vendor UUID') },
  async ({ id }) => {
    try {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) return err(error.message);
      return ok({ deleted: id });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ── Vendor Pricelist ──────────────────────────────────────────────────────────

reg(
  'db_create_vendor_pricelist',
  'Add a vendor pricelist item.',
  {
    data: z.record(z.string(), z.any()).describe('Fields: brand, model_name, specification, dealer_price, user_price, currency, promotion, status, vendor_id, remarks'),
  },
  async ({ data: fields }) => {
    try {
      const now = new Date().toISOString();
      const payload = { currency: 'USD', status: 'Active', ...fields, created_at: now, updated_at: now };
      const { data, error } = await supabase.from('vendor_pricelist').insert(payload).select().single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_vendor_pricelist',
  'Update a vendor pricelist item by id.',
  {
    id: z.string().describe('Vendor pricelist row UUID'),
    data: z.record(z.string(), z.any()).describe('Fields to update (dealer_price, user_price, promotion, status, etc.)'),
  },
  async ({ id, data: updates }) => {
    try {
      const { data, error } = await supabase
        .from('vendor_pricelist')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_delete_vendor_pricelist',
  'Delete a vendor pricelist item by id.',
  { id: z.string().describe('Vendor pricelist row UUID') },
  async ({ id }) => {
    try {
      const { error } = await supabase.from('vendor_pricelist').delete().eq('id', id);
      if (error) return err(error.message);
      return ok({ deleted: id });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ── Inventory (completes CRUD; get + update already exist) ─────────────────────

reg(
  'db_create_inventory',
  'Create an inventory item (stock intake). Typically linked to a PO via po_id/po_number.',
  {
    data: z.record(z.string(), z.any()).describe('Fields: code, brand, model_name, description, category, qty, unit_price, currency, status, po_id, po_number, vendor_id, vendor_name'),
  },
  async ({ data: fields }) => {
    try {
      const now = new Date().toISOString();
      const payload = { currency: 'USD', qty: 0, status: 'In Stock', ...fields, created_at: now, updated_at: now };
      const { data, error } = await supabase.from('inventory').insert(payload).select().single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_delete_inventory',
  'Delete an inventory item by id (UUID, preferred) or code.',
  {
    id: z.string().optional().describe('Inventory item UUID'),
    code: z.string().optional().describe('Inventory item code (used if id not given)'),
  },
  async ({ id, code }) => {
    try {
      if (!id && !code) return err('Provide id or code');
      let q = supabase.from('inventory').delete();
      q = id ? q.eq('id', id) : q.eq('code', code!);
      const { error } = await q;
      if (error) return err(error.message);
      return ok({ deleted: id ?? code });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ── Sales helpers ──────────────────────────────────────────────────────────────

reg(
  'db_delete_quotation',
  'Delete a draft quotation by Quote No. Only deletes if status is Draft or Open — refuses to delete won/lost records to protect history.',
  {
    quoteNo: z.string().describe('Quote No to delete'),
    type: z.enum(['b2c', 'b2b']).optional(),
    force: z.boolean().optional().describe('If true, skip the status guard and delete regardless of status'),
  },
  async ({ quoteNo, type, force }) => {
    try {
      const table = type === 'b2b' ? 'b2b_quotations' : 'quotations';
      if (!force) {
        const { data: row, error: findErr } = await supabase
          .from(table)
          .select('Status')
          .eq('Quote No', quoteNo)
          .single();
        if (findErr) return err(findErr.message);
        const s = (row?.Status ?? '').toLowerCase();
        if (s.includes('win') || s.includes('lost') || s.includes('close')) {
          return err(`Refused: status is "${row?.Status}". Pass force=true to override.`);
        }
      }
      const { error } = await supabase.from(table).delete().eq('Quote No', quoteNo);
      if (error) return err(error.message);
      return ok({ deleted: quoteNo });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_update_delivery_order',
  'Update a delivery order by DO No (status, remarks, delivery_date, etc.)',
  {
    do_no: z.string().describe('DO No (primary key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update (Status, Remarks, DO Date, etc.)'),
  },
  async ({ do_no, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('delivery_orders')
        .update(payload)
        .eq('DO No', do_no)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_company_overview',
  'Return a 360° view of a company: company record + contacts + open pipelines + recent sale orders + unpaid invoices + open service tickets + recent contact logs.',
  {
    company: z.string().describe('Company name (exact or partial match)'),
    type: z.enum(['b2c', 'b2b']).optional().describe('Which SO/invoice tables to query (default b2c)'),
  },
  async ({ company, type }) => {
    try {
      const soTable = type === 'b2b' ? 'b2b_sale_orders' : 'sale_orders';
      const invTable = type === 'b2b' ? 'b2b_invoices' : 'invoices';
      const pipeTable = type === 'b2b' ? 'b2b_pipelines' : 'pipelines';

      const [companyRes, contactsRes, pipelinesRes, soRes, invoiceRes, ticketRes, logRes] =
        await Promise.all([
          supabase.from('companies').select('*').ilike('Company Name', `%${company}%`).limit(3),
          supabase.from('contacts').select('*').ilike('Company Name', `%${company}%`).limit(20),
          supabase.from(pipeTable).select('*').ilike('Company Name', `%${company}%`)
            .not('Status', 'ilike', '%close%').order('Pipeline No', { ascending: false }).limit(10),
          supabase.from(soTable).select('*').ilike('Company Name', `%${company}%`)
            .order('SO No', { ascending: false }).limit(10),
          supabase.from(invTable).select('*').ilike('Company Name', `%${company}%`)
            .neq('Status', 'Completed').neq('Status', 'Cancel')
            .order('Inv No', { ascending: false }).limit(10),
          supabase.from('service_tickets').select('*').ilike('company_name', `%${company}%`)
            .not('status', 'eq', 'Closed').order('ticket_date', { ascending: false }).limit(10),
          supabase.from('contact_logs').select('*').ilike('Company Name', `%${company}%`)
            .order('Log ID', { ascending: false }).limit(10),
        ]);

      return ok({
        companies: companyRes.data ?? [],
        contacts: contactsRes.data ?? [],
        open_pipelines: pipelinesRes.data ?? [],
        recent_sale_orders: soRes.data ?? [],
        unpaid_invoices: invoiceRes.data ?? [],
        open_service_tickets: ticketRes.data ?? [],
        recent_contact_logs: logRes.data ?? [],
      });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_run_digest',
  'Return a business intelligence digest: open pipeline count, pending SOs, unpaid invoices total, overdue invoices, open service tickets by priority, and last-7-day activity summary. Use this for daily briefings or AI summaries.',
  {
    type: z.enum(['b2c', 'b2b']).optional().describe('Which tables to query (default b2c)'),
  },
  async ({ type }) => {
    try {
      const soTable = type === 'b2b' ? 'b2b_sale_orders' : 'sale_orders';
      const invTable = type === 'b2b' ? 'b2b_invoices' : 'invoices';
      const pipeTable = type === 'b2b' ? 'b2b_pipelines' : 'pipelines';

      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const [
        pipelinesRes,
        pendingSoRes,
        unpaidInvRes,
        overdueInvRes,
        ticketsRes,
        recentLogsRes,
        recentMeetingsRes,
        recentQuotesRes,
      ] = await Promise.all([
        supabase.from(pipeTable).select('Status,"Company Name"').not('Status', 'ilike', '%close%'),
        supabase.from(soTable).select('"SO No","Company Name","Grand Total",Status').eq('Status', 'Pending').limit(100),
        supabase.from(invTable).select('"Inv No","Company Name","Grand Total","Due Date",Status')
          .not('Status', 'eq', 'Completed').not('Status', 'eq', 'Cancel').limit(200),
        supabase.from(invTable).select('"Inv No","Company Name","Grand Total","Due Date"')
          .not('Status', 'eq', 'Completed').not('Status', 'eq', 'Cancel')
          .lt('Due Date', today).limit(50),
        supabase.from('service_tickets').select('status,priority,ticket_type').not('status', 'eq', 'Closed'),
        supabase.from('contact_logs').select('"Contact Name","Company Name","Contact Date","Remark"')
          .gte('Contact Date', sevenDaysAgo).order('Log ID', { ascending: false }).limit(30),
        supabase.from('meeting_logs').select('"Company Name","Meeting Date","Meeting Type","Remark"')
          .gte('Meeting Date', sevenDaysAgo).order('Meeting ID', { ascending: false }).limit(20),
        supabase.from(type === 'b2b' ? 'b2b_quotations' : 'quotations')
          .select('"Quote No","Company Name","Grand Total",Status')
          .gte('Quote Date', sevenDaysAgo).order('Quote No', { ascending: false }).limit(30),
      ]);

      const unpaidInvoices = unpaidInvRes.data ?? [];
      const totalOutstanding = unpaidInvoices.reduce(
        (s: number, inv: any) => s + (parseFloat(inv['Grand Total']) || 0),
        0,
      );
      const overdueList = overdueInvRes.data ?? [];
      const totalOverdue = overdueList.reduce(
        (s: number, inv: any) => s + (parseFloat(inv['Grand Total']) || 0),
        0,
      );

      const ticketsByPriority: Record<string, number> = {};
      for (const t of ticketsRes.data ?? []) {
        const p = t.priority ?? 'Unknown';
        ticketsByPriority[p] = (ticketsByPriority[p] ?? 0) + 1;
      }
      const ticketsByStatus: Record<string, number> = {};
      for (const t of ticketsRes.data ?? []) {
        const s = t.status ?? 'Unknown';
        ticketsByStatus[s] = (ticketsByStatus[s] ?? 0) + 1;
      }

      const pendingSos = pendingSoRes.data ?? [];
      const totalPendingValue = pendingSos.reduce(
        (s: number, so: any) => s + (parseFloat(so['Grand Total']) || 0),
        0,
      );

      return ok({
        as_of: today,
        pipelines: {
          open_count: (pipelinesRes.data ?? []).length,
        },
        sale_orders: {
          pending_count: pendingSos.length,
          pending_total_usd: totalPendingValue,
        },
        invoices: {
          unpaid_count: unpaidInvoices.length,
          outstanding_total_usd: totalOutstanding,
          overdue_count: overdueList.length,
          overdue_total_usd: totalOverdue,
          overdue_list: overdueList.slice(0, 10),
        },
        service_tickets: {
          open_count: (ticketsRes.data ?? []).length,
          by_priority: ticketsByPriority,
          by_status: ticketsByStatus,
        },
        last_7_days: {
          new_quotations: (recentQuotesRes.data ?? []).length,
          contact_logs: recentLogsRes.data ?? [],
          meetings: recentMeetingsRes.data ?? [],
          quotations: recentQuotesRes.data ?? [],
        },
      });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ── Procurement helpers ────────────────────────────────────────────────────────

reg(
  'db_convert_po_to_inventory',
  'Mark a PO as Completed and convert its line items to inventory rows. No-op if inventory already exists for this PO (idempotent). Returns count of items created.',
  {
    po_number: z.string().describe('Purchase order number to convert'),
  },
  async ({ po_number }) => {
    try {
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('id, status')
        .eq('po_number', po_number)
        .single();
      if (poErr) return err(poErr.message);

      // Check if already converted
      const { data: existing } = await supabase
        .from('inventory')
        .select('id')
        .eq('po_id', po.id)
        .limit(1);
      if (existing && existing.length > 0) {
        return ok({ already_converted: true, po_number, message: 'Inventory rows already exist for this PO.' });
      }

      // Fetch items
      const { data: items, error: itemsErr } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('po_id', po.id)
        .order('line_number');
      if (itemsErr) return err(itemsErr.message);

      // Fetch full PO for vendor info
      const { data: fullPo, error: fullPoErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('po_number', po_number)
        .single();
      if (fullPoErr) return err(fullPoErr.message);

      const filteredItems = (items ?? []).filter((it: any) => it.qty > 0 && !it.is_promotion);
      if (filteredItems.length === 0) {
        return ok({ converted: false, po_number, message: 'No eligible items (qty > 0, not promotion).' });
      }

      // Build inventory rows
      const now = new Date().toISOString();
      const invPayload = filteredItems.map((it: any) => ({
        po_id: po.id,
        po_number,
        vendor_id: fullPo.vendor_id ?? null,
        vendor_name: fullPo.vendor_name ?? '',
        category: it.category || 'General',
        code: it.item_number || '',
        brand: it.brand || '',
        model_name: it.model_name || it.description?.substring(0, 80) || 'N/A',
        description: it.description || '',
        serial_number: (it.serial_number ?? '').split(/[\n,]/).map((s: string) => s.trim()).filter(Boolean).join(', '),
        qty: it.qty,
        unit_price: it.unit_price ?? 0,
        currency: fullPo.currency ?? 'USD',
        status: 'In Stock',
        created_by: 'MCP',
        created_at: now,
        updated_at: now,
      }));

      const { data: inserted, error: insErr } = await supabase
        .from('inventory')
        .insert(invPayload)
        .select('id, code, model_name');
      if (insErr) return err(insErr.message);

      // Mark PO as Completed
      await supabase
        .from('purchase_orders')
        .update({ status: 'Completed', updated_at: now })
        .eq('po_number', po_number);

      return ok({
        converted: true,
        po_number,
        items_created: (inserted ?? []).length,
        inventory: inserted ?? [],
      });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'db_get_inventory_valuation',
  'Return a summary of inventory stock value grouped by category, plus a grand total and low-stock count.',
  {},
  async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('category, brand, qty, unit_price, currency, status')
        .order('category');
      if (error) return err(error.message);

      const rows = data ?? [];
      const byCategory: Record<string, { count: number; total_usd: number }> = {};
      let grandTotal = 0;
      let lowStockCount = 0;

      for (const row of rows) {
        const cat = row.category || 'Uncategorized';
        const val = (parseFloat(row.qty) || 0) * (parseFloat(row.unit_price) || 0);
        if (!byCategory[cat]) byCategory[cat] = { count: 0, total_usd: 0 };
        byCategory[cat].count += 1;
        byCategory[cat].total_usd += val;
        grandTotal += val;
        if ((parseFloat(row.qty) || 0) <= 0) lowStockCount++;
      }

      return ok({
        grand_total_usd: Math.round(grandTotal * 100) / 100,
        total_items: rows.length,
        low_stock_count: lowStockCount,
        by_category: Object.entries(byCategory).map(([category, v]) => ({
          category,
          item_count: v.count,
          total_usd: Math.round(v.total_usd * 100) / 100,
        })).sort((a, b) => b.total_usd - a.total_usd),
      });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

// ══════════════════════════════════════════════════════════════════════════════
// Google Sheets tools
// ══════════════════════════════════════════════════════════════════════════════

reg(
  'sheets_list',
  'List all configured Google Sheets with their real title and tab names',
  {},
  async () => {
    try {
      const sheetsClient = await getSheetsClient();
      const results = await Promise.all(
        SHEET_IDS.map(async id => {
          try {
            const meta = await sheetsClient.spreadsheets.get({ spreadsheetId: id });
            return {
              id,
              title: meta.data.properties?.title ?? id,
              tabs: (meta.data.sheets ?? []).map(
                (s: any) => s.properties?.title ?? '',
              ),
            };
          } catch (e) {
            return { id, title: id, tabs: [], error: (e as Error).message };
          }
        }),
      );
      return ok(results);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

reg(
  'sheets_read',
  'Read rows from a Google Sheet tab. Resolves fuzzy sheet/tab names. Smart header detection.',
  {
    sheet: z.string().describe('Sheet title (fuzzy) or exact spreadsheet ID'),
    tab: z.string().describe('Tab name (case-insensitive fuzzy match)'),
    rows: z.number().optional().describe('Max data rows to return (default 150)'),
    skip: z.number().optional().describe('Skip N data rows for pagination (default 0)'),
  },
  async ({ sheet, tab, rows, skip }) => {
    try {
      const spreadsheetId = await resolveSpreadsheetId(sheet);
      if (!spreadsheetId) {
        return err(
          `Sheet not found: "${sheet}". Use sheets_list to see available sheets.`,
        );
      }

      const sheetsClient = await getSheetsClient();
      const tabResult = await resolveTabName(sheetsClient, spreadsheetId, tab);
      if (!tabResult) {
        const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
        const available = (meta.data.sheets ?? []).map(
          (s: any) => s.properties?.title ?? '',
        );
        return err(
          `Tab "${tab}" not found. Available tabs: ${available.join(', ')}`,
        );
      }

      const resp = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: tabResult.name,
      });

      const allRows: any[][] = resp.data.values ?? [];
      if (allRows.length === 0) {
        return ok({ headers: [], data: [], note: 'Sheet is empty' });
      }

      const { headerIndex, header } = detectHeaderRow(allRows);

      // Strip trailing blank columns, cap at 25
      const nonBlankCount = header.filter(h => h.trim() !== '').length;
      const colCount = Math.min(nonBlankCount + 1, 25);
      const cleanHeader = header.slice(0, colCount);

      const dataRows = allRows.slice(headerIndex + 1);
      if (dataRows.length === 0) {
        return ok({
          spreadsheetId,
          tab: tabResult.name,
          headers: cleanHeader,
          data: [],
          rawPreview: allRows.slice(0, 10),
          note: 'No data rows found after detected header',
        });
      }

      const offset = skip ?? 0;
      const limit = rows ?? 150;
      const paged = dataRows.slice(offset, offset + limit);

      const result = paged.map(row => {
        const obj: Record<string, any> = {};
        for (let i = 0; i < colCount; i++) {
          const key = cleanHeader[i] || `col_${i}`;
          obj[key] = row[i] ?? '';
        }
        return obj;
      });

      return ok({
        spreadsheetId,
        tab: tabResult.name,
        headers: cleanHeader,
        totalDataRows: dataRows.length,
        returnedRows: result.length,
        skip: offset,
        data: result,
      });
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

  return server;
} // end createMcpServer

// ── Start ──────────────────────────────────────────────────────────────────────

async function main() {
  const PORT = process.env.PORT;

  if (PORT) {
    // ── HTTP mode (deployed / shared) ─────────────────────────────────────────
    const app = express();
    app.use(express.json());

    // Health check — unauthenticated, before any auth middleware
    app.get('/', (_req, _res: any) => _res.json({ name: 'lpt-mcp', version: '1.0.0', status: 'ok' }));

    // Shared auth + role resolver for all MCP endpoints
    const withRole = (req: any, res: any, next: any) => {
      const { authorized, role } = resolveRole(req.headers['authorization'] ?? '');
      if (!authorized) return res.status(401).json({ error: 'Unauthorized' });
      req.mcpRole = role;
      next();
    };

    // ── Streamable HTTP (Claude API / SDK clients) ─────────────────────────────
    app.post('/mcp', withRole, async (req: any, res: any) => {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcpServer = createMcpServer(req.mcpRole);
      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => { transport.close(); mcpServer.close(); });
      } catch (e) {
        if (!res.headersSent)
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
      }
    });
    app.get('/mcp', (_req: any, res: any) => res.status(405).json({ error: 'Use POST' }));
    app.delete('/mcp', (_req: any, res: any) => res.status(405).json({ error: 'Use POST' }));

    // ── SSE (Claude Desktop / mcp-remote) ─────────────────────────────────────
    const sseSessions: Record<string, { transport: SSEServerTransport; role: Role }> = {};

    app.get('/sse', withRole, async (req: any, res: any) => {
      const transport = new SSEServerTransport('/messages', res);
      sseSessions[transport.sessionId] = { transport, role: req.mcpRole };
      const mcpServer = createMcpServer(req.mcpRole);
      await mcpServer.connect(transport);
      res.on('close', () => {
        delete sseSessions[transport.sessionId];
        transport.close();
        mcpServer.close();
      });
    });

    app.post('/messages', async (req: any, res: any) => {
      const sessionId = req.query.sessionId as string;
      const session = sseSessions[sessionId];
      if (!session) return res.status(400).json({ error: 'Unknown sessionId' });
      await session.transport.handlePostMessage(req, res, req.body);
    });

    const port = Number(PORT);
    const hasAuth = !!(process.env.MCP_API_KEY || process.env.MCP_API_KEY_MARKETING);
    app.listen(port, '0.0.0.0', () => {
      process.stderr.write(`[lpt-mcp] HTTP server on 0.0.0.0:${port} (v1.0.0)${hasAuth ? ' [auth enabled]' : ' [no auth]'}\n`);
    });
  } else {
    // ── Stdio mode (local Claude Desktop) ────────────────────────────────────
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
    process.stderr.write('[lpt-mcp] Server running on stdio (v1.0.0)\n');
  }
}

main().catch(e => {
  process.stderr.write(`[lpt-mcp] Fatal: ${(e as Error).message}\n`);
  process.exit(1);
});
