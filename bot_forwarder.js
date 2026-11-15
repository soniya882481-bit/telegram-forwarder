/**
 * 📦 COMMERCIAL TELEGRAM AUTO-FORWARDER PRO (ULTRA-FAST SAAS EDITION)
 * 24/7 Cloud Engine on Render
 * 
 * ⚡ SUB-SECOND SPEED (< 1.5s): Powered by Telegram MTProto Socket Push Events (NewMessage)
 * 🔘 1-CLICK PICKER: Lists all joined channels as interactive inline buttons (Zero typing!)
 * 💡 SMART STREAMING (Idea C): Instant server-to-server zero-download forward or fast RAM buffer
 * 💡 LINK & TEXT REPLACER (Idea A): Auto-replace old links/handles with customer's own branding
 * 💡 FILE / PDF RENAMER (Idea B): Automatically brand document filenames
 * 🚫 NEGATIVE KEYWORD FILTER: Skips posts containing blocked words (VIP, Promo, etc.)
 * 🧹 IDENTITY STRIPPER: 100% deletes source handles & invite links
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');

// 🔑 CONFIGURATION
const BOT_TOKEN = process.env.FORWARDER_BOT_TOKEN || process.env.BOT_TOKEN || '8987351075:AAGpaJfAru2pxL4lfgQ6jD7lfwMnP3Itah4';
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'customers.json');

// Telegram Developer Credentials
const API_ID = 39052612;
const API_HASH = 'cda928c55ec94af1f0121b37b40a923a';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚡ ULTRA-FAST COMMERCIAL TELEGRAM FORWARDER ACTIVE ⚡');
console.log('🚀 Sub-Second Event-Driven Engine (< 1.5s Latency)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Health-check HTTP Server for 24/7 Cloud (Render / UptimeRobot)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telegram Auto-Forwarder Bot is LIVE 24/7 (Ultra-Fast Edition)!\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Keep-Alive Web Server active on port ${PORT}`);
});

// 2. Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 3. Persistent Database
let db = {};
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    db = {};
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving DB:', e.message);
  }
}

// Memory tracking
const userSessions = {};
const userAuthStore = {};
const activeUserClients = {};
const activeEventHandlers = {};
const processedMsgCache = new Set(); // Anti-duplicate tracker

// Clean channel handle
function cleanChannelHandle(input) {
  if (!input) return '';
  return input.trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .trim();
}

// 100% Identity Stripper + Replacer (Idea A) + Custom Footer
function cleanAndBrandText(rawText, removeLinks, footer, replaceRules) {
  let text = rawText || '';

  // 1. Link & Text Replacer (Idea A)
  if (replaceRules && text) {
    const rules = replaceRules.split('\n');
    for (const rule of rules) {
      if (rule.includes('=>')) {
        const [oldVal, newVal] = rule.split('=>').map(s => s.trim());
        if (oldVal) {
          text = text.split(oldVal).join(newVal);
        }
      }
    }
  }

  // 2. Strip source identity (watermarks)
  if (removeLinks && text) {
    text = text.replace(/@[a-zA-Z0-9_]+/g, '');
    text = text.replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\/[^\s]+/gi, '');
    text = text.replace(/t\.me\/[^\s]+/gi, '');
    text = text.replace(/https?:\/\/[^\s]+/gi, '');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
  }

  // 3. Attach custom footer branding
  if (footer) {
    text = text ? `${text}\n\n━━━━━━━━━━━━━━━━━━━━\n${footer.trim()}` : footer.trim();
  }

  return text.trim();
}

// Check Blocklist (Negative Keywords)
function isPostBlocked(text, docTitle, blocklist) {
  if (!blocklist) return false;
  const blockedWords = blocklist.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  if (blockedWords.length === 0) return false;

  const combined = `${text || ''} ${docTitle || ''}`.toLowerCase();
  return blockedWords.some(bw => combined.includes(bw));
}

// 4. Initialize or Get Userbot Client with Real-Time Event Listener
async function getUserClient(userId) {
  const u = db[userId];
  if (!u || !u.sessionString) return null;

  if (activeUserClients[userId]) {
    return activeUserClients[userId];
  }

  try {
    const client = new TelegramClient(new StringSession(u.sessionString), API_ID, API_HASH, {
      connectionRetries: 5,
    });
    await client.connect();
    activeUserClients[userId] = client;

    // Attach Instant Push Listener (< 1s speed)
    attachRealTimeListener(userId, client);

    return client;
  } catch (e) {
    console.error(`Userbot init failed for ${userId}:`, e.message);
    return null;
  }
}

// ⚡ 5. REAL-TIME SUB-SECOND PUSH EVENT ENGINE (< 1.5s LATENCY)
function attachRealTimeListener(userId, client) {
  if (activeEventHandlers[userId]) return;

  client.addEventHandler(async (event) => {
    const u = db[userId];
    if (!u || !u.isActive || u.source === 'Not Set' || u.destination === 'Not Set') return;

    const message = event.message;
    if (!message) return;

    // Fast deduplication
    const msgKey = `${message.chatId}_${message.id}`;
    if (processedMsgCache.has(msgKey)) return;
    processedMsgCache.add(msgKey);
    if (processedMsgCache.size > 2000) {
      const first = processedMsgCache.values().next().value;
      processedMsgCache.delete(first);
    }

    try {
      // Check if message belongs to the configured source channel
      const sourceEntity = await client.getEntity(u.source);
      if (String(message.chatId) !== String(sourceEntity.id) && String(message.chatId) !== String(sourceEntity.chatId)) {
        return; // Message from different chat
      }

      const postText = message.message || '';
      const docName = (message.file && message.file.name) ? message.file.name : '';

      // 1. Negative Keyword Filter (Blocklist)
      if (isPostBlocked(postText, docName, u.blocklist)) {
        console.log(`[INSTANT BLOCKED]: Post ${message.id} contains blocked keyword.`);
        return;
      }

      // 2. Inclusion Keyword Filter
      if (u.keyword) {
        const kw = u.keyword.toLowerCase();
        if (!postText.toLowerCase().includes(kw) && !docName.toLowerCase().includes(kw)) return;
      }

      // 3. Media Type Filter
      if (u.filterType === 'PDF_ONLY') {
        const isPdf = message.document && (message.document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf'));
        if (!isPdf) return;
      } else if (u.filterType === 'VIDEO_ONLY') {
        if (!message.video) return;
      }

      // 4. Clean Text + Replacements + Footer
      const cleanText = cleanAndBrandText(postText, u.removeLinks, u.footer, u.replaceRules);

      // ⚡ 5. SMART ZERO-DELAY DISPATCH (Idea C)
      const startTime = Date.now();

      // Case A: No media / pure text
      if (!message.media) {
        await client.sendMessage(u.destination, { message: cleanText });
        console.log(`⚡ [INSTANT TEXT SENT in ${Date.now() - startTime}ms]: Post ${message.id} to ${u.destination}`);
        return;
      }

      // Case B: Media post (Smart Streaming)
      // Check if copy-protection is disabled: We can forward without author in 0.2s!
      const isProtected = message.chat && message.chat.noforwards;
      if (!isProtected && !u.pdfPrefix && !u.removeLinks) {
        try {
          await client.forwardMessages(u.destination, {
            messages: [message.id],
            fromPeer: message.chatId,
            dropAuthor: true
          });
          console.log(`⚡ [ZERO-DOWNLOAD STREAMED in ${Date.now() - startTime}ms]: Post ${message.id}`);
          return;
        } catch (fwdErr) {
          // Fallback to RAM buffer streaming below
        }
      }

      // Case C: RAM Buffer Streaming (Zero disk I/O, works on protected channels!)
      const buffer = await client.downloadMedia(message.media);

      // Idea B: PDF / File Auto-Renamer
      let customFilename = docName;
      if (u.pdfPrefix && docName) {
        customFilename = `${u.pdfPrefix.trim()} ${docName}`.trim();
      }

      await client.sendFile(u.destination, {
        file: buffer,
        caption: cleanText,
        attributes: customFilename && message.document ? [
          new Api.DocumentAttributeFilename({ fileName: customFilename })
        ] : (message.document ? message.document.attributes : undefined)
      });

      console.log(`⚡ [INSTANT MEDIA DELIVERED in ${Date.now() - startTime}ms]: Post ${message.id} to ${u.destination}`);
      u.lastPostId = message.id;
      saveDb();

    } catch (err) {
      console.error('Instant forward error:', err.message);
    }
  }, new NewMessage({}));

  activeEventHandlers[userId] = true;
  console.log(`🟢 Instant Push Listener activated for User: ${userId}`);
}

// 6. Format Main Customer Menu
function getMainMenu(userId) {
  if (!db[userId]) {
    db[userId] = {
      source: 'Not Set',
      destination: 'Not Set',
      removeLinks: true,
      footer: '',
      filterType: 'ALL',
      keyword: '',
      blocklist: '',
      replaceRules: '',
      pdfPrefix: '',
      isActive: false,
      lastPostId: 0,
      isUserbotConnected: false,
      sessionString: ''
    };
    saveDb();
  }

  const u = db[userId];
  const statusText = u.isActive ? '🟢 <b>RUNNING (ACTIVE - Sub-Second Engine)</b>' : '🔴 <b>PAUSED (STOPPED)</b>';
  const rmLinkText = u.removeLinks ? '✅ ON (Watermarks deleted)' : '❌ OFF';
  const filterBadge = u.filterType === 'PDF_ONLY' ? '📄 ONLY PDFs' :
                      u.filterType === 'VIDEO_ONLY' ? '🎥 ONLY VIDEOS' : '🌐 ALL MEDIA';
  const kwBadge = u.keyword ? `<code>${u.keyword}</code>` : 'None';
  const blockBadge = u.blocklist ? `<code>${u.blocklist}</code>` : 'None';
  const repBadge = u.replaceRules ? '✅ Active' : 'None';
  const pdfTag = u.pdfPrefix ? `<code>${u.pdfPrefix}</code>` : 'None';
  const privateBadge = u.isUserbotConnected ? '🟢 Connected (Ultra-Fast Event Engine)' : '⚪ Not Connected (Public Mode)';

  const text = `
🤖 <b>TELEGRAM AUTO-FORWARDER PRO PANEL</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>Status:</b> ${statusText}
📥 <b>Source Channel:</b> <code>${u.source}</code>
📤 <b>My Channel:</b> <code>${u.destination}</code>
📑 <b>Media Filter:</b> <b>${filterBadge}</b>
🔍 <b>Only Include Word:</b> ${kwBadge}
🚫 <b>Blocked Words (Skip):</b> ${blockBadge}
🔄 <b>Link/Text Replacer:</b> ${repBadge}
🏷️ <b>PDF Renamer Tag:</b> ${pdfTag}
🧹 <b>Watermark Remover:</b> ${rmLinkText}
🏷️ <b>Custom Footer:</b> <i>${u.footer || 'None'}</i>
🔐 <b>Mode:</b> ${privateBadge}
━━━━━━━━━━━━━━━━━━━━
👇 <i>Buttons par click karke settings karein:</i>
  `.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📥 1. Choose Source (1-Click List)', callback_data: 'pick_src' },
        { text: '📤 2. Choose My Channel (1-Click)', callback_data: 'pick_dst' }
      ],
      [
        { text: `📑 Media: ${filterBadge}`, callback_data: 'tog_filter' },
        { text: '🔍 Include Word', callback_data: 'set_kw' }
      ],
      [
        { text: `🚫 Block Words (Skip): ${u.blocklist ? 'SET' : 'NONE'}`, callback_data: 'set_blk' },
        { text: '🔄 Link/Text Replacer', callback_data: 'set_repl' }
      ],
      [
        { text: `🏷️ PDF Renamer: ${u.pdfPrefix ? 'SET' : 'NONE'}`, callback_data: 'set_pdf_tag' },
        { text: `🧹 Remover: ${u.removeLinks ? 'ON' : 'OFF'}`, callback_data: 'tog_lnk' }
      ],
      [
        { text: '📦 CLONE RECENT POSTS (Media + Text)', callback_data: 'clone_now' },
        { text: '📚 CLONE ALL OLD PDFs', callback_data: 'bulk_pdf' }
      ],
      [
        { text: u.isUserbotConnected ? '✅ Telegram Account Connected' : '🔐 Connect Telegram (Instant Speed)', callback_data: 'userbot_auth' }
      ],
      [
        { text: '🏷️ Set Custom Footer', callback_data: 'set_ftr' },
        { text: u.isActive ? '⏸️ PAUSE' : '▶️ START AUTO-CLONE (< 1s)', callback_data: 'tog_act' }
      ],
      [
        { text: '🔄 Refresh Status', callback_data: 'refresh' }
      ]
    ]
  };

  return { text, keyboard };
}

// 7. Bot Command & Callback Handlers
bot.onText(/\/start/, async (msg) => {
  const userId = String(msg.from.id);
  // Auto-init userbot if session exists
  if (db[userId] && db[userId].sessionString) {
    getUserClient(userId).catch(() => {});
  }
  const menu = getMainMenu(userId);
  bot.sendMessage(msg.chat.id, menu.text, {
    parse_mode: 'HTML',
    reply_markup: menu.keyboard
  });
});

bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const data = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (!db[userId]) { getMainMenu(userId); }
  const u = db[userId];

  // 🔘 1-CLICK INTERACTIVE CHANNEL PICKER (SOURCE)
  if (data === 'pick_src') {
    const client = await getUserClient(userId);
    if (!client) {
      userSessions[userId] = 'awaiting_source';
      bot.sendMessage(chatId, '📥 <b>Source Channel ka username ya link bhejo:</b>\n(Jaise: <code>@cricket_line_live</code> ya private link)\n\n<i>Tip: Saare joined channels ki button list dekhne ke liye "🔐 Connect Telegram" karein!</i>', { parse_mode: 'HTML' });
      return;
    }

    bot.sendMessage(chatId, '⏳ <i>Aapke joined channels load kiye ja rahe hain...</i>', { parse_mode: 'HTML' });
    try {
      const dialogs = await client.getDialogs({ limit: 30 });
      const channels = dialogs.filter(d => d.isChannel || d.isGroup);

      if (channels.length === 0) {
        bot.sendMessage(chatId, '⚠️ Koi joined channel nahi mila.');
        return;
      }

      const buttons = [];
      for (const ch of channels.slice(0, 10)) {
        const title = ch.title.length > 28 ? ch.title.substring(0, 25) + '...' : ch.title;
        buttons.push([{
          text: `📢 ${title}`,
          callback_data: `set_src_id_${ch.id}`
        }]);
      }
      buttons.push([{ text: '⌨️ Type Manually Instead', callback_data: 'type_src' }]);

      bot.sendMessage(chatId, '📥 <b>Jis Channel se content copy karna hai, us button par click karein:</b>', {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (e) {
      userSessions[userId] = 'awaiting_source';
      bot.sendMessage(chatId, `⚠️ Error loading channels: ${e.message}. Kripya username manually likhkar bhejein:`);
    }
    return;
  }

  // Handle selected source from button list
  if (data.startsWith('set_src_id_')) {
    const chId = data.replace('set_src_id_', '');
    u.source = chId.startsWith('-100') ? chId : `-100${chId}`;
    saveDb();
    bot.sendMessage(chatId, `✅ <b>Source Channel Set Ho Gaya:</b> <code>${u.source}</code>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(chatId, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // 🔘 1-CLICK INTERACTIVE CHANNEL PICKER (DESTINATION)
  if (data === 'pick_dst') {
    const client = await getUserClient(userId);
    if (!client) {
      userSessions[userId] = 'awaiting_dest';
      bot.sendMessage(chatId, '📤 <b>Apne Destination Channel ka username bhejo:</b>\n(Jaise: <code>@my_channel</code>)\n\n⚠️ <i>Naye Bot ko apne channel me ADMIN banana zaroori hai!</i>', { parse_mode: 'HTML' });
      return;
    }

    bot.sendMessage(chatId, '⏳ <i>Aapke channels load kiye ja rahe hain...</i>', { parse_mode: 'HTML' });
    try {
      const dialogs = await client.getDialogs({ limit: 30 });
      const myChannels = dialogs.filter(d => (d.isChannel || d.isGroup) && (d.entity.creator || (d.entity.adminRights && d.entity.adminRights.postMessages)));

      if (myChannels.length === 0) {
        userSessions[userId] = 'awaiting_dest';
        bot.sendMessage(chatId, '📤 <b>Apne Channel ka username ya ID bhejo:</b>\n(Jaise: <code>@my_channel</code>)');
        return;
      }

      const buttons = [];
      for (const ch of myChannels.slice(0, 10)) {
        const title = ch.title.length > 28 ? ch.title.substring(0, 25) + '...' : ch.title;
        buttons.push([{
          text: `📤 ${title}`,
          callback_data: `set_dst_id_${ch.id}`
        }]);
      }
      buttons.push([{ text: '⌨️ Type Manually Instead', callback_data: 'type_dst' }]);

      bot.sendMessage(chatId, '📤 <b>Apna Destination Channel chunein (Jahan post bhejna hai):</b>\n<i>(Bot ko channel me Admin banana na bhoolein)</i>', {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (e) {
      userSessions[userId] = 'awaiting_dest';
      bot.sendMessage(chatId, `Kripya apne channel ka username manually bhejein:`);
    }
    return;
  }

  // Handle selected destination from button list
  if (data.startsWith('set_dst_id_')) {
    const chId = data.replace('set_dst_id_', '');
    u.destination = chId.startsWith('-100') ? chId : `-100${chId}`;
    saveDb();
    bot.sendMessage(chatId, `✅ <b>Destination Channel Set Ho Gaya:</b> <code>${u.destination}</code>\n<i>⚠️ Make sure bot is Admin there!</i>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(chatId, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  if (data === 'type_src') {
    userSessions[userId] = 'awaiting_source';
    bot.sendMessage(chatId, '📥 <b>Source Channel ka username ya link bhejo:</b>', { parse_mode: 'HTML' });
    return;
  }
  if (data === 'type_dst') {
    userSessions[userId] = 'awaiting_dest';
    bot.sendMessage(chatId, '📤 <b>Destination Channel ka username bhejo:</b>', { parse_mode: 'HTML' });
    return;
  }

  switch (data) {
    case 'tog_filter':
      u.filterType = u.filterType === 'ALL' ? 'PDF_ONLY' :
                     u.filterType === 'PDF_ONLY' ? 'VIDEO_ONLY' : 'ALL';
      saveDb();
      const m1 = getMainMenu(userId);
      bot.editMessageText(m1.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: m1.keyboard });
      break;

    case 'set_kw':
      userSessions[userId] = 'awaiting_kw';
      bot.sendMessage(chatId, '🔍 <b>Only Include Word Bhejo:</b>\n(Sirf wahi posts aayengi jisme ye word hoga)\n\n<i>Filter hatane ke liye <code>NONE</code> likhein.</i>', { parse_mode: 'HTML' });
      break;

    case 'set_blk':
      userSessions[userId] = 'awaiting_blocklist';
      bot.sendMessage(chatId, `
🚫 <b>BLOCKED WORDS (Negative Keyword Filter):</b>
Jis message me ye words honge, wo message <b>KABHI FORWARD NAHI HOGA</b>.

👇 <b>Jo words block karne hain, comma lagakar bhejein:</b>
(Jaise: <code>Promo, VIP, Contact, Sponsor, Call, Paid</code>)

<i>Filter hatane ke liye <code>NONE</code> likhein.</i>
      `.trim(), { parse_mode: 'HTML' });
      break;

    // Idea A: Link & Text Replacer
    case 'set_repl':
      userSessions[userId] = 'awaiting_replace';
      bot.sendMessage(chatId, `
🔄 <b>LINK & TEXT REPLACER (Affiliate/Brand Swap):</b>
Source channel ke links ya text ko apne branding se badal dein.

👇 <b>Format:</b> <code>PuranaWord => NayaWord</code>
(Jaise: <code>@OldChannel => @MyChannel</code> ya <code>oldlink.com => myreferral.com</code>)

<i>Hatane ke liye <code>NONE</code> likhein.</i>
      `.trim(), { parse_mode: 'HTML' });
      break;

    // Idea B: PDF & File Renamer
    case 'set_pdf_tag':
      userSessions[userId] = 'awaiting_pdf_tag';
      bot.sendMessage(chatId, `
🏷️ <b>PDF & FILE AUTO-RENAMER TAG:</b>
Har PDF ya document file ke aage aapke channel ka branding tag lag jayega.

👇 <b>Custom Tag Bhejo:</b>
(Jaise: <code>[MyChannel]</code> ya <code>[StudyHub]</code>)

<i>Hatane ke liye <code>NONE</code> likhein.</i>
      `.trim(), { parse_mode: 'HTML' });
      break;

    case 'set_ftr':
      userSessions[userId] = 'awaiting_footer';
      bot.sendMessage(chatId, '🏷️ <b>Custom Footer/Link bhejo:</b>\n(Jaise: <code>Join our official channel: @my_channel</code>)', { parse_mode: 'HTML' });
      break;

    case 'tog_lnk':
      u.removeLinks = !u.removeLinks;
      saveDb();
      const m2 = getMainMenu(userId);
      bot.editMessageText(m2.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: m2.keyboard });
      break;

    case 'userbot_auth':
      if (u.isUserbotConnected) {
        bot.sendMessage(chatId, '✅ <b>Aapka Telegram Account pehle se connected hai!</b>\nReal-time push engine active hai.\n\n<i>Logout karne ke liye <code>LOGOUT</code> likhein.</i>', { parse_mode: 'HTML' });
        return;
      }
      userSessions[userId] = 'awaiting_phone';
      bot.sendMessage(chatId, `
🔐 <b>CONNECT TELEGRAM ACCOUNT (Super-Fast Sub-Second Engine)</b>
━━━━━━━━━━━━━━━━━━━━
Interactive 1-Click channel pickers aur < 1s instant forwarding ke liye apna number connect karein:

📱 <b>Apna Telegram Phone Number bhejein:</b>
(Country code ke sath, jaise: <code>+919876543210</code>)
      `.trim(), { parse_mode: 'HTML' });
      break;

    case 'clone_now':
      if (u.source === 'Not Set' || u.destination === 'Not Set') {
        bot.sendMessage(chatId, '⚠️ <b>Pehle Source aur Destination channel set karein!</b>', { parse_mode: 'HTML' });
        return;
      }
      bot.sendMessage(chatId, `🚀 <b>Cloning Shuru!</b> Full Photos, Videos, PDFs aur Text deliver kiye ja rahe hain...`, { parse_mode: 'HTML' });

      const userClient = await getUserClient(userId);
      if (userClient) {
        try {
          const entity = await userClient.getEntity(u.source);
          const messages = await userClient.getMessages(entity, { limit: 12 });
          let count = 0;

          for (const m of messages.reverse()) {
            if (!m.message && !m.media) continue;

            const postText = m.message || '';
            const docName = (m.file && m.file.name) ? m.file.name : '';

            if (isPostBlocked(postText, docName, u.blocklist)) continue;
            if (u.keyword) {
              const kw = u.keyword.toLowerCase();
              if (!postText.toLowerCase().includes(kw) && !docName.toLowerCase().includes(kw)) continue;
            }
            if (u.filterType === 'PDF_ONLY') {
              const isPdf = m.document && (m.document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf'));
              if (!isPdf) continue;
            } else if (u.filterType === 'VIDEO_ONLY') {
              if (!m.video) continue;
            }

            const cleanText = cleanAndBrandText(postText, u.removeLinks, u.footer, u.replaceRules);

            try {
              if (m.media) {
                const buffer = await userClient.downloadMedia(m.media);
                let customFilename = docName;
                if (u.pdfPrefix && docName) {
                  customFilename = `${u.pdfPrefix.trim()} ${docName}`.trim();
                }

                await userClient.sendFile(u.destination, {
                  file: buffer,
                  caption: cleanText,
                  attributes: customFilename && m.document ? [
                    new Api.DocumentAttributeFilename({ fileName: customFilename })
                  ] : (m.document ? m.document.attributes : undefined)
                });
              } else if (cleanText) {
                await userClient.sendMessage(u.destination, { message: cleanText });
              }
              count++;
            } catch (err) {}
            await new Promise(r => setTimeout(r, 1000));
          }

          bot.sendMessage(chatId, `🎉 <b>CLONING COMPLETE!</b> Total <b>${count} items</b> deliver ho gaye!`, { parse_mode: 'HTML' });
          return;
        } catch (e) {
          bot.sendMessage(chatId, `⚠️ Error: ${e.message}`);
        }
      }
      break;

    case 'bulk_pdf':
      if (u.source === 'Not Set' || u.destination === 'Not Set') {
        bot.sendMessage(chatId, '⚠️ <b>Pehle Source aur Destination channel set karein!</b>', { parse_mode: 'HTML' });
        return;
      }
      const bClient = await getUserClient(userId);
      if (!bClient) {
        bot.sendMessage(chatId, '⚠️ <b>Bulk PDF Cloner ke liye pehle "🔐 Connect Telegram" karein!</b>', { parse_mode: 'HTML' });
        return;
      }

      bot.sendMessage(chatId, `⏳ <b>Channel History se Saare PDFs dhoondh kar send kiye ja rahe hain...</b>`, { parse_mode: 'HTML' });

      try {
        const entity = await bClient.getEntity(u.source);
        let pdfCount = 0;

        for await (const message of bClient.iterMessages(entity, { limit: 100 })) {
          const docName = (message.file && message.file.name) ? message.file.name : '';
          const postText = message.message || '';

          if (isPostBlocked(postText, docName, u.blocklist)) continue;

          const isPdf = message.document && (
            message.document.mimeType === 'application/pdf' ||
            docName.toLowerCase().endsWith('.pdf')
          );

          if (isPdf) {
            const caption = cleanAndBrandText(postText, u.removeLinks, u.footer, u.replaceRules);
            try {
              const buffer = await bClient.downloadMedia(message.media);
              let customFilename = docName;
              if (u.pdfPrefix && docName) {
                customFilename = `${u.pdfPrefix.trim()} ${docName}`.trim();
              }

              await bClient.sendFile(u.destination, {
                file: buffer,
                caption: caption,
                attributes: customFilename && message.document ? [
                  new Api.DocumentAttributeFilename({ fileName: customFilename })
                ] : (message.document ? message.document.attributes : undefined)
              });
              pdfCount++;
              await new Promise(r => setTimeout(r, 1200));
            } catch (err) {}
          }
        }

        bot.sendMessage(chatId, `🎉 <b>BULK PDF CLONING COMPLETE!</b> Total <b>${pdfCount} PDFs</b> deliver ho gaye!`, { parse_mode: 'HTML' });
      } catch (err) {
        bot.sendMessage(chatId, `❌ Bulk Error: ${err.message}`);
      }
      break;

    case 'tog_act':
      if (u.source === 'Not Set' || u.destination === 'Not Set') {
        bot.sendMessage(chatId, '⚠️ <b>Pehle Source aur Destination channel set karein!</b>', { parse_mode: 'HTML' });
      } else {
        u.isActive = !u.isActive;
        saveDb();
        const m3 = getMainMenu(userId);
        bot.editMessageText(m3.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: m3.keyboard });

        if (u.isActive) {
          getUserClient(userId).then(c => {
            if (c) attachRealTimeListener(userId, c);
          });
        }

        const statStr = u.isActive ? '🚀 Sub-Second Auto-Cloning ON! Naye posts aate hi < 1.5s me forward honge!' : '⏸️ Forwarding Pause Kar Di Gayi Hai.';
        bot.sendMessage(chatId, `<b>${statStr}</b>`, { parse_mode: 'HTML' });
      }
      break;

    case 'refresh':
      const m4 = getMainMenu(userId);
      bot.editMessageText(m4.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: m4.keyboard });
      bot.answerCallbackQuery(query.id, { text: 'Updated!' });
      break;
  }
});

// Text Message Inputs & Interactive Authentication Handler
bot.on('message', async (msg) => {
  const userId = String(msg.from.id);
  const text = msg.text ? msg.text.trim() : '';
  if (!text || text.startsWith('/')) return;

  const session = userSessions[userId];
  const u = db[userId];

  // Logout command
  if (text.toUpperCase() === 'LOGOUT') {
    u.isUserbotConnected = false;
    u.sessionString = '';
    delete activeUserClients[userId];
    delete activeEventHandlers[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, '🚪 <b>Telegram Account Disconnected!</b>', { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // 1. Phone Input for MTProto
  if (session === 'awaiting_phone') {
    const phone = text.replace(/[\s-]/g, '');
    bot.sendMessage(msg.chat.id, '⏳ <i>Telegram ko Login Code bhejne ki request bheji ja rahi hai...</i>', { parse_mode: 'HTML' });

    try {
      const tempClient = new TelegramClient(new StringSession(''), API_ID, API_HASH, {
        connectionRetries: 5,
      });
      await tempClient.connect();

      const res = await tempClient.invoke(
        new Api.auth.SendCode({
          phoneNumber: phone,
          apiId: API_ID,
          apiHash: API_HASH,
          settings: new Api.CodeSettings({}),
        })
      );

      userAuthStore[userId] = {
        client: tempClient,
        phone: phone,
        phoneCodeHash: res.phoneCodeHash
      };

      userSessions[userId] = 'awaiting_otp';
      bot.sendMessage(msg.chat.id, `
📩 <b>Login Code Bhej Diya Gaya Hai!</b>
Aapke <b>Telegram App</b> me 5-digit ka official Login Code aaya hoga.

👇 <b>Wo Code yahan bhejein:</b>
<i>(Tip: Spaces ke sath bhi likh sakte hain, jaise: <code>1 2 3 4 5</code>)</i>
      `.trim(), { parse_mode: 'HTML' });
    } catch (err) {
      delete userSessions[userId];
      bot.sendMessage(msg.chat.id, `❌ Code bhejne me error: <b>${err.message || err.errorMessage}</b>\nDubara try karein.`);
    }
    return;
  }

  // 2. OTP Input for MTProto
  if (session === 'awaiting_otp') {
    const cleanCode = text.replace(/\s+/g, '').trim();
    const authData = userAuthStore[userId];

    if (!authData || !authData.client) {
      delete userSessions[userId];
      bot.sendMessage(msg.chat.id, '⚠️ Session expire ho gaya. Dubara "Connect Telegram" par click karein.');
      return;
    }

    bot.sendMessage(msg.chat.id, '⏳ <i>Code verify kiya ja raha hai...</i>', { parse_mode: 'HTML' });

    try {
      await authData.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: authData.phone,
          phoneCodeHash: authData.phoneCodeHash,
          phoneCode: cleanCode,
        })
      );

      const sessionString = authData.client.session.save();
      u.sessionString = sessionString;
      u.isUserbotConnected = true;
      activeUserClients[userId] = authData.client;
      delete userAuthStore[userId];
      delete userSessions[userId];
      saveDb();

      // Attach instant push listener immediately
      attachRealTimeListener(userId, authData.client);

      bot.sendMessage(msg.chat.id, `🎉 <b>SUCCESS! Telegram Connected!</b>\nAb 1-Click interactive buttons aur < 1.5s sub-second speed active ho gayi hai!`, { parse_mode: 'HTML' });
      const m = getMainMenu(userId);
      bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    } catch (err) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        userSessions[userId] = 'awaiting_2fa';
        bot.sendMessage(msg.chat.id, `🔐 <b>Two-Step Verification Detected!</b>\nApna Two-Step Password yahan bhejein:`, { parse_mode: 'HTML' });
      } else {
        bot.sendMessage(msg.chat.id, `❌ Login Error: <b>${err.message || err.errorMessage}</b>.`);
      }
    }
    return;
  }

  // 3. 2FA Password Input
  if (session === 'awaiting_2fa') {
    const authData = userAuthStore[userId];
    if (!authData || !authData.client) {
      delete userSessions[userId];
      bot.sendMessage(msg.chat.id, '⚠️ Session expire ho gaya.');
      return;
    }

    try {
      await authData.client.signInWithPassword({
        apiId: API_ID,
        apiHash: API_HASH,
        password: text,
      });

      const sessionString = authData.client.session.save();
      u.sessionString = sessionString;
      u.isUserbotConnected = true;
      activeUserClients[userId] = authData.client;
      delete userAuthStore[userId];
      delete userSessions[userId];
      saveDb();

      attachRealTimeListener(userId, authData.client);

      bot.sendMessage(msg.chat.id, `🎉 <b>SUCCESS! Connected with 2FA!</b>`, { parse_mode: 'HTML' });
      const m = getMainMenu(userId);
      bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ Password galat hai: ${err.message || err.errorMessage}.`);
    }
    return;
  }

  // 4. Blocklist Input
  if (session === 'awaiting_blocklist') {
    const blk = text.toUpperCase() === 'NONE' ? '' : text;
    u.blocklist = blk;
    delete userSessions[userId];
    saveDb();
    const blkMsg = blk ? `In words wale posts forward nahi honge: <code>${blk}</code>` : 'Blocklist hata diya gaya.';
    bot.sendMessage(msg.chat.id, `✅ <b>Blocked Words Set:</b> ${blkMsg}`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // 5. Replacer Rules Input (Idea A)
  if (session === 'awaiting_replace') {
    const repl = text.toUpperCase() === 'NONE' ? '' : text;
    u.replaceRules = repl;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Replacement Rules Set:</b>\n<code>${repl || 'None'}</code>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // 6. PDF Renamer Tag Input (Idea B)
  if (session === 'awaiting_pdf_tag') {
    const tag = text.toUpperCase() === 'NONE' ? '' : text;
    u.pdfPrefix = tag;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>PDF Renamer Tag Set:</b> <code>${tag || 'None'}</code>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // Standard Manual Inputs
  if (session === 'awaiting_source') {
    u.source = text.trim();
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Source Channel Set:</b> <code>${u.source}</code>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });

  } else if (session === 'awaiting_dest') {
    const clean = cleanChannelHandle(text);
    u.destination = clean.startsWith('-100') ? clean : `@${clean}`;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Destination Channel Set:</b> <code>${u.destination}</code>\n<i>(Make sure bot is Admin there!)</i>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });

  } else if (session === 'awaiting_kw') {
    const kw = text.toUpperCase() === 'NONE' ? '' : text;
    u.keyword = kw;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Include Keyword Set:</b> ${kw || 'None'}`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });

  } else if (session === 'awaiting_footer') {
    u.footer = text;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Custom Footer Set:</b> <i>${text}</i>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
  }
});
