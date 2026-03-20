/**
 * /api/pdf/generate — POST
 * Body: PdfTemplateOptions (JSON)
 * Returns: application/pdf bytes
 *
 * Uses puppeteer-core + the locally installed Chrome to
 * render the invoice HTML and print it to PDF.
 * Khmer text is shaped by Chrome's built-in HarfBuzz engine.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildHtml, PdfTemplateOptions } from '@/lib/pdfTemplate';

// Vercel deployment requirements
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Executable path: Vercel uses @sparticuz/chromium, local uses installed Chrome
const LOCAL_CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function POST(req: NextRequest) {
    let opts: PdfTemplateOptions;
    try {
        opts = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!opts.type || !opts.headerData || !opts.items || !opts.totals || !opts.currency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let browser: any = null;
    try {
        const html = buildHtml(opts);

        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const chromium = require('@sparticuz/chromium').default as any;
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const puppeteer = require('puppeteer-core') as any;

        // Configure browser for Vercel/Serverless or Local
        const isVercel = !!process.env.VERCEL;
        const executablePath = isVercel 
            ? await chromium.executablePath() 
            : (process.env.CHROME_EXECUTABLE_PATH || LOCAL_CHROME);

        browser = await puppeteer.launch({
            executablePath,
            args: isVercel ? chromium.args : [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--font-render-hinting=none',
            ],
            headless: true,
            defaultViewport: { width: 1200, height: 800 },
        });

        const page = await browser.newPage();

        // Set content and wait for fonts + the logo image to load
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

        // Wait for @font-face to finish
        await page.evaluateHandle('document.fonts.ready');

        // page.pdf() returns Uint8Array in newer puppeteer-core types;
        // convert to Node Buffer so NextResponse accepts it as BodyInit.
        const pdfBuffer = Buffer.from(await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        }));

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${sanitizeFilename(opts)}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error('[PDF API] Puppeteer error:', err);
        return NextResponse.json({ error: 'PDF generation failed', detail: String(err) }, { status: 500 });
    } finally {
        if (browser) await browser.close();
    }
}

function sanitizeFilename(opts: PdfTemplateOptions): string {
    const id = opts.headerData['Quotation ID']
        || opts.headerData['Sale Order ID']
        || opts.headerData['Invoice No']
        || opts.headerData['PO Number']
        || opts.type;
    return `${String(id).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;
}
