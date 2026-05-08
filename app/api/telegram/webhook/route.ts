/**
 * POST /api/telegram/webhook
 * ─────────────────────────────────────────────────────────────
 * Main entry point for the Telegram quotation bot.
 *
 * Register this URL with Telegram once via:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.com/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *
 * Required env vars (already in your .env / .env.local):
 *   TELEGRAM_BOT_TOKEN          — from @BotFather
 *   SUPABASE_SERVICE_ROLE_KEY   — already present
 *   NEXT_PUBLIC_SUPABASE_URL    — already present
 *
 * Optional (recommended for production):
 *   TELEGRAM_WEBHOOK_SECRET     — random string to verify requests are from Telegram
 *
 * ── Conversation flow ────────────────────────────────────────
 *   /newquote              → ask for company name
 *   <company name>         → fuzzy match, confirm, ask for contact
 *   <contact choice>       → store, move to item collection
 *   <CODE qty>             → add item, show running total
 *   /search <query>        → search pricelist and show results
 *   /done                  → show full summary, ask to confirm
 *   /confirm               → save to Supabase, reply with Quote No.
 *   /cancel                → clear session
 *   /status                → show current session state
 * ─────────────────────────────────────────────────────────────
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

// ── Webhook secret verification ───────────────────────────────

function isValidRequest(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // Skip check if not configured (dev mode)
  const header = request.headers.get('x-telegram-bot-api-secret-token');
  return header === secret;
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Verify the request is from Telegram
  if (!isValidRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 2. Handle Callback Queries (Button clicks)
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

  // 3. Handle regular Messages
  const message = body?.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId: number = message.chat?.id;
  const text: string = (message.text ?? '').trim();
  const userId: number = message.from?.id;
  const username: string = message.from?.username ?? message.from?.first_name ?? String(userId);

  if (!chatId || !text) return NextResponse.json({ ok: true });

  // 4. Route to the right handler
  try {
    await handleMessage(chatId, text, username);
  } catch (err: any) {
    console.error('[Telegram webhook] Unhandled error:', err);
    const techMsg = `⚠️ *Technical Error:*\n\`${err.message || String(err)}\`\n\nTry /cancel to reset.`;
    await sendTelegramMessage(chatId, techMsg, 'none').catch(() => {});
  }

  // Always return 200 so Telegram doesn't retry
  return NextResponse.json({ ok: true });
}

// ── Message router ────────────────────────────────────────────

async function handleMessage(chatId: number, text: string, username: string) {
  // 1. Handle Main Menu buttons first
  if (text === '🔍 Search Item') {
    return sendTelegramMessage(chatId, '🔍 *Pricelist Search*\n\nType a keyword to search (e.g. `HP` or `MSI`):');
  }
  if (text === '📝 Manual Add') {
    return sendTelegramMessage(chatId, '📝 *Manual Item Entry*\n\nPlease enter the details in this format:\n\n`Model`\n`Description`\n`Qty Price`');
  }

  const session = await getSession(chatId);
  const state = session?.state ?? 'IDLE';

  if (text === '📋 View Summary' && session) {
    return handleDone(chatId, session);
  }
  if (text === '✅ Finish & Confirm' && session) {
    if (session.state === 'COLLECTING_ITEMS') {
      await advanceSession(chatId, 'AWAITING_CONFIRM');
    }
    return handleConfirm(chatId, session.data, username);
  }

  const cmd = text.split(' ')[0].toLowerCase();

  // Global commands — work in any state
  if (cmd === '/start' || cmd === '/help') {
    return handleHelp(chatId);
  }
  if (cmd === '/cancel') {
    await clearSession(chatId);
    return sendTelegramMessage(chatId, '❌ Quotation cancelled.', 'Markdown', JSON.stringify({ remove_keyboard: true }));
  }
  if (cmd === '/status') {
    return handleStatus(chatId);
  }
  if (cmd === '/newquote') {
    return handleNewQuote(chatId, username);
  }

  // State-dependent commands

  if (cmd === '/search') {
    return handleSearch(chatId, text.slice(7).trim(), state);
  }
  if (cmd === '/done' && state === 'COLLECTING_ITEMS') {
    return handleDone(chatId, session!);
  }
  if (cmd === '/confirm' && state === 'AWAITING_CONFIRM') {
    return handleConfirm(chatId, session!.data, username);
  }
  if (cmd === '/add' && (state === 'COLLECTING_ITEMS' || state === 'AWAITING_CONFIRM')) {
    return handleManualItemInput(chatId, text.slice(4).trim(), state);
  }


  // State-machine text handlers
  switch (state) {
    case 'AWAITING_TAX_TYPE':
      return handleTaxTypeInput(chatId, text);
    case 'AWAITING_COMPANY':
      return handleCompanyInput(chatId, text);
    case 'AWAITING_CONTACT':
      return handleContactInput(chatId, text, session!.data);
    case 'EDITING_FIELD':
      return handleFieldEdit(chatId, text, session!.data);
    case 'EDITING_ITEM_VALUE':
      return handleItemValueUpdate(chatId, text, session!.data);
    case 'REVIEWING_CUSTOMER':
      await sendTelegramMessage(chatId, "Please use the buttons above to edit or continue.");
      return;
    case 'COLLECTING_ITEMS':
      // If it's a single word and not a recognized command, try searching
      if (!text.includes(' ') && !text.includes('|') && text.length > 2) {
        return handleSearch(chatId, text, state);
      }
      return handleItemInput(chatId, text, session!.data);
    default:
      // IDLE with unknown input
      await sendTelegramMessage(
        chatId,
        `Send /newquote to start a quotation, or /help for all commands.`,
        'none'
      );
  }
}

// ── Command handlers ──────────────────────────────────────────

async function handleHelp(chatId: number) {
  await sendTelegramMessage(chatId, [
    '*Quotation Bot — Commands*',
    '',
    '/newquote — Start a new quotation',
    '/search <query> — Search pricelist (e.g. /search HP)',
    '/add <Model> | <Desc> | <Qty> | <Price> — Add custom item',
    '/done — Finish adding items and review',
    '/confirm — Save the quotation',
    '/cancel — Cancel and clear current session',
    '/status — Show current session state',
  ].join('\n'));
}

async function handleCancel(chatId: number) {
  await clearSession(chatId);
  await sendTelegramMessage(chatId, '🗑 Session cleared. Send /newquote to start again.', 'none');
}

async function handleStatus(chatId: number) {
  const session = await getSession(chatId);
  if (!session || session.state === 'IDLE') {
    return sendTelegramMessage(chatId, 'No active session. Send /newquote to start.', 'none');
  }
  const itemCount = session.data.items?.length ?? 0;
  await sendTelegramMessage(
    chatId,
    `*Session status:* ${session.state}\n` +
    `Company: ${session.data.companyName ?? '—'}\n` +
    `Contact: ${session.data.contactName ?? '—'}\n` +
    `Items: ${itemCount}`,
  );
}

async function handleNewQuote(chatId: number, username: string) {
  await clearSession(chatId);

  const today = new Date().toISOString().split('T')[0];
  const validityDate = new Date();
  validityDate.setDate(validityDate.getDate() + 30);
  const validity = validityDate.toISOString().split('T')[0];

  await createSession(chatId, {
    state: 'AWAITING_TAX_TYPE',
    data: { 
      items: [], 
      currency: 'USD', 
      createdBy: `telegram:${username}`,
      quoteDate: today,
      validityDate: validity
    },
  });

  await sendTelegramMessage(
    chatId,
    '🆕 *Starting New Quotation*\n\nPlease select the Tax Type:',
    'Markdown',
    JSON.stringify({
      inline_keyboard: [
        [
          { text: 'VAT (10%)', callback_data: 'TAX:VAT' },
          { text: 'NON-VAT', callback_data: 'TAX:NON-VAT' },
        ],
      ],
    }),
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

  // Handle other callbacks (Company selection buttons if any)
  if (data.startsWith('COMP:')) {
    const name = data.split(':')[1];
    return confirmCompany(chatId, name);
  }

  if (data.startsWith('CONT:')) {
    const name = data.substring(5);
    const session = await getSession(chatId);
    const companyName = session?.data.companyName;
    if (!companyName) {
      return sendTelegramMessage(chatId, "⚠️ Session lost. Please start over with /newquote.");
    }
    const contacts = await getContactsForCompany(companyName);
    const contact = contacts.find(c => c.Name === name);
    if (contact) {
      return confirmContact(chatId, contact);
    } else {
      const patch = { contactName: name };
      await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
      return showCustomerReview(chatId, { ...session!.data, ...patch });
    }
  }

  if (data.startsWith('DELETE_ITEM:')) {
    const idx = parseInt(data.split(':')[1], 10);
    const session = await getSession(chatId);
    if (!session?.data.items) return;
    const items = [...session.data.items];
    const removed = items.splice(idx, 1)[0];
    await advanceSession(chatId, 'COLLECTING_ITEMS', { items });
    return sendTelegramMessage(chatId, `🗑️ Removed: *${removed.modelName || removed.itemCode}*`);
  }

  if (data === 'BACK_TO_REVIEW') {
    const session = await getSession(chatId);
    await advanceSession(chatId, 'REVIEWING_CUSTOMER', { editingField: undefined });
    return showCustomerReview(chatId, session!.data);
  }

  if (data === 'BACK_TO_ITEMS') {
    await advanceSession(chatId, 'COLLECTING_ITEMS', { editingItemIdx: undefined, editingItemValueType: undefined });
    return sendTelegramMessage(chatId, "🔙 Back to item collection.");
  }

  if (data.startsWith('EDIT_ITEM_QTY:')) {
    const idx = parseInt(data.split(':')[1], 10);
    await advanceSession(chatId, 'EDITING_ITEM_VALUE', { editingItemIdx: idx, editingItemValueType: 'qty' });
    const keyboard = { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'BACK_TO_ITEMS' }]] };
    return sendTelegramMessage(chatId, `Enter the new *Quantity* for item #${idx + 1}:`, 'Markdown', JSON.stringify(keyboard));
  }

  if (data.startsWith('EDIT_ITEM_PRICE:')) {
    const idx = parseInt(data.split(':')[1], 10);
    await advanceSession(chatId, 'EDITING_ITEM_VALUE', { editingItemIdx: idx, editingItemValueType: 'price' });
    const keyboard = { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'BACK_TO_ITEMS' }]] };
    return sendTelegramMessage(chatId, `Enter the new *Unit Price* for item #${idx + 1}:`, 'Markdown', JSON.stringify(keyboard));
  }

  if (data.startsWith('EDIT:')) {
    const field = data.split(':')[1];
    if (field === 'RESELECT_CONTACT') {
      const session = await getSession(chatId);
      const companyName = session?.data.companyName;
      if (!companyName) return;
      const contacts = await getContactsForCompany(companyName);
      const keyboard = {
        inline_keyboard: [
          ...contacts.map(c => ([{ text: `👤 ${c.Name} (Contact)`, callback_data: `CONT:${c.Name}` }])),
          [{ text: '➕ Manual Contact Name', callback_data: 'CONT:MANUAL' }]
        ]
      };
      await advanceSession(chatId, 'AWAITING_CONTACT');
      return sendTelegramMessage(chatId, `Who is the *Contact Person* for ${companyName}?`, 'Markdown', JSON.stringify(keyboard));
    }

    await advanceSession(chatId, 'EDITING_FIELD', { editingField: field as any });
    const labels: any = { companyAddress: 'Address', paymentTerm: 'Payment Term', quoteDate: 'Quote Date', validityDate: 'Validity Date' };
    const keyboard = { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'BACK_TO_REVIEW' }]] };
    return sendTelegramMessage(chatId, `Please enter the new *${labels[field] || field}*:`, 'Markdown', JSON.stringify(keyboard));
  }

  if (data.startsWith('ADD:')) {
    const code = data.split(':')[1];
    return handleItemInput(chatId, `${code} 1`, (await getSession(chatId))!.data);
  }

  if (data === 'CUSTOMER_OK') {
    return advanceToItemCollection(chatId);
  }
}

async function handleCompanyInput(chatId: number, text: string) {
  const allNames = await getAllCompanyNames();
  const matches = matchCompanies(text, allNames);

  if (matches.length === 0) {
    return sendTelegramMessage(
      chatId,
      `❌ No companies found matching *"${text}"*.\n\nTry a different keyword:`,
    );
  }

  // Show as buttons
  const keyboard = {
    inline_keyboard: matches.map(name => ([
      { text: `🏢 ${name}`, callback_data: `COMP:${name}` }
    ]))
  };

  await sendTelegramMessage(
    chatId,
    `🔍 *Found ${matches.length} matching companies:*\n\nPlease select one:`,
    'Markdown',
    JSON.stringify(keyboard)
  );
}


async function confirmCompany(chatId: number, companyName: string) {
  const session = await getSession(chatId);
  const company = await getCompanyByName(companyName);
  if (!company) return;

  const contacts = await getContactsForCompany(companyName);
  
  const patch = {
    companyName: company['Company Name'],
    companyAddress: company['Address (English)'] || company.Address || '',
    paymentTerm: company['Payment Term'],
  };

  if (contacts.length === 0) {
    await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
    return showCustomerReview(chatId, { ...session!.data, ...patch });
  }

  await advanceSession(chatId, 'AWAITING_CONTACT', patch);

  // Show contacts as buttons
  const keyboard = {
    inline_keyboard: contacts.map(c => ([
      { text: `👤 ${c.Name} (${c.Position || 'Contact'})`, callback_data: `CONT:${c.Name}` }
    ]))
  };

  await sendTelegramMessage(
    chatId,
    `🏢 Selected: *${companyName}*\n\nWho is the *Contact Person*?`,
    'Markdown',
    JSON.stringify(keyboard)
  );
}

async function handleContactInput(chatId: number, text: string, data: TgSessionData) {
  // If they typed a name, try to match it
  const contacts = await getContactsForCompany(data.companyName!);
  const match = contacts.find(c => c.Name.toLowerCase() === text.toLowerCase());
  
  if (match) return confirmContact(chatId, match);
  
  await sendTelegramMessage(chatId, `❓ Contact not recognized. Please use the buttons or type the full name.`);
}

async function confirmContact(chatId: number, contact: any) {
  const patch = {
    contactName: contact.Name,
    contactNumber: contact.Phone || contact.Email || contact['Tel (1)'] || '',
  };
  await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
  const session = await getSession(chatId);
  await showCustomerReview(chatId, session!.data);
}

async function showCustomerReview(chatId: number, data: TgSessionData) {
  const text = `📋 *Customer Info Review*\n\n` +
    `🏢 *Company:* ${data.companyName}\n` +
    `📍 *Address:* ${data.companyAddress || '_None_'}\n` +
    `👤 *Contact:* ${data.contactName || '_None_'}\n` +
    `📞 *Number:* ${data.contactNumber || '_None_'}\n` +
    `💳 *Payment:* ${data.paymentTerm || '_None_'}\n` +
    `📅 *Date:* ${data.quoteDate}\n` +
    `⏳ *Validity:* ${data.validityDate}\n` +
    `📑 *Tax:* ${data.taxType}\n\n` +
    `_Everything correct? Click a button to edit or Continue._`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📍 Edit Address', callback_data: 'EDIT:companyAddress' }, { text: '💳 Edit Payment', callback_data: 'EDIT:paymentTerm' }],
      [{ text: '📅 Edit Date', callback_data: 'EDIT:quoteDate' }, { text: '⏳ Edit Validity', callback_data: 'EDIT:validityDate' }],
      [{ text: '👤 Change Contact', callback_data: 'EDIT:RESELECT_CONTACT' }],
      [{ text: '✅ Looks Good - Continue', callback_data: 'CUSTOMER_OK' }]
    ]
  };

  await sendTelegramMessage(chatId, text, 'Markdown', JSON.stringify(keyboard));
}

async function handleFieldEdit(chatId: number, text: string, data: TgSessionData) {
  const field = data.editingField;
  if (!field) return;

  const patch: any = { [field]: text, editingField: null };
  await advanceSession(chatId, 'REVIEWING_CUSTOMER', patch);
  
  const updated = await getSession(chatId);
  const labels: any = { 
    companyAddress: 'Address', 
    paymentTerm: 'Payment Term',
    quoteDate: 'Quote Date',
    validityDate: 'Validity Date'
  };
  await sendTelegramMessage(chatId, `✅ *${labels[field] || field}* updated!`);
  await showCustomerReview(chatId, updated!.data);
}

async function advanceToItemCollection(chatId: number, patch: Partial<TgSessionData> = {}) {
  await advanceSession(chatId, 'COLLECTING_ITEMS', patch);

  const replyMarkup = {
    keyboard: [
      [{ text: '🔍 Search Item' }, { text: '📝 Manual Add' }],
      [{ text: '📋 View Summary' }, { text: '✅ Finish & Confirm' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  await sendTelegramMessage(
    chatId,
    `✅ *Setup Complete!*\n\nYou can now start adding items to the quote.\n\n` +
    `• Use the menu below\n` +
    `• Or type \`CODE qty\` (e.g. \`HP-X360 2\`)`,
    'Markdown',
    JSON.stringify(replyMarkup)
  );
}

async function handleItemInput(chatId: number, text: string, data: TgSessionData) {
  // Try to parse "CODE qty" format
  const parsed = parseItemInput(text);

  if (!parsed) {
    // FALLBACK: Check if it's a manual entry (contains pipes or newlines)
    if (text.includes('|') || text.includes('\n')) {
      return handleManualItemInput(chatId, text, 'COLLECTING_ITEMS');
    }

    return sendTelegramMessage(
      chatId,
      `❓ *Format not recognized.*\n\n` +
      `• Use: \`CODE qty\`  (e.g. \`HP-X360 2\`)\n` +
      `• Or: \`Model | Description | Qty | Price\`\n` +
      `• Or /search <keyword> to find codes.`,
    );
  }

  // Look up the item in the pricelist
  const pricelistItem = await lookupPricelistItem(parsed.code);

  if (!pricelistItem) {
    // Try a search to suggest alternatives
    const suggestions = await searchPricelist(parsed.code);
    if (suggestions.length > 0) {
      return sendTelegramMessage(
        chatId,
        `❌ Code *${parsed.code}* not found. Did you mean:\n\n` +
        formatPricelistResults(suggestions),
      );
    }
    return sendTelegramMessage(
      chatId,
      `❌ Item code *${parsed.code}* not found in pricelist.\n` +
      `Use /search <keyword> to find the correct code.`,
    );
  }

  const unitPrice = parseFloat(String(pricelistItem['End User Price'])) || 0;
  const amount = unitPrice * parsed.qty;
  const symbol = data.currency === 'KHR' ? '៛' : '$';

  await addItemToSession(chatId, {
    itemCode: pricelistItem.Code,
    modelName: pricelistItem['Model'] ?? '',
    description: pricelistItem['Description'] ?? '',
    qty: parsed.qty,
    unitPrice,
    amount,
  });

  // Running total
  const session = await getSession(chatId);
  const items = session?.data.items ?? [];
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);

  const keyboard = {
    inline_keyboard: [
      [{ text: '✏️ Edit Qty', callback_data: `EDIT_ITEM_QTY:${items.length - 1}` }, { text: '💰 Edit Price', callback_data: `EDIT_ITEM_PRICE:${items.length - 1}` }],
      [{ text: '🗑️ Delete Item', callback_data: `DELETE_ITEM:${items.length - 1}` }]
    ]
  };

  await sendTelegramMessage(
    chatId,
    `✅ Added: *${pricelistItem['Model']}*\n` +
    `${parsed.qty} × ${symbol}${unitPrice.toLocaleString()} = *${symbol}${amount.toLocaleString()}*\n\n` +
    `Running total: ${symbol}${runningTotal.toLocaleString()} (${items.length} items)\n\n` +
    `Add more, or click above to edit.`,
    'Markdown',
    JSON.stringify(keyboard)
  );
}

async function handleItemValueUpdate(chatId: number, text: string, data: TgSessionData) {
  const idx = data.editingItemIdx;
  const type = data.editingItemValueType;
  if (idx === undefined || !type || !data.items) return;

  const items = [...data.items];
  const item = { ...items[idx] };
  const val = parseFloat(text.replace(/[^0-9.]/g, ''));

  if (isNaN(val)) return sendTelegramMessage(chatId, "❌ Please enter a valid number.");

  if (type === 'qty') {
    item.qty = Math.max(1, Math.round(val));
  } else {
    item.unitPrice = val;
  }
  item.amount = item.qty * item.unitPrice;
  items[idx] = item;

  await advanceSession(chatId, 'COLLECTING_ITEMS', { items, editingItemIdx: undefined, editingItemValueType: undefined });
  
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);
  const symbol = data.currency === 'KHR' ? '៛' : '$';
  
  await sendTelegramMessage(
    chatId, 
    `✅ Updated #${idx + 1}: *${item.modelName}*\n` +
    `${item.qty} × ${symbol}${item.unitPrice.toLocaleString()} = *${symbol}${item.amount.toLocaleString()}*\n\n` +
    `New total: ${symbol}${runningTotal.toLocaleString()}`
  );
}

async function handleManualItemInput(chatId: number, text: string, state: string) {
  if (!text) {
    return sendTelegramMessage(
      chatId,
      `*Manual Item Entry*\n\nUsage: \`/add Model | Description | Qty | Price\`\n\nExample:\n\`/add Generic Laptop | i5 8GB | 2 | 450\``
    );
  }

  // 1. Clean and split the text into lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  if (lines.length < 2) {
    return sendTelegramMessage(chatId, `❌ Invalid format. Use new lines:\n\nModel\nDescription\nQty Price`);
  }

  // 2. Try to find the Quantity and Price. 
  // We'll look at the last line first.
  const lastLine = lines[lines.length - 1];
  const lastLineParts = lastLine.split(/\s+/).filter(Boolean);
  
  // Extra resilient extraction: find all numbers in the last line
  const allNumbers = lastLine.match(/[\d,.]+/g)?.map(n => n.replace(/,/g, '')) || [];
  
  let qty = parseInt(allNumbers[0] || '', 10);
  let price = parseFloat(allNumbers[allNumbers.length - 1] || '');

  // 3. Validation with Debug Info
  if (isNaN(qty) || isNaN(price) || allNumbers.length < 2) {
    const debugInfo = `\n\nDebug Info:\n- Lines: ${lines.length}\n- Last line: "${lastLine}"\n- Parts found: ${lastLineParts.join(', ')}\n- Numbers found: ${allNumbers.join(', ')}`;
    
    return sendTelegramMessage(
      chatId,
      `❌ Could not find Quantity and Price on the last line.` + debugInfo +
      `\n\nMake sure your last line is just two numbers, like: \`1 4889\``
    );
  }

  // 4. Extract Code, Model, and Description based on line count
  let itemCode = 'CUSTOM';
  let modelName = '';
  let description = '';

  if (lines.length === 2) {
    // [Model] [Qty Price]
    modelName = lines[0];
  } else if (lines.length === 3) {
    // [Code] [Model] [Qty Price]
    itemCode = lines[0];
    modelName = lines[1];
  } else {
    // [Code] [Model] [Desc...] [Qty Price]
    itemCode = lines[0];
    modelName = lines[1];
    description = lines.slice(2, lines.length - 1).join('\n');
  }

  const amount = qty * price;

  if (price <= 0) {
    return sendTelegramMessage(chatId, `❌ Invalid price: "${lastLine}"`);
  }

  const session = await getSession(chatId);
  const symbol = session?.data.currency === 'KHR' ? '៛' : '$';

  await addItemToSession(chatId, {
    itemCode,
    modelName,
    description,
    qty,
    unitPrice: price,
    amount,
  });

  // Re-fetch to get updated total
  const updated = await getSession(chatId);
  const items = updated?.data.items ?? [];
  const runningTotal = items.reduce((s, i) => s + i.amount, 0);

  // If they were in AWAITING_CONFIRM, move them back to COLLECTING_ITEMS so they can see the summary again with /done
  if (state === 'AWAITING_CONFIRM') {
    await advanceSession(chatId, 'COLLECTING_ITEMS');
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '✏️ Edit Qty', callback_data: `EDIT_ITEM_QTY:${items.length - 1}` }, { text: '💰 Edit Price', callback_data: `EDIT_ITEM_PRICE:${items.length - 1}` }],
      [{ text: '🗑️ Delete Item', callback_data: `DELETE_ITEM:${items.length - 1}` }]
    ]
  };

  await sendTelegramMessage(
    chatId,
    `✅ Added Custom: *${modelName}*\n` +
    `${qty} × ${symbol}${price.toLocaleString()} = *${symbol}${amount.toLocaleString()}*\n\n` +
    `Running total: ${symbol}${runningTotal.toLocaleString()} (${items.length} items)\n\n` +
    `Add more, or click above to edit.`,
    'Markdown',
    JSON.stringify(keyboard)
  );
}

async function handleSearch(chatId: number, query: string, state: string) {
  if (!query) {
    return sendTelegramMessage(chatId, '🔍 *Search*\n\nPlease type a keyword (e.g. `ASUS` or `Laptop`):');
  }
  const results = await searchPricelist(query);
  const { text, keyboard } = formatPricelistResults(results);
  await sendTelegramMessage(chatId, text, 'Markdown', keyboard ? JSON.stringify(keyboard) : undefined);
}

async function handleDone(chatId: number, session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return;
  const items = session.data.items ?? [];

  if (items.length === 0) {
    return sendTelegramMessage(
      chatId,
      `⚠️ No items added yet.\n\nUse \`CODE qty\` to add items, or /cancel to quit.`,
    );
  }

  await advanceSession(chatId, 'AWAITING_CONFIRM');
  await sendTelegramMessage(chatId, formatSessionSummary(session));
}

async function handleConfirm(chatId: number, data: TgSessionData, username: string) {
  await sendTelegramMessage(chatId, '⏳ Saving quotation...', 'none');

  try {
    const quoteNo = await saveQuotationFromSession(data);
    await clearSession(chatId);

    // Generate and send PDF
    const pdfBuffer = await generateQuotationPDF(data, quoteNo);
    await sendTelegramDocument(
      chatId,
      pdfBuffer,
      `${quoteNo}.pdf`,
      `✅ *Quotation saved!*\n\n` +
      `Quote No: *${quoteNo}*\n` +
      `Company: ${data.companyName}\n` +
      `Amount: ${data.currency === 'KHR' ? '៛' : '$'}${
        (data.items ?? []).reduce((s, i) => s + i.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
      }\n\n` +
      `You can view it in the CRM under Quotations → ${quoteNo}`
    );
  } catch (err: any) {
    console.error('[handleConfirm] Error:', err);
    await sendTelegramMessage(chatId, '❌ Failed to save or generate PDF. Please try again.', 'none');
  }
}
