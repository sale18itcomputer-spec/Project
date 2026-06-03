import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

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

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

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

// ── Server factory ────────────────────────────────────────────────────────────
// Called once per stdio session, or once per HTTP request (stateless mode).

function createMcpServer() {
const server = new McpServer({ name: 'lpt-mcp', version: '1.0.0' });

// ══════════════════════════════════════════════════════════════════════════════
// READ — Supabase
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
  'db_get_quotations',
  'Get quotations. Filter by type (b2c/b2b), company, dateFrom.',
  {
    type: z.enum(['b2c', 'b2b']).optional().describe('b2c (default) or b2b'),
    company: z.string().optional(),
    dateFrom: z.string().optional().describe('ISO date — Quote Date >='),
    status: z.string().optional().describe('e.g. Open, Close (Win)'),
  },
  async ({ type, company, dateFrom, status }) => {
    try {
      const table = type === 'b2b' ? 'b2b_quotations' : 'quotations';
      let q = supabase.from(table).select('*').order('Quote No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (dateFrom) q = q.gte('Quote Date', dateFrom);
      if (status) q = q.eq('Status', status);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

server.tool(
  'db_get_sale_orders',
  'Get sale orders. Filter by company, status, dateFrom, type (b2c/b2b).',
  {
    type: z.enum(['b2c', 'b2b']).optional(),
    company: z.string().optional(),
    status: z.string().optional().describe('Pending | Completed | Cancel'),
    dateFrom: z.string().optional().describe('ISO date — SO Date >='),
  },
  async ({ type, company, status, dateFrom }) => {
    try {
      const table = type === 'b2b' ? 'b2b_sale_orders' : 'sale_orders';
      let q = supabase.from(table).select('*').order('SO No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (status) q = q.eq('Status', status);
      if (dateFrom) q = q.gte('SO Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

server.tool(
  'db_get_invoices',
  'Get invoices. Filter by type (b2c/b2b), company, status, dateFrom.',
  {
    type: z.enum(['b2c', 'b2b']).optional(),
    company: z.string().optional(),
    status: z.string().optional().describe('Draft | Processing | Completed | Cancel'),
    dateFrom: z.string().optional().describe('ISO date — Inv Date >='),
  },
  async ({ type, company, status, dateFrom }) => {
    try {
      const table = type === 'b2b' ? 'b2b_invoices' : 'invoices';
      let q = supabase.from(table).select('*').order('Inv No', { ascending: false });
      if (company) q = q.ilike('Company Name', `%${company}%`);
      if (status) q = q.eq('Status', status);
      if (dateFrom) q = q.gte('Inv Date', dateFrom);
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

server.tool(
  'db_get_pipelines',
  'Get pipeline projects. status=open (default) excludes closed pipelines.',
  {
    type: z.enum(['b2c', 'b2b']).optional(),
    status: z.string().optional().describe(
      'open (default) | closed | exact Status value',
    ),
    company: z.string().optional(),
  },
  async ({ type, status, company }) => {
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
      const { data, error } = await q.limit(200);
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

// ══════════════════════════════════════════════════════════════════════════════
// WRITE — Supabase
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
  'db_update_inventory',
  'Update an inventory item by code',
  {
    code: z.string().describe('Inventory item code (unique key)'),
    data: z.record(z.string(), z.any()).describe('Fields to update'),
  },
  async ({ code, data: updates }) => {
    try {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('inventory')
        .update(payload)
        .eq('code', code)
        .select()
        .single();
      if (error) return err(error.message);
      return ok(data);
    } catch (e) {
      return err((e as Error).message);
    }
  },
);

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

// ══════════════════════════════════════════════════════════════════════════════
// Google Sheets tools
// ══════════════════════════════════════════════════════════════════════════════

server.tool(
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

server.tool(
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
    const express = (await import('express')).default;
    const app = createMcpExpressApp({ host: '0.0.0.0' });
    app.use(express.json()); // parse JSON bodies for POST /mcp
    const API_KEY = process.env.MCP_API_KEY;

    // Bearer-token auth — skip if MCP_API_KEY is not configured
    app.use('/mcp', (req: any, res: any, next: any) => {
      if (!API_KEY) return next();
      const auth = req.headers['authorization'] ?? '';
      if (auth === `Bearer ${API_KEY}`) return next();
      res.status(401).json({ error: 'Unauthorized' });
    });

    app.post('/mcp', async (req: any, res: any) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      const mcpServer = createMcpServer();
      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => { transport.close(); mcpServer.close(); });
      } catch (e) {
        if (!res.headersSent)
          res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
      }
    });

    // GET/DELETE not used in stateless mode
    app.get('/mcp', (_req: any, res: any) => res.status(405).json({ error: 'Use POST' }));
    app.delete('/mcp', (_req: any, res: any) => res.status(405).json({ error: 'Use POST' }));

    // Health check
    app.get('/', (_req: any, res: any) => res.json({ name: 'lpt-mcp', version: '1.0.0', status: 'ok' }));

    app.listen(Number(PORT), () => {
      process.stderr.write(`[lpt-mcp] HTTP server on port ${PORT} (v1.0.0)${API_KEY ? ' [auth enabled]' : ' [no auth]'}\n`);
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
