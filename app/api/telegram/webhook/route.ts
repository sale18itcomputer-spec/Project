/**
 * POST /api/telegram/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSession,
  createSession,
  updateSessionData,
  advanceSession,
  addItemToSession,
  clearSession,
  formatSessionSummary,
  matchCompanies,
  parseItemInput,
  TgSessionData,
} from '@/lib/telegramSession';
import {
  getNextQuoteNo,
  lookupPricelistItem,
  searchPricelist,
  getAllCompanyNames,
  getCompanyByName,
  getContactsForCompany,
  saveQuotationFromSession,
  sendTelegramMessage,
  generateQuotationPDF,
  sendTelegramDocument,
  formatPricelistResults,
} from '@/lib/telegramQuote';

function isValidRequest(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  const header = request.headers.get('x-telegram-bot-api-secret-token');
  return header === secret;
}

export async function POST(request: NextRequest) {
  if (!isValidRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const callbackQuery = body?.callback_query;
  if (callbackQuery) {
    const chatId = callbackQuery.message?.chat?.id;
    const data = callbackQuery.data;
    const username = callbackQuery.from?.username ?? callbackQuery.from?.first_name ?? 'user';
    if (chatId && data) {
      await handleCallback(chatId, data, username);
    }
    return NextResponse.json({ ok: true });
  }

  const message = body?.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat?.id;
  const text: string = (message.text ?? '').trim();
  const username: string = message.from?.username ?? message.from?.first_name ?? String(message.from?.id);

  if (!chatId || !text) return NextResponse.json({ ok: true });

  try {
    await handleMessage(chatId, text, username);
  } catch (err: any) {
    console.error('[Telegram webhook] Unhandled error:', err);
    await sendTelegramMessage(chatId, `\u26a0\ufe0f *Technical Error:*\n\`${err.message || String(err)}\`\n\nTry /cancel to reset.`, 'none').catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

async function handleMessage(chatId: number, text: string, username: string) {
  if (text === '\ud83d\udd0d Search Item') {
    return sendTelegramMessage(chatId, '\ud83d\udd0d *Pricelist Search*\n\nType a keyword to search (e.g. `HP` or `MSI`):');
  }
  if (text === '\ud83d\udcdd Manual Add') {
    return sendTelegramMessage(chatId, '\ud83d\udcdd *Manual Item Entry*\n\nPlease enter the details in this format:\n\n`Model`\n`Description`\n`Qty Price`');
  }

  const session = await getSession(chatId);
  const state = session?.state ?? 'IDLE';

  if (text === '\ud83d\udccb View Summary' && session) return handleDone(chatId, session);
  if (text === '\u2705 Finish & Confirm' && session) {
    if (session.state === 'COLLECTING_ITEMS') await advanceSession(chatId, 'AWAITING_CONFIRM');
    return handleConfirm(chatId, session.data, username);
  }

  const cmd = text.split(' ')[0].toLowerCase();

  if (cmd === '/start' || cmd === '/help') return handleHelp(chatId);
  if (cmd === '/app' || text === '📊 Sales App') return handleOpenApp(chatId);
  if (cmd === '/cancel') {
    await clearSession(chatId);
    return sendTelegramMessage(chatId, '\u274c Quotation cancelled.', 'Markdown', JSON.stringify({ remove_keyboard: true }));
  }
  if (cmd === '/status') return handleStatus(chatId);
  if (cmd === '/newquote') return handleNewQuote(chatId, username);
  if (cmd === '/search') return handleSearch(chatId, text.slice(7).trim(), state);
  if (cmd === '/done' && state === 'COLLECTING_ITEMS') return handleDone(chatId, session!);
  if (cmd === '/confirm' && state === 'AWAITING_CONFIRM') return handleConfirm(chatId, session!.data, username);
  if (cmd === '/add' && (state === 'COLLECTING_ITEMS' || state === 'AWAITING_CONFIRM')) return handleManualItemInput(chatId, text.slice(4).trim(), state);

  switch (state) {
    case 'AWAITING_TAX_TYPE':   return handleTaxTypeInput(chatId, text);
    case 'AWAITING_COMPANY':    return handleCompanyInput(chatId, text);
    case 'AWAITING_CONTACT':    return handleContactInput(chatId, text, session!.data);
    case 'EDITING_FIELD':       return handleFieldEdit(chatId, text, session!.data);
    case 'EDITING_ITEM_VALUE':  return handleItemValueUpdate(chatId, text, session!.data);
    case 'REVIEWING_CUSTOMER':
      await sendTelegramMessage(chatId, 'Please use the buttons above to edit or continue.');
      return;
    case 'COLLECTING_ITEMS':
      if (!text.includes(' ') && !text.includes('|') && text.length > 2) return handleSearch(chatId, text, state);
      return handleItemInput(chatId, text, session!.data);
    default:
      await sendTelegramMessage(chatId, 'Send /newquote to start a quotation, or /help for all commands.', 'none');
  }
}

async function getAppUrl(): Promise<string> {
  // Production: stable domain, always preferred
  const prod = process.env.NEXT_PUBLIC_SITE_URL;
  if (prod && !prod.includes('localhost') && !prod.includes('trycloudflare')) {
    return prod.replace(/\/$/, '');
  }

  // Dev: read the .cloudflared-url file FRESH every call
  // (process.env.APP_URL is stale after a restart — file is always current)
  try {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const filePath = resolve(process.cwd(), '.cloudflared-url');
    const content = readFileSync(filePath, 'utf-8').trim();
    const match = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) return match[0];
  } catch {}

  // Fallback to env (may be stale but better than nothing)
  const envUrl = process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  return 'https://localhost:3000';
}

async function handleHelp(chatId: number) {
  const appUrl = await getAppUrl();
  await sendTelegramMessage(chatId, [
    '*Quotation Bot \u2014 Commands*', '',
    '/newquote \u2014 Start a new quotation',
    '/app \u2014 Open Sales Documents app',
    '/search <query> \u2014 Search pricelist',
    '/add <Model> | <Desc> | <Qty> | <Price> \u2014 Add custom item',
    '/done \u2014 Finish adding items and review',
    '/confirm \u2014 Save the quotation',
    '/cancel \u2014 Cancel and clear current session',
    '/status \u2014 Show current session state',
  ].join('\n'),
  'Markdown',
  JSON.stringify({
    inline_keyboard: [[
      { text: '\ud83d\udcca Open Sales App', web_app: { url: `${appUrl}/miniapp` } }
    ]]
  }));
}

async function handleOpenApp(chatId: number) {
  const appUrl = await getAppUrl();
  await sendTelegramMessage(
    chatId,
    '📊 *Sales Documents App*\n\n⚠️ _Each /app call gives a fresh link. If the button fails, send /app again._',
    'Markdown',
    JSON.stringify({
      inline_keyboard: [[
        { text: '📂 Open Sales Documents', web_app: { url: `${appUrl}/miniapp` } }
      ]]
    })
  );
}

async function handleStatus(chatId: number) {
  const session = await getSession(chatId);
  if (!session || session.state === 'IDLE') {
    return sendTelegramMessage(chatId, 'No active session. Send /newquote to start.', 'none');
  }
  await sendTelegramMessage(chatId,
    `*Session status:* ${session.state}\n` +
    `Company: ${session.data.companyName ?? '\u2014'}\n` +
    `Contact: ${session.data.contactName ?? '\u2014'}\n` +
    `Items: ${session.data.items?.length ?? 0}`
  );
}

async function handleNewQuote(chatId: number, username: string) {
  await clearSession(chatId);
  const today = new Date().toISOString().split('T')[0];
  const vDate = new Date(); vDate.setDate(vDate.getDate() + 30);
  const validity = vDate.toISOString().split('T')[0];

  await createSession(chatId, {
    state: 'AWAITING_TAX_TYPE',
    data: { items: [], currency: 'USD', createdBy: `telegram:${username}`, quoteDate: today, validityDate: validity },
  });

  await sendTelegramMessage(chatId, '\ud83c\udd95 *Starting New Quotation*\n\nPlease select the Tax Type:', 'Markdown',
    JSON.stringify({ inline_keyboard: [[{ text: 'VAT (10%)', callback_data: 'TAX:VAT' }, { text: 'NON-VAT', callback_data: 'TAX:NON-VAT' }]] })
  );
}

async function handleTaxTypeInput(chatId: number, text: string) {
  const type = text.toUpperCase().includes('NON-VAT') ? 'NON-VAT' : 'VAT';
  await advanceSession(chatId, 'AWAITING_COMPANY', { taxType: type as 'VAT' | 'NON-VAT' });
  await sendTelegramMessage(chatId, `Tax Type set to *${type}*.\n\nEnter the company name:`);
}

async function handleCallback(chatId: number, data: string, username: string) {
  if (data.startsWith('TAX:')) {
    const taxType = data.split(':')[1] as 'VAT' | 'NON-VAT';
    await advanceSession(chatId, 'AWAITING_COMPANY', { taxType });
    return sendTelegramMessage(chatId, `Tax Type set to *${taxType}*.\n\nEnter the company name:`);
  }

  if (data.startsWith('COMP:')) {
    const idx = parseInt(data.split(':')[1], 10);
    const session = await getSession(chatId);
    const name = session?.data.companyCandidates?.[idx];
    if (!name) return sendTelegramMessage(chatId, '\u26a0\ufe0f Selection expired. Please type the company name again.');
    return confirmCompany(chatId, name);
  }

  if (data.startsWith('CONT:')) {
    const idx = parseInt(data.split(':')[1], 10);
    const session = await getSession(chatId);
    const companyName = session?.data.companyName;
    const candidates = session?.data.contactCandidates;
    if (!companyName) return sendTelegramMessage(chatId, '\u26a0\ufe0f Session lost. Please start over with /newquote.');
    if (!isNaN(idx) && candidates?.[idx]) {
      const c = candidates[idx];
      return confirmContact(chatId, { Name: c.name, 'Tel (1)': c.phone, Position: c.position });
    }
    const contacts = await getContactsForCompany(companyName);
    const contact = contacts.find(c => c.Name === data.substring(5));
    if (contact) return confirmContact(chatId, contact);
    const patch = { contactName: data.substring(5) };
    await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
    return showCustomerReview(chatId, { ...session!.data, ...patch });
  }

  if (data.startsWith('DELETE_ITEM:')) {
    const idx = parseInt(data.split(':')[1], 10);
    const session = await getSession(chatId);
    if (!session?.data.items) return;
    const items = [...session.data.items];
    const removed = items.splice(idx, 1)[0];
    await advanceSession(chatId, 'COLLECTING_ITEMS', { items });
    return sendTelegramMessage(chatId, `\ud83d\uddd1\ufe0f Removed: *${removed.modelName || removed.itemCode}*`);
  }

  if (data === 'BACK_TO_REVIEW') {
    const session = await getSession(chatId);
    await advanceSession(chatId, 'REVIEWING_CUSTOMER', { editingField: undefined });
    return showCustomerReview(chatId, session!.data);
  }

  if (data === 'BACK_TO_ITEMS') {
    await advanceSession(chatId, 'COLLECTING_ITEMS', { editingItemIdx: undefined, editingItemValueType: undefined });
    return sendTelegramMessage(chatId, '\ud83d\udd19 Back to item collection.');
  }

  if (data.startsWith('EDIT_ITEM_QTY:')) {
    const idx = parseInt(data.split(':')[1], 10);
    await advanceSession(chatId, 'EDITING_ITEM_VALUE', { editingItemIdx: idx, editingItemValueType: 'qty' });
    return sendTelegramMessage(chatId, `Enter the new *Quantity* for item #${idx + 1}:`, 'Markdown',
      JSON.stringify({ inline_keyboard: [[{ text: '\ud83d\udd19 Back', callback_data: 'BACK_TO_ITEMS' }]] }));
  }

  if (data.startsWith('EDIT_ITEM_PRICE:')) {
    const idx = parseInt(data.split(':')[1], 10);
    await advanceSession(chatId, 'EDITING_ITEM_VALUE', { editingItemIdx: idx, editingItemValueType: 'price' });
    return sendTelegramMessage(chatId, `Enter the new *Unit Price* for item #${idx + 1}:`, 'Markdown',
      JSON.stringify({ inline_keyboard: [[{ text: '\ud83d\udd19 Back', callback_data: 'BACK_TO_ITEMS' }]] }));
  }

  if (data.startsWith('EDIT:')) {
    const field = data.split(':')[1];
    if (field === 'RESELECT_CONTACT') {
      const session = await getSession(chatId);
      const companyName = session?.data.companyName;
      if (!companyName) return;
      const contacts = await getContactsForCompany(companyName);
      const contactCandidates = contacts.map(c => ({
        name: c.Name, position: c.Position || 'Contact', phone: c['Tel (1)'] || c.Phone || '',
      }));
      await advanceSession(chatId, 'AWAITING_CONTACT', { contactCandidates });
      const keyboard = { inline_keyboard: contactCandidates.map((c, idx) => ([{ text: `\ud83d\udc64 ${c.name} (${c.position})`, callback_data: `CONT:${idx}` }])) };
      return sendTelegramMessage(chatId, `Who is the *Contact Person* for ${companyName}?`, 'Markdown', JSON.stringify(keyboard));
    }
    await advanceSession(chatId, 'EDITING_FIELD', { editingField: field as any });
    const labels: any = { companyAddress: 'Address', paymentTerm: 'Payment Term', quoteDate: 'Quote Date', validityDate: 'Validity Date' };
    return sendTelegramMessage(chatId, `Please enter the new *${labels[field] || field}*:`, 'Markdown',
      JSON.stringify({ inline_keyboard: [[{ text: '\ud83d\udd19 Back', callback_data: 'BACK_TO_REVIEW' }]] }));
  }

  if (data.startsWith('ADD:')) {
    const code = data.split(':')[1];
    return handleItemInput(chatId, `${code} 1`, (await getSession(chatId))!.data);
  }

  if (data === 'CUSTOMER_OK') return advanceToItemCollection(chatId);
}

async function handleCompanyInput(chatId: number, text: string) {
  const allNames = await getAllCompanyNames();
  const matches = matchCompanies(text, allNames);
  if (matches.length === 0) {
    return sendTelegramMessage(chatId, `\u274c No companies found matching *"${text}"*.\n\nTry a different keyword:`);
  }
  await advanceSession(chatId, 'AWAITING_COMPANY', { companyCandidates: matches });
  const keyboard = { inline_keyboard: matches.map((name, idx) => ([{ text: `\ud83c\udfe2 ${name}`, callback_data: `COMP:${idx}` }])) };
  await sendTelegramMessage(chatId, `\ud83d\udd0d *Found ${matches.length} matching companies:*\n\nPlease select one:`, 'Markdown', JSON.stringify(keyboard));
}

async function confirmCompany(chatId: number, companyName: string) {
  const session = await getSession(chatId);
  const company = await getCompanyByName(companyName);
  if (!company) return;
  const contacts = await getContactsForCompany(companyName);
  const contactCandidates = contacts.map(c => ({
    name: c.Name, position: c.Position || 'Contact', phone: c['Tel (1)'] || c.Phone || '',
  }));
  const patch = {
    companyName: company['Company Name'],
    companyAddress: company['Address (English)'] || company.Address || '',
    paymentTerm: company['Payment Term'],
    companyCandidates: undefined,
    contactCandidates,
  };
  if (contacts.length === 0) {
    await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
    return showCustomerReview(chatId, { ...session!.data, ...patch });
  }
  await advanceSession(chatId, 'AWAITING_CONTACT', patch);
  const keyboard = { inline_keyboard: contactCandidates.map((c, idx) => ([{ text: `\ud83d\udc64 ${c.name} (${c.position})`, callback_data: `CONT:${idx}` }])) };
  await sendTelegramMessage(chatId, `\ud83c\udfe2 Selected: *${companyName}*\n\nWho is the *Contact Person*?`, 'Markdown', JSON.stringify(keyboard));
}

async function handleContactInput(chatId: number, text: string, data: TgSessionData) {
  const contacts = await getContactsForCompany(data.companyName!);
  const match = contacts.find(c => c.Name.toLowerCase() === text.toLowerCase());
  if (match) return confirmContact(chatId, match);
  await sendTelegramMessage(chatId, '\u2753 Contact not recognized. Please use the buttons or type the full name.');
}

async function confirmContact(chatId: number, contact: any) {
  const patch = { contactName: contact.Name, contactNumber: contact['Tel (1)'] || contact.Phone || contact.Email || '' };
  await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
  const session = await getSession(chatId);
  await showCustomerReview(chatId, session!.data);
}

async function showCustomerReview(chatId: number, data: TgSessionData) {
  const text =
    `\ud83d\udccb *Customer Info Review*\n\n` +
    `\ud83c\udfe2 *Company:* ${data.companyName}\n` +
    `\ud83d\udccd *Address:* ${data.companyAddress || '_None_'}\n` +
    `\ud83d\udc64 *Contact:* ${data.contactName || '_None_'}\n` +
    `\ud83d\udcde *Number:* ${data.contactNumber || '_None_'}\n` +
    `\ud83d\udcb3 *Payment:* ${data.paymentTerm || '_None_'}\n` +
    `\ud83d\udcc5 *Date:* ${data.quoteDate}\n` +
    `\u23f3 *Validity:* ${data.validityDate}\n` +
    `\ud83d\udcf1 *Tax:* ${data.taxType}\n\n` +
    `_Everything correct? Click a button to edit or Continue._`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '\ud83d\udccd Edit Address', callback_data: 'EDIT:companyAddress' }, { text: '\ud83d\udcb3 Edit Payment', callback_data: 'EDIT:paymentTerm' }],
      [{ text: '\ud83d\udcc5 Edit Date', callback_data: 'EDIT:quoteDate' }, { text: '\u23f3 Edit Validity', callback_data: 'EDIT:validityDate' }],
      [{ text: '\ud83d\udc64 Change Contact', callback_data: 'EDIT:RESELECT_CONTACT' }],
      [{ text: '\u2705 Looks Good - Continue', callback_data: 'CUSTOMER_OK' }],
    ],
  };
  await sendTelegramMessage(chatId, text, 'Markdown', JSON.stringify(keyboard));
}

async function handleFieldEdit(chatId: number, text: string, data: TgSessionData) {
  const field = data.editingField;
  if (!field) return;
  const patch: any = { [field]: text, editingField: null };
  await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
  const updated = await getSession(chatId);
  const labels: any = { companyAddress: 'Address', paymentTerm: 'Payment Term', quoteDate: 'Quote Date', validityDate: 'Validity Date' };
  await sendTelegramMessage(chatId, `\u2705 *${labels[field] || field}* updated!`);
  await showCustomerReview(chatId, updated!.data);
}

async function advanceToItemCollection(chatId: number, patch: Partial<TgSessionData> = {}) {
  await advanceSession(chatId, 'COLLECTING_ITEMS', patch);
  const replyMarkup = {
    keyboard: [[{ text: '\ud83d\udd0d Search Item' }, { text: '\ud83d\udcdd Manual Add' }], [{ text: '\ud83d\udccb View Summary' }, { text: '\u2705 Finish & Confirm' }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
  await sendTelegramMessage(chatId,
    `\u2705 *Setup Complete!*\n\nYou can now start adding items to the quote.\n\n` +
    `\u2022 Use the menu below\n\u2022 Or type \`CODE qty\` (e.g. \`HP-X360 2\`)`,
    'Markdown', JSON.stringify(replyMarkup));
}

async function handleItemInput(chatId: number, text: string, data: TgSessionData) {
  const parsed = parseItemInput(text);
  if (!parsed) {
    if (text.includes('|') || text.includes('\n')) return handleManualItemInput(chatId, text, 'COLLECTING_ITEMS');
    return sendTelegramMessage(chatId,
      `\u2753 *Format not recognized.*\n\n` +
      `\u2022 Use: \`CODE qty\`  (e.g. \`HP-X360 2\`)\n` +
      `\u2022 Or: \`Model | Description | Qty | Price\`\n` +
      `\u2022 Or /search <keyword> to find codes.`);
  }
  const pricelistItem = await lookupPricelistItem(parsed.code);
  if (!pricelistItem) {
    const suggestions = await searchPricelist(parsed.code);
    if (suggestions.length > 0) return sendTelegramMessage(chatId, `\u274c Code *${parsed.code}* not found. Did you mean:\n\n` + formatPricelistResults(suggestions));
    return sendTelegramMessage(chatId, `\u274c Item code *${parsed.code}* not found in pricelist.\nUse /search <keyword> to find the correct code.`);
  }
  const unitPrice = parseFloat(String(pricelistItem['End User Price'])) || 0;
  const amount = unitPrice * parsed.qty;
  const symbol = data.currency === 'KHR' ? '\u17db' : '$';
  await addItemToSession(chatId, { itemCode: pricelistItem.Code, modelName: pricelistItem['Model'] ?? '', description: pricelistItem['Description'] ?? '', qty: parsed.qty, unitPrice, amount });
  const session = await getSession(chatId);
  const items = session?.data.items ?? [];
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);
  const keyboard = { inline_keyboard: [
    [{ text: '\u270f\ufe0f Edit Qty', callback_data: `EDIT_ITEM_QTY:${items.length - 1}` }, { text: '\ud83d\udcb0 Edit Price', callback_data: `EDIT_ITEM_PRICE:${items.length - 1}` }],
    [{ text: '\ud83d\uddd1\ufe0f Delete Item', callback_data: `DELETE_ITEM:${items.length - 1}` }],
  ]};
  await sendTelegramMessage(chatId,
    `\u2705 Added: *${pricelistItem['Model']}*\n${parsed.qty} \u00d7 ${symbol}${unitPrice.toLocaleString()} = *${symbol}${amount.toLocaleString()}*\n\nRunning total: ${symbol}${runningTotal.toLocaleString()} (${items.length} items)\n\nAdd more, or click above to edit.`,
    'Markdown', JSON.stringify(keyboard));
}

async function handleItemValueUpdate(chatId: number, text: string, data: TgSessionData) {
  const idx = data.editingItemIdx;
  const type = data.editingItemValueType;
  if (idx === undefined || !type || !data.items) return;
  const items = [...data.items];
  const item = { ...items[idx] };
  const val = parseFloat(text.replace(/[^0-9.]/g, ''));
  if (isNaN(val)) return sendTelegramMessage(chatId, '\u274c Please enter a valid number.');
  if (type === 'qty') item.qty = Math.max(1, Math.round(val));
  else item.unitPrice = val;
  item.amount = item.qty * item.unitPrice;
  items[idx] = item;
  await advanceSession(chatId, 'COLLECTING_ITEMS', { items, editingItemIdx: undefined, editingItemValueType: undefined });
  const symbol = data.currency === 'KHR' ? '\u17db' : '$';
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);
  await sendTelegramMessage(chatId,
    `\u2705 Updated #${idx + 1}: *${item.modelName}*\n${item.qty} \u00d7 ${symbol}${item.unitPrice.toLocaleString()} = *${symbol}${item.amount.toLocaleString()}*\n\nNew total: ${symbol}${runningTotal.toLocaleString()}`);
}

async function handleManualItemInput(chatId: number, text: string, state: string) {
  if (!text) return sendTelegramMessage(chatId, `*Manual Item Entry*\n\nUsage: \`/add Model | Description | Qty | Price\`\n\nExample:\n\`/add Generic Laptop | i5 8GB | 2 | 450\``);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return sendTelegramMessage(chatId, `\u274c Invalid format. Use new lines:\n\nModel\nDescription\nQty Price`);
  const lastLine = lines[lines.length - 1];
  const allNumbers = (lastLine.match(/[\d,.]+/g) ?? []).map(n => n.replace(/,/g, ''));
  const qty = parseInt(allNumbers[0] || '', 10);
  const price = parseFloat(allNumbers[allNumbers.length - 1] || '');
  if (isNaN(qty) || isNaN(price) || allNumbers.length < 2) {
    return sendTelegramMessage(chatId, `\u274c Could not find Qty and Price on the last line: "${lastLine}"\n\nMake sure last line is two numbers like: \`1 4889\``);
  }
  let itemCode = 'CUSTOM', modelName = '', description = '';
  if (lines.length === 2) { modelName = lines[0]; }
  else if (lines.length === 3) { itemCode = lines[0]; modelName = lines[1]; }
  else { itemCode = lines[0]; modelName = lines[1]; description = lines.slice(2, -1).join('\n'); }
  if (price <= 0) return sendTelegramMessage(chatId, `\u274c Invalid price: "${lastLine}"`);
  const session = await getSession(chatId);
  const symbol = session?.data.currency === 'KHR' ? '\u17db' : '$';
  const amount = qty * price;
  await addItemToSession(chatId, { itemCode, modelName, description, qty, unitPrice: price, amount });
  if (state === 'AWAITING_CONFIRM') await advanceSession(chatId, 'COLLECTING_ITEMS');
  const updated = await getSession(chatId);
  const items = updated?.data.items ?? [];
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);
  const keyboard = { inline_keyboard: [
    [{ text: '\u270f\ufe0f Edit Qty', callback_data: `EDIT_ITEM_QTY:${items.length - 1}` }, { text: '\ud83d\udcb0 Edit Price', callback_data: `EDIT_ITEM_PRICE:${items.length - 1}` }],
    [{ text: '\ud83d\uddd1\ufe0f Delete Item', callback_data: `DELETE_ITEM:${items.length - 1}` }],
  ]};
  await sendTelegramMessage(chatId,
    `\u2705 Added Custom: *${modelName}*\n${qty} \u00d7 ${symbol}${price.toLocaleString()} = *${symbol}${amount.toLocaleString()}*\n\nRunning total: ${symbol}${runningTotal.toLocaleString()} (${items.length} items)\n\nAdd more, or click above to edit.`,
    'Markdown', JSON.stringify(keyboard));
}

async function handleSearch(chatId: number, query: string, state: string) {
  if (!query) return sendTelegramMessage(chatId, '\ud83d\udd0d *Search*\n\nPlease type a keyword (e.g. `ASUS` or `Laptop`):');
  const results = await searchPricelist(query);
  const { text, keyboard } = formatPricelistResults(results);
  await sendTelegramMessage(chatId, text, 'Markdown', keyboard ? JSON.stringify(keyboard) : undefined);
}

async function handleDone(chatId: number, session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return;
  const items = session.data.items ?? [];
  if (items.length === 0) return sendTelegramMessage(chatId, `\u26a0\ufe0f No items added yet.\n\nUse \`CODE qty\` to add items, or /cancel to quit.`);
  await advanceSession(chatId, 'AWAITING_CONFIRM');
  await sendTelegramMessage(chatId, formatSessionSummary(session));
}

async function handleConfirm(chatId: number, data: TgSessionData, username: string) {
  await sendTelegramMessage(chatId, '\u23f3 Saving quotation...', 'none');

  // Step 1: Save to Supabase
  let quoteNo: string;
  try {
    quoteNo = await saveQuotationFromSession(data);
    await clearSession(chatId);
  } catch (err: any) {
    console.error('[handleConfirm] Save error:', err);
    await sendTelegramMessage(chatId, `\u274c Failed to save quotation: ${err.message}`, 'none');
    return;
  }

  // Step 2: Confirm save — user knows it's safe
  const subTotal = (data.items ?? []).reduce((s, i) => s + i.amount, 0);
  const vat = data.taxType === 'NON-VAT' ? 0 : subTotal * 0.1;
  const grandTotal = subTotal + vat;
  const sym = data.currency === 'KHR' ? '\u17db' : '$';

  await sendTelegramMessage(chatId,
    `\u2705 *Quotation saved!*\n\n` +
    `Quote No: *${quoteNo}*\n` +
    `Company: ${data.companyName}\n` +
    `Total: *${sym}${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}*\n\n` +
    `\u23f3 Generating PDF...`
  );

  // Step 3: Generate and send PDF (non-fatal)
  try {
    const pdfBuffer = await generateQuotationPDF(data, quoteNo);
    await sendTelegramDocument(chatId, pdfBuffer, `${quoteNo}.pdf`,
      `\ud83d\udcc4 *${quoteNo}.pdf*\nView in CRM under Quotations \u2192 ${quoteNo}`);
  } catch (err: any) {
    console.error('[handleConfirm] PDF error:', err);
    await sendTelegramMessage(chatId,
      `\u26a0\ufe0f PDF generation failed: ${err.message}\n\nYour quotation *${quoteNo}* is saved. Download the PDF from the CRM.`,
      'Markdown');
  }
}
