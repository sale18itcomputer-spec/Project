/**
 * auto-webhook.mjs
 * - Reads cloudflared URL from .cloudflared-url
 * - Updates NEXT_PUBLIC_SITE_URL in .env.local automatically
 * - Registers Telegram webhook
 * - Restarts Next.js dev server so the new URL is picked up
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL_FILE  = resolve(__dirname, ".cloudflared-url");
const ENV_FILE  = resolve(__dirname, ".env.local");

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------
function loadEnv(filePath) {
  try {
    const lines = readFileSync(filePath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("⚠️  Could not load .env.local");
  }
}

loadEnv(ENV_FILE);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN not found in .env.local");
  process.exit(1);
}

const WEBHOOK_PATH    = "/api/telegram/webhook";
const MAX_TRIES       = 40;
const RETRY_MS        = 1500;
const ALLOWED_UPDATES = ["message", "edited_message", "callback_query"];

// ---------------------------------------------------------------------------
// Update NEXT_PUBLIC_SITE_URL in .env.local
// ---------------------------------------------------------------------------
function updateEnvSiteUrl(tunnelUrl) {
  try {
    let content = readFileSync(ENV_FILE, "utf-8");
    // Update APP_URL (server-side, always fresh at runtime)
    if (content.includes("APP_URL=")) {
      content = content.replace(/^APP_URL=.*/m, `APP_URL=${tunnelUrl}`);
    } else {
      content += `\nAPP_URL=${tunnelUrl}\n`;
    }
    // Also update NEXT_PUBLIC_SITE_URL for auth redirects etc.
    if (content.includes("NEXT_PUBLIC_SITE_URL=")) {
      content = content.replace(/^NEXT_PUBLIC_SITE_URL=.*/m, `NEXT_PUBLIC_SITE_URL=${tunnelUrl}`);
    } else {
      content += `NEXT_PUBLIC_SITE_URL=${tunnelUrl}\n`;
    }
    writeFileSync(ENV_FILE, content, "utf-8");
    console.log(`✅ Updated .env.local → APP_URL + NEXT_PUBLIC_SITE_URL = ${tunnelUrl}`);
  } catch (err) {
    console.warn(`⚠️  Could not update .env.local: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Restart Next.js dev server
// ---------------------------------------------------------------------------
let nextProcess = null;

function startNextDev() {
  if (nextProcess) {
    console.log("🔄 Restarting Next.js to pick up new NEXT_PUBLIC_SITE_URL...");
    nextProcess.kill("SIGTERM");
  }

  console.log("🚀 Starting Next.js dev server...");
  nextProcess = spawn("npm", ["run", "dev"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
  });

  nextProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.log(`⚠️  Next.js exited with code ${code}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Poll .cloudflared-url
// ---------------------------------------------------------------------------
async function getCloudflaredUrl(attempt = 1) {
  if (existsSync(URL_FILE)) {
    const content = readFileSync(URL_FILE, "utf-8").trim();
    const match   = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) return match[0];
  }

  if (attempt >= MAX_TRIES) {
    console.error("\n❌ Cloudflared URL not found after 60s. Is cloudflared running?");
    process.exit(1);
  }

  process.stdout.write(attempt === 1 ? "⏳ Waiting for cloudflared URL" : ".");
  await new Promise(r => setTimeout(r, RETRY_MS));
  return getCloudflaredUrl(attempt + 1);
}

// ---------------------------------------------------------------------------
// Telegram helpers
// ---------------------------------------------------------------------------
async function tgFetch(method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getWebhookInfo() {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  return res.json();
}

async function registerWebhook(tunnelUrl) {
  const webhookUrl = `${tunnelUrl}${WEBHOOK_PATH}`;

  const info = await getWebhookInfo();
  if (info.ok && info.result?.url === webhookUrl) {
    console.log(`✅ Webhook already correct — skipping.`);
    console.log(`   🤖 ${webhookUrl}`);
    return;
  }

  // Retry up to 5 times with 3s delay (tunnel may take a moment to propagate)
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`📡 Registering webhook (attempt ${attempt}/5): ${webhookUrl}`);
    const data = await tgFetch("setWebhook", { url: webhookUrl, allowed_updates: ALLOWED_UPDATES });

    if (data.ok) {
      console.log(`✅ Webhook registered!`);
      console.log(`   🤖 ${webhookUrl}`);
      return;
    }

    console.error(`❌ Failed: ${data.description}`);
    if (attempt < 5) {
      console.log(`⏳ Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('❌ Could not register webhook after 5 attempts.');
}

async function deleteWebhook() {
  const data = await tgFetch("deleteWebhook");
  if (data.ok) console.log("🗑️  Webhook deleted.");
  else console.warn(`⚠️  Could not delete webhook: ${data.description}`);
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  console.log(`\n🛑 Caught ${signal} — cleaning up...`);
  await deleteWebhook();
  if (nextProcess) nextProcess.kill("SIGTERM");
  try { unlinkSync(URL_FILE); } catch {}
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const tunnelUrl = await getCloudflaredUrl();
console.log(`\n🔗 Cloudflared URL: ${tunnelUrl}`);

// 1. Update .env.local with the new URL
updateEnvSiteUrl(tunnelUrl);

// 2. Wait for tunnel to be reachable
console.log('⏳ Waiting for tunnel to be reachable...');
await new Promise(r => setTimeout(r, 5000));

// 3. Register Telegram webhook
await registerWebhook(tunnelUrl);

// 3. Only start Next.js if --with-next flag is passed
if (process.argv.includes('--with-next')) {
  startNextDev();
} else {
  console.log(`\n💡 Next.js not started (run npm run dev separately if needed)`);
}

console.log(`\n👂 Bot is live at ${tunnelUrl}\n`);

setInterval(() => {}, 1 << 30);
