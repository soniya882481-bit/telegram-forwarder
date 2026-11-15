/**
 * 📦 COMMERCIAL TELEGRAM AUTO-FORWARDER PRO (ULTRA-FAST HYBRID EDITION)
 * 24/7 Cloud Engine on Render
 * 
 * ⚡ DUAL ULTRA-FAST ENGINES:
 * 1. Public Channel Engine: 2-Second Live Poller + Native copyMessage (Instant Full Media)
 * 2. Private Channel Engine: MTProto Socket Push (< 1s) + Backup Listener
 * 
 * 🔘 1-Click Interactive Channel Picker
 * 🚫 Blocklist / Negative Keyword Filter
 * 🔄 Link & Text Replacer (Idea A)
 * 🏷️ PDF & Document Auto-Renamer (Idea B)
 * 💡 Zero-Delay Media Forwarding (Idea C)
 * 🧹 100% Identity Stripper & Custom Footer Branding
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
console.log('⚡ HYBRID REAL-TIME TELEGRAM AUTO-FORWARDER PRO ⚡');
console.log('🚀 Dual-Engine: Public Scraper + MTProto Socket Push');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Health-check HTTP Server for 24/7 Cloud (Render / UptimeRobot)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telegram Auto-Forwarder Bot is LIVE 24/7!\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Cloud Keep-Alive Web Server active on port ${PORT}`);
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
const processedMsgCache = new Set();

// Clean channel handle
function cleanChannelHandle(input) {
  if (!input) return '';
  return input.trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .trim();
}

// Normalize channel ID for 100% accurate matching
function getNormalizedId(rawId) {
  if (!rawId) return '';
  return String(rawId).replace(/^-100/, '').replace(/^-/, '').trim();
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

// 4. Initialize or Get Userbot Client
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
    attachRealTimeListener(userId, client);
    return client;
  } catch (e) {
    console.error(`Userbot init failed for ${userId}:`, e.message);
    return null;
  }
}

// ⚡ 5. REAL-TIME MTPROTO PUSH EVENT ENGINE (< 1s)
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
      const sourceEntity = await client.getEntity(u.source);
      const targetId = getNormalizedId(sourceEntity.id || sourceEntity.chatId);
      const incomingId = getNormalizedId(message.chatId || (message.peerId && message.peerId.channelId));

      if (targetId && incomingId && targetId !== incomingId) {
        return; // Message from different chat
      }

      const postText = message.message || '';
      const docName = (message.file && message.file.name) ? message.file.name : '';

      // Blocklist check
      if (isPostBlocked(postText, docName, u.blocklist)) return;

      // Keyword check
      if (u.keyword) {
        const kw = u.keyword.toLowerCase();
        if (!postText.toLowerCase().includes(kw) && !docName.toLowerCase().includes(kw)) return;
      }

      // Media filter check
      if (u.filterType === 'PDF_ONLY') {
        const isPdf = message.document && (message.document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf'));
        if (!isPdf) return;
      } else if (u.filterType === 'VIDEO_ONLY') {
        if (!message.video) return;
      }

      const cleanText = cleanAndBrandText(postText, u.removeLinks, u.footer, u.replaceRules);
      const startTime = Date.now();

      // Zero-delay dispatch
      if (!message.media) {
        await client.sendMessage(u.destination, { message: cleanText });
        console.log(`⚡ [INSTANT TEXT in ${Date.now() - startTime}ms]: Post ${message.id}`);
        return;
      }

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
        } catch (fwdErr) {}
      }

      // In-Memory RAM Buffer Stream
      const buffer = await client.downloadMedia(message.media);
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

      console.log(`⚡ [INSTANT MEDIA DELIVERED in ${Date.now() - startTime}ms]: Post ${message.id}`);
      u.lastPostId = message.id;
      saveDb();
    } catch (err) {
      console.error('Instant forward error:', err.message);
    }
  }, new NewMessage({}));

  activeEventHandlers[userId] = true;
  console.log(`🟢 Instant Push Listener activated for User: ${userId}`);
}

// 6. Public Web Scraper (For zero-login public channels)
async function scrapePublicChannel(channelName) {
  const clean = cleanChannelHandle(channelName);
  if (!clean || clean.startsWith('-100') || clean.startsWith('+')) return [];
  const url = `https://t.me/s/${clean}`;

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 6000
    });

    const html = res.data;
    const posts = [];
    const parts = html.split('class="tgme_widget_message_wrap');

    for (let i = 1; i < parts.length; i++) {
      const block = parts[i];

      const postMatch = block.match(/data-post="[^/]+\/(\d+)"/);
      if (!postMatch) continue;
      const postId = parseInt(postMatch[1], 10);

      let msgText = '';
      const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (textMatch) {
        let raw = textMatch[1];
        raw = raw.replace(/<br\s*\/?>/gi, '\n');
        raw = raw.replace(/<[^>]+>/g, '');
        msgText = raw.trim();
      }

      let photoUrl = '';
      const photoMatch = block.match(/background-image:url\('([^']+)'\)/);
      if (photoMatch) { photoUrl = photoMatch[1]; }

      let videoUrl = '';
      const videoMatch = block.match(/<video[^>]*src="([^"]+)"/);
      if (videoMatch) { videoUrl = videoMatch[1]; }

      const isPdf = block.includes('tgme_widget_message_document') ||
                    block.includes('.pdf') ||
                    msgText.toLowerCase().includes('pdf') ||
                    block.includes('document');

      let docTitle = '';
      const docMatch = block.match(/class="tgme_widget_message_document_title[^"]*"[^>]*>([^<]+)</);
      if (docMatch) { docTitle = docMatch[1].trim(); }

      if (msgText || photoUrl || videoUrl || isPdf) {
        posts.push({
          id: postId,
          text: msgText,
          photo: photoUrl,
          video: videoUrl,
          isPdf: isPdf,
          docTitle: docTitle
        });
      }
    }

    return posts.sort((a, b) => a.id - b.id);
  } catch (err) {
    return [];
  }
}

// 7. Universal Forwarder Dispatcher (Public Channels)
async function forwardPost(destinationChat, sourceChat, post, removeLinks = true, footer = '', replaceRules = '') {
  const cleanDest = destinationChat.startsWith('@') ? destinationChat : (destinationChat.startsWith('-100') ? destinationChat : `@${destinationChat}`);
  const cleanSrc = cleanChannelHandle(sourceChat);
  const cleanSrcHandle = `@${cleanSrc}`;

  const cleanCaption = cleanAndBrandText(post.text, removeLinks, footer, replaceRules);

  // Strategy 1: Telegram Native copyMessage (Transfers genuine full-res media without forwarding tag!)
  try {
    const copyUrl = `https://api.telegram.org/bot${BOT_TOKEN}/copyMessage`;
    const payload = {
      chat_id: cleanDest,
      from_chat_id: cleanSrcHandle,
      message_id: post.id
    };
    if (cleanCaption) {
      payload.caption = cleanCaption;
    }
    const res = await axios.post(copyUrl, payload, { timeout: 12000 });
    if (res.data && res.data.ok) return true;
  } catch (e) {}

  // Strategy 2: Direct Scraped Photo
  if (post.photo) {
    try {
      await bot.sendPhoto(cleanDest, post.photo, { caption: cleanCaption });
      return true;
    } catch (e) {}
  }

  // Strategy 3: Direct Scraped Video
  if (post.video) {
    try {
      await bot.sendVideo(cleanDest, post.video, { caption: cleanCaption });
      return true;
    } catch (e) {}
  }

  // Strategy 4: Document Reference (if PDF)
  if (post.isPdf) {
    try {
      const docName = post.docTitle || 'Document/PDF';
      let docMsg = `📄 <b>${docName}</b>\n\n🔗 <a href="https://t.me/${cleanSrc}/${post.id}">Click here to view in source</a>`;
      if (footer) { docMsg += `\n\n━━━━━━━━━━━━━━━━━━━━\n${footer.trim()}`; }
      await bot.sendMessage(cleanDest, docMsg, { parse_mode: 'HTML' });
      return true;
    } catch (e) {}
  }

  // Strategy 5: Text Message
  if (cleanCaption) {
    try {
      await bot.sendMessage(cleanDest, cleanCaption);
      return true;
    } catch (e) {}
  }

  return false;
}

// 8. Format Main Customer Menu
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
  const statusText = u.isActive ? '🟢 <b>RUNNING (ACTIVE - 2s Live Engine)</b>' : '🔴 <b>PAUSED (STOPPED)</b>';
  const rmLinkText = u.removeLinks ? '✅ ON (Watermarks deleted)' : '❌ OFF';
  const filterBadge = u.filterType === 'PDF_ONLY' ? '📄 ONLY PDFs' :
                      u.filterType === 'VIDEO_ONLY' ? '🎥 ONLY VIDEOS' : '🌐 ALL MEDIA';
  const kwBadge = u.keyword ? `<code>${u.keyword}</code>` : 'None';
  const blockBadge = u.blocklist ? `<code>${u.blocklist}</code>` : 'None';
  const repBadge = u.replaceRules ? '✅ Active' : 'None';
  const pdfTag = u.pdfPrefix ? `<code>${u.pdfPrefix}</code>` : 'None';
  const privateBadge = u.isUserbotConnected ? '🟢 Connected (Ultra-Fast Socket Mode)' : '⚪ Public Live Mode';

  const text = `
🤖 <b>TELEGRAM AUTO-FORWARDER PRO PANEL</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>Status:</b> ${statusText}
📥 <b>Source Channel:</b> <code>${u.source}</code>
📤 <b>My Channel:</b> <code>${u.destination}</code>
📑 <b>Media Filter:</b> <b>${filterBadge}</b>
🔍 <b>Include Word:</b> ${kwBadge}
🚫 <b>Blocked Words:</b> ${blockBadge}
🔄 <b>Link Replacer:</b> ${repBadge}
🏷️ <b>PDF Renamer:</b> ${pdfTag}
🧹 <b>Watermark Remover:</b> ${rmLinkText}
🏷️ <b>Custom Footer:</b> <i>${u.footer || 'None'}</i>
🔐 <b>Mode:</b> ${privateBadge}
━━━━━━━━━━━━━━━━━━━━
👇 <i>Buttons par click karke settings karein:</i>
  `.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📥 1. Choose Source', callback_data: 'pick_src' },
        { text: '📤 2. Choose My Channel', callback_data: 'pick_dst' }
      ],
      [
        { text: `📑 Media: ${filterBadge}`, callback_data: 'tog_filter' },
        { text: '🔍 Include Word', callback_data: 'set_kw' }
      ],
      [
        { text: `🚫 Block Words: ${u.blocklist ? 'SET' : 'NONE'}`, callback_data: 'set_blk' },
        { text: '🔄 Link/Text Replacer', callback_data: 'set_repl' }
      ],
      [
        { text: `🏷️ PDF Renamer: ${u.pdfPrefix ? 'SET' : 'NONE'}`, callback_data: 'set_pdf_tag' },
        { text: `🧹 Remover: ${u.removeLinks ? 'ON' : 'OFF'}`, callback_data: 'tog_lnk' }
      ],
      [
        { text: '📦 CLONE RECENT POSTS NOW', callback_data: 'clone_now' },
        { text: '📚 CLONE ALL OLD PDFs', callback_data: 'bulk_pdf' }
      ],
      [
        { text: u.isUserbotConnected ? '✅ Telegram Account Connected' : '🔐 Connect Telegram (Private Channels)', callback_data: 'userbot_auth' }
      ],
      [
        { text: '🏷️ Set Custom Footer', callback_data: 'set_ftr' },
        { text: u.isActive ? '⏸️ PAUSE' : '▶️ START AUTO-CLONE (LIVE)', callback_data: 'tog_act' }
      ],
      [
        { text: '🔄 Refresh Status', callback_data: 'refresh' }
      ]
    ]
  };

  return { text, keyboard };
}

// 9. Bot Command & Callback Handlers
bot.onText(/\/start/, async (msg) => {
  const userId = String(msg.from.id);
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

  // 1-Click Source Picker
  if (data === 'pick_src') {
    const client = await getUserClient(userId);
    if (!client) {
      userSessions[userId] = 'awaiting_source';
      bot.sendMessage(chatId, '📥 <b>Source Channel ka username ya link bhejo:</b>\n(Jaise: <code>@simpleforextools</code> ya private link)\n\n<i>Tip: Saare joined channels ki 1-click button list dekhne ke liye "🔐 Connect Telegram" button dabayein!</i>', { parse_mode: 'HTML' });
      return;
    }

    bot.sendMessage(chatId, '⏳ <i>Aapke joined channels load kiye ja rahe hain...</i>', { parse_mode: 'HTML' });
    try {
      const dialogs = await client.getDialogs({ limit: 30 });
      const channels = dialogs.filter(d => d.isChannel || d.isGroup);

      if (channels.length === 0) {
        userSessions[userId] = 'awaiting_source';
        bot.sendMessage(chatId, '⚠️ Koi joined channel nahi mila. Kripya username manually likhkar bhejein:');
        return;
      }

      const buttons = [];
      for (const ch of channels.slice(0, 10)) {
        const title = ch.title.length > 28 ? ch.title.substring(0, 25) + '...' : ch.title;
        buttons.push([{ text: `📢 ${title}`, callback_data: `set_src_id_${ch.id}` }]);
      }
      buttons.push([{ text: '⌨️ Type Manually Instead', callback_data: 'type_src' }]);

      bot.sendMessage(chatId, '📥 <b>Jis Channel se content copy karna hai, us button par click karein:</b>', {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (e) {
      userSessions[userId] = 'awaiting_source';
      bot.sendMessage(chatId, `Kripya username manually likhkar bhejein:`);
    }
    return;
  }

  if (data.startsWith('set_src_id_')) {
    const chId = data.replace('set_src_id_', '');
    u.source = chId.startsWith('-100') ? chId : `-100${chId}`;
    saveDb();
    bot.sendMessage(chatId, `✅ <b>Source Channel Set Ho Gaya:</b> <code>${u.source}</code>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(chatId, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // 1-Click Destination Picker
  if (data === 'pick_dst') {
    const client = await getUserClient(userId);
    if (!client) {
      userSessions[userId] = 'awaiting_dest';
      bot.sendMessage(chatId, '📤 <b>Apne Destination Channel ka username bhejo:</b>\n(Jaise: <code>@ICT_SMC_PDF</code>)\n\n⚠️ <i>Naye Bot ko apne channel me ADMIN banana zaroori hai!</i>', { parse_mode: 'HTML' });
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
        buttons.push([{ text: `📤 ${title}`, callback_data: `set_dst_id_${ch.id}` }]);
      }
      buttons.push([{ text: '⌨️ Type Manually Instead', callback_data: 'type_dst' }]);

      bot.sendMessage(chatId, '📤 <b>Apna Destination Channel chunein (Jahan post bhejna hai):</b>\n<i>(Bot ko channel me Admin banana zaroori hai)</i>', {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } catch (e) {
      userSessions[userId] = 'awaiting_dest';
      bot.sendMessage(chatId, `Kripya apne channel ka username manually bhejein:`);
    }
    return;
  }

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

    case 'set_repl':
      userSessions[userId] = 'awaiting_replace';
      bot.sendMessage(chatId, `
🔄 <b>LINK & TEXT REPLACER:</b>
👇 <b>Format:</b> <code>PuranaWord => NayaWord</code>
(Jaise: <code>@OldChannel => @MyChannel</code> ya <code>oldlink.com => mylink.com</code>)

<i>Hatane ke liye <code>NONE</code> likhein.</i>
      `.trim(), { parse_mode: 'HTML' });
      break;

    case 'set_pdf_tag':
      userSessions[userId] = 'awaiting_pdf_tag';
      bot.sendMessage(chatId, `
🏷️ <b>PDF AUTO-RENAMER TAG:</b>
👇 <b>Custom Tag Bhejo:</b> (Jaise: <code>[MyChannel]</code>)\n<i>Hatane ke liye <code>NONE</code> likhein.</i>
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
        bot.sendMessage(chatId, '✅ <b>Aapka Telegram Account pehle se connected hai!</b>\nLogout karne ke liye <code>LOGOUT</code> likhein.', { parse_mode: 'HTML' });
        return;
      }
      userSessions[userId] = 'awaiting_phone';
      bot.sendMessage(chatId, `
🔐 <b>CONNECT TELEGRAM ACCOUNT</b>
Private Channels aur sub-second speed ke liye apna number connect karein:

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

      // Userbot execution if connected
      const userClient = await getUserClient(userId);
      if (userClient) {
        try {
          const entity = await userClient.getEntity(u.source);
          const messages = await userClient.getMessages(entity, { limit: 10 });
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
        } catch (e) {}
      }

      // Public Channel Scraper execution
      const posts = await scrapePublicChannel(u.source);
      if (posts.length === 0) {
        bot.sendMessage(chatId, `⚠️ <b>Source Channel (${u.source}) se posts nahi mil paaye!</b>`, { parse_mode: 'HTML' });
      } else {
        let clonedCount = 0;
        const targetPosts = posts.length > 10 ? posts.slice(-10) : posts;

        for (const p of targetPosts) {
          if (isPostBlocked(p.text, p.docTitle, u.blocklist)) continue;
          if (u.keyword) {
            const kw = u.keyword.toLowerCase();
            if (!p.text.toLowerCase().includes(kw) && !p.docTitle.toLowerCase().includes(kw)) continue;
          }
          if (u.filterType === 'PDF_ONLY' && !p.isPdf) continue;
          if (u.filterType === 'VIDEO_ONLY' && !p.video) continue;

          const ok = await forwardPost(u.destination, u.source, p, u.removeLinks, u.footer, u.replaceRules);
          if (ok) {
            clonedCount++;
            u.lastPostId = Math.max(u.lastPostId || 0, p.id);
            saveDb();
          }
          await new Promise(r => setTimeout(r, 1000));
        }

        bot.sendMessage(chatId, `🎉 <b>CLONING COMPLETE!</b> Total <b>${clonedCount} posts (Media & Text)</b> deliver ho gaye!`, { parse_mode: 'HTML' });
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

        const statStr = u.isActive ? '🚀 <b>Auto-Cloning ON! Naye posts aate hi turant forward honge!</b>' : '⏸️ <b>Forwarding Pause Kar Di Gayi Hai.</b>';
        bot.sendMessage(chatId, `${statStr}`, { parse_mode: 'HTML' });
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
    u.lastPostId = 0; // Reset to initialize on fresh source
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

// ⚡ 10. REAL-TIME HYBRID ENGINE POLLER (EVERY 2 SECONDS)
// Runs continuously for Public Channels & As Fail-Safe for Private Channels!
setInterval(async () => {
  for (const uid of Object.keys(db)) {
    const u = db[uid];
    if (u.isActive && u.source !== 'Not Set' && u.destination !== 'Not Set') {
      try {
        const isPrivate = u.source.startsWith('-100') || u.source.includes('+') || u.source.includes('joinchat');
        const userClient = await getUserClient(uid);

        // A. Private Channel Active Poller (if userbot connected)
        if (isPrivate && userClient) {
          try {
            const entity = await userClient.getEntity(u.source);
            const messages = await userClient.getMessages(entity, { limit: 3 });

            if (messages.length > 0) {
              if (!u.lastPostId || u.lastPostId === 0) {
                u.lastPostId = messages[0].id;
                saveDb();
                continue;
              }

              const newMessages = messages.filter(m => m.id > u.lastPostId).reverse();
              for (const nm of newMessages) {
                const postText = nm.message || '';
                const docName = (nm.file && nm.file.name) ? nm.file.name : '';

                if (isPostBlocked(postText, docName, u.blocklist)) {
                  u.lastPostId = nm.id;
                  saveDb();
                  continue;
                }

                if (u.filterType === 'PDF_ONLY') {
                  const isPdf = nm.document && (nm.document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf'));
                  if (!isPdf) {
                    u.lastPostId = nm.id;
                    saveDb();
                    continue;
                  }
                } else if (u.filterType === 'VIDEO_ONLY') {
                  if (!nm.video) {
                    u.lastPostId = nm.id;
                    saveDb();
                    continue;
                  }
                }

                const cleanText = cleanAndBrandText(postText, u.removeLinks, u.footer, u.replaceRules);

                if (nm.media) {
                  const buffer = await userClient.downloadMedia(nm.media);
                  let customFilename = docName;
                  if (u.pdfPrefix && docName) {
                    customFilename = `${u.pdfPrefix.trim()} ${docName}`.trim();
                  }

                  await userClient.sendFile(u.destination, {
                    file: buffer,
                    caption: cleanText,
                    attributes: customFilename && nm.document ? [
                      new Api.DocumentAttributeFilename({ fileName: customFilename })
                    ] : (nm.document ? nm.document.attributes : undefined)
                  });
                } else if (cleanText) {
                  await userClient.sendMessage(u.destination, { message: cleanText });
                }

                console.log(`🚀 [REAL-TIME PRIVATE FORWARDED]: Post ${nm.id} to ${u.destination}`);
                u.lastPostId = nm.id;
                saveDb();
              }
            }
          } catch (e) {}
          continue;
        }

        // B. Public Channel Active Poller (Runs every 2s without login!)
        const posts = await scrapePublicChannel(u.source);
        if (posts.length > 0) {
          if (!u.lastPostId || u.lastPostId === 0) {
            u.lastPostId = posts[posts.length - 1].id;
            saveDb();
            continue;
          }

          const newOnes = posts.filter(p => p.id > u.lastPostId);
          for (const np of newOnes) {
            // Blocklist check
            if (isPostBlocked(np.text, np.docTitle, u.blocklist)) {
              u.lastPostId = np.id;
              saveDb();
              continue;
            }

            // Keyword check
            if (u.keyword) {
              const kw = u.keyword.toLowerCase();
              if (!np.text.toLowerCase().includes(kw) && !np.docTitle.toLowerCase().includes(kw)) {
                u.lastPostId = np.id;
                saveDb();
                continue;
              }
            }

            // Media type check
            if (u.filterType === 'PDF_ONLY' && !np.isPdf) {
              u.lastPostId = np.id;
              saveDb();
              continue;
            }
            if (u.filterType === 'VIDEO_ONLY' && !np.video) {
              u.lastPostId = np.id;
              saveDb();
              continue;
            }

            const ok = await forwardPost(u.destination, u.source, np, u.removeLinks, u.footer, u.replaceRules);
            if (ok) {
              console.log(`🚀 [REAL-TIME PUBLIC FORWARDED]: Post ${np.id} to ${u.destination}`);
              u.lastPostId = np.id;
              saveDb();
            }
          }
        }
      } catch (e) {}
    }
  }
}, 2000); // ⚡ Checks every 2 seconds flat!
