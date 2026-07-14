/**
 * POST /api/ai-chat/extract — pull text out of an uploaded file so it can be
 * attached to the chat as context. Multipart form: field "file".
 *
 * Supported: plain text / code / csv / json / md, Excel (.xlsx/.xls) and CSV
 * via the xlsx lib, and PDF via pdfjs. Images return { kind: 'image' } (they
 * need a vision model to be understood).
 *
 * Auth: dashboard session cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/agentServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log|ya?ml|xml|html?|js|ts|tsx|jsx|py|java|c|cpp|cs|go|rb|php|sql|sh|ini|conf|env)$/i;

async function extractPdf(buf: Uint8Array): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true, isEvalSupported: false }).promise;
  const parts: string[] = [];
  const pages = Math.min(doc.numPages, 100);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it: any) => (typeof it.str === 'string' ? it.str : '')).join(' '));
  }
  return parts.join('\n').replace(/[ \t]+/g, ' ').trim();
}

async function extractSpreadsheet(buf: Uint8Array): Promise<string> {
  const XLSX: any = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames
    .map((n: string) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
    .join('\n\n')
    .trim();
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart form data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'File too large (max 15 MB)' }, { status: 413 });

  const name = (file as any).name || 'file';
  const type = file.type || '';
  const buf = new Uint8Array(await file.arrayBuffer());

  try {
    if (type.startsWith('image/')) {
      return NextResponse.json({ ok: true, kind: 'image', title: name });
    }

    let text = '';
    if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      text = await extractPdf(buf);
    } else if (/sheet|excel|ms-excel/.test(type) || /\.(xlsx|xls)$/i.test(name)) {
      text = await extractSpreadsheet(buf);
    } else if (type.startsWith('text/') || TEXT_EXT.test(name) || type === 'application/json') {
      text = Buffer.from(buf).toString('utf8');
    } else {
      // Last resort: treat as UTF-8 text.
      text = Buffer.from(buf).toString('utf8');
      if (/�/.test(text.slice(0, 500))) {
        return NextResponse.json({ ok: false, error: `Unsupported file type (${type || name}). Use PDF, Excel/CSV, or a text document.` }, { status: 415 });
      }
    }

    text = text.replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return NextResponse.json({ ok: false, error: 'No readable text found in that file.' }, { status: 422 });
    return NextResponse.json({ ok: true, kind: 'text', title: name, text: text.slice(0, 60_000) });
  } catch (e: any) {
    console.error('[ai-chat/extract]', e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || 'Could not read that file.' }, { status: 500 });
  }
}
