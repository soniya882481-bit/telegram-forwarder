/**
 * 📦 COMMERCIAL TELEGRAM AUTO-FORWARDER (SAAS CLOUD EDITION)
 * 24/7 Permanent Cloud Engine - Runs on Render / Any Cloud
 * 
 * FEATURES:
 * 1. 100% Media Cloning (Real Photos, Videos, PDFs, Documents, Audios & Voice Notes)
 * 2. 100% Identity Stripper (Removes source @handles, t.me links & ads)
 * 3. 🚫 Negative Keyword Filter (Blocklist: Skips any post containing unwanted words)
 * 4. 🔍 Positive Keyword Filter (Only forwards matching posts)
 * 5. 📑 Media Type Filters (ALL / ONLY PDFs / ONLY VIDEOS)
 * 6. 🔐 Private Channels & Copy-Protected Content Support (via Userbot MTProto)
 * 7. 📚 Bulk PDF Cloner from History
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

// 🔑 CONFIGURATION
const BOT_TOKEN = process.env.FORWARDER_BOT_TOKEN || process.env.BOT_TOKEN || '8987351075:AAGpaJfAru2pxL4lfgQ6jD7lfwMnP3Itah4';
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'customers.json');

// Telegram Developer Credentials
const API_ID = 39052612;
const API_HASH = 'cda928c55ec94af1f0121b37b40a923a';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚡ COMMERCIAL TELEGRAM AUTO-FORWARDER PRO ACTIVE ⚡');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. Health-check HTTP Server for 24/7 Cloud Keep-Alive (Render / UptimeRobot)
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telegram Auto-Forwarder Bot is LIVE 24/7!\n');
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

// Helper: Get or initialize connected GramJS Userbot Client
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
    return client;
  } catch (e) {
    console.error(`Userbot init failed for ${userId}:`, e.message);
    return null;
  }
}

// Helper: Clean channel usernames / links
function cleanChannelHandle(input) {
  if (!input) return '';
  return input.trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .trim();
}

// Helper: 100% Identity Stripper & Custom Footer Formatter
function cleanAndBrandText(rawText, removeLinks, footer) {
  let text = rawText || '';
  if (removeLinks && text) {
    // 1. Remove all @mentions (e.g. @channel, @username)
    text = text.replace(/@[a-zA-Z0-9_]+/g, '');
    // 2. Remove all t.me links (e.g. t.me/joinchat, https://t.me/...)
    text = text.replace(/https?:\/\/(www\.)?(t\.me|telegram\.me)\/[^\s]+/gi, '');
    text = text.replace(/t\.me\/[^\s]+/gi, '');
    // 3. Remove all other web links
    text = text.replace(/https?:\/\/[^\s]+/gi, '');
    // 4. Remove leftover extra blank lines
    text = text.replace(/\n{3,}/g, '\n\n').trim();
  }

  if (footer) {
    text = text ? `${text}\n\n━━━━━━━━━━━━━━━━━━━━\n${footer.trim()}` : footer.trim();
  }

  return text.trim();
}

// Helper: Check Blocklist / Negative Keywords
function isPostBlocked(text, docTitle, blocklist) {
  if (!blocklist) return false;
  const blockedWords = blocklist.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  if (blockedWords.length === 0) return false;

  const combined = `${text || ''} ${docTitle || ''}`.toLowerCase();
  return blockedWords.some(bw => combined.includes(bw));
}

// 4. Format Customer Main Menu
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
      isActive: false,
      lastPostId: 0,
      isUserbotConnected: false,
      sessionString: ''
    };
    saveDb();
  }

  const u = db[userId];
  const statusText = u.isActive ? '🟢 <b>RUNNING (ACTIVE)</b>' : '🔴 <b>PAUSED (STOPPED)</b>';
  const rmLinkText = u.removeLinks ? '✅ ON (Source identity deleted)' : '❌ OFF';
  const filterBadge = u.filterType === 'PDF_ONLY' ? '📄 ONLY PDFs' :
                      u.filterType === 'VIDEO_ONLY' ? '🎥 ONLY VIDEOS' : '🌐 ALL MEDIA';
  const kwBadge = u.keyword ? `<code>${u.keyword}</code>` : 'None';
  const blockBadge = u.blocklist ? `<code>${u.blocklist}</code>` : 'None';
  const privateBadge = u.isUserbotConnected ? '🟢 Connected (Private Channels & All Media)' : '⚪ Not Connected (Public Only)';

  const text = `
🤖 <b>TELEGRAM AUTO-FORWARDER PRO PANEL</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>Status:</b> ${statusText}
📥 <b>Source Channel:</b> <code>${u.source}</code>
📤 <b>My Channel:</b> <code>${u.destination}</code>
📑 <b>Media Filter:</b> <b>${filterBadge}</b>
🔍 <b>Only Include Word:</b> $kwBadge
🚫 <b>Blocked Words (Skip):</b> $blockBadge
🧹 <b>Identity Stripper:</b> $rmLinkText
🏷️ <b>Custom Footer:</b> <i>${u.footer || 'None'}</i>
🔐 <b>Private Mode:</b> ${privateBadge}
━━━━━━━━━━━━━━━━━━━━
👇 <i>Buttons par click karke settings karein:</i>
  `.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📥 1. Set Source Channel', callback_data: 'set_src' },
        { text: '📤 2. Set My Channel', callback_data: 'set_dst' }
      ],
      [
        { text: `📑 Media: ${filterBadge}`, callback_data: 'tog_filter' },
        { text: '🔍 Only Include Word', callback_data: 'set_kw' }
      ],
      [
        { text: `🚫 Block Words (Skip): ${u.blocklist ? 'SET' : 'NONE'}`, callback_data: 'set_blk' },
        { text: `🧹 Stripper: ${u.removeLinks ? 'ON' : 'OFF'}`, callback_data: 'tog_lnk' }
      ],
      [
        { text: '📦 CLONE RECENT POSTS (Media + Text)', callback_data: 'clone_now' }
      ],
      [
        { text: '📚 CLONE ALL OLD PDFs (Bulk History)', callback_data: 'bulk_pdf' }
      ],
      [
        { text: u.isUserbotConnected ? '✅ Telegram Account Connected' : '🔐 Connect Telegram (Private Channels)', callback_data: 'userbot_auth' }
      ],
      [
        { text: '🏷️ Set Custom Footer', callback_data: 'set_ftr' },
        { text: u.isActive ? '⏸️ PAUSE' : '▶️ START AUTO-CLONE', callback_data: 'tog_act' }
      ],
      [
        { text: '🔄 Refresh Status', callback_data: 'refresh' }
      ]
    ]
  };

  return { text, keyboard };
}

// 5. Public Web Scraper (Extracts photos, videos, documents, text)
async function scrapePublicChannel(channelName) {
  const clean = cleanChannelHandle(channelName);
  if (!clean || clean.startsWith('-100') || clean.startsWith('+')) return [];
  const url = `https://t.me/s/${clean}`;

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const html = res.data;
    const posts = [];
    const parts = html.split('class="tgme_widget_message_wrap');

    for (let i = 1; i < parts.length; i++) {
      const block = parts[i];

      const postMatch = block.match(/data-post="[^/]+\/(\d+)"/);
      if (!postMatch) continue;
      const postId = parseInt(postMatch[1], 10);

      // Extract full text
      let msgText = '';
      const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (textMatch) {
        let raw = textMatch[1];
        raw = raw.replace(/<br\s*\/?>/gi, '\n');
        raw = raw.replace(/<[^>]+>/g, '');
        msgText = raw.trim();
      }

      // Extract photo URL
      let photoUrl = '';
      const photoMatch = block.match(/background-image:url\('([^']+)'\)/);
      if (photoMatch) { photoUrl = photoMatch[1]; }

      // Extract video URL
      let videoUrl = '';
      const videoMatch = block.match(/<video[^>]*src="([^"]+)"/);
      if (videoMatch) { videoUrl = videoMatch[1]; }

      // Check document / PDF
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

// 6. Universal Forwarder Dispatcher (Public Channels)
async function forwardPost(destinationChat, sourceChat, post, removeLinks = true, footer = '') {
  const cleanDest = destinationChat.startsWith('@') ? destinationChat : `@${destinationChat}`;
  const cleanSrc = cleanChannelHandle(sourceChat);
  const cleanSrcHandle = `@${cleanSrc}`;

  const cleanCaption = cleanAndBrandText(post.text, removeLinks, footer);

  // Strategy 1: Telegram Native copyMessage (Transfers actual full-res photos, videos, files without forwarding tag!)
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
    const res = await axios.post(copyUrl, payload, { timeout: 15000 });
    if (res.data && res.data.ok) return true;
  } catch (e) {
    // If copyMessage failed, fallback to direct media sending
  }

  // Strategy 2: Scraped Media Sender (Photo)
  if (post.photo) {
    try {
      await bot.sendPhoto(cleanDest, post.photo, { caption: cleanCaption });
      return true;
    } catch (e) {}
  }

  // Strategy 3: Scraped Media Sender (Video)
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

// 7. Bot Handlers
bot.onText(/\/start/, (msg) => {
  const userId = String(msg.from.id);
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

  switch (data) {
    case 'set_src':
      userSessions[userId] = 'awaiting_source';
      bot.sendMessage(chatId, '📥 <b>Source Channel bhejo:</b>\n\n- Public Channel: <code>@cricket_line_live</code> ya link\n- Private Channel: Invite link (<code>https://t.me/+...</code>) ya Channel ID (<code>-100...</code>)', { parse_mode: 'HTML' });
      break;

    case 'set_dst':
      userSessions[userId] = 'awaiting_dest';
      bot.sendMessage(chatId, '📤 <b>Apne Channel ka username ya ID bhejo:</b>\n(Jaise: <code>@my_channel</code>)\n\n⚠️ <i>Naye Bot ko apne channel me ADMIN banana zaroori hai!</i>', { parse_mode: 'HTML' });
      break;

    case 'tog_filter':
      u.filterType = u.filterType === 'ALL' ? 'PDF_ONLY' :
                     u.filterType === 'PDF_ONLY' ? 'VIDEO_ONLY' : 'ALL';
      saveDb();
      const m1 = getMainMenu(userId);
      bot.editMessageText(m1.text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: m1.keyboard });
      break;

    case 'set_kw':
      userSessions[userId] = 'awaiting_kw';
      bot.sendMessage(chatId, '🔍 <b>Only Include Word Bhejo:</b>\n(Sirf wahi posts aayengi jisme ye word hoga, jaise: <code>#notes</code> ya <code>PDF</code>)\n\n<i>Filter hatane ke liye <code>NONE</code> likhein.</i>', { parse_mode: 'HTML' });
      break;

    // 🚫 Blocklist / Negative Keywords Handler
    case 'set_blk':
      userSessions[userId] = 'awaiting_blocklist';
      bot.sendMessage(chatId, `
🚫 <b>BLOCKED KEYWORDS (Negative Filter):</b>
━━━━━━━━━━━━━━━━━━━━
Jis message me ye words honge, wo message **KABHI BHI forward nahi hoga** (skip ho jayega).

👇 <b>Jo words block karne hain, unhe comma lagakar bhejein:</b>
(Jaise: <code>Promo, VIP, Contact, Sponsor, Call, Paid</code>)

<i>Sabhi posts aane dene ke liye <code>NONE</code> likhein.</i>
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

    // 🔐 Connect Telegram Account for Private Channels & All Media
    case 'userbot_auth':
      if (u.isUserbotConnected) {
        bot.sendMessage(chatId, '✅ <b>Aapka Telegram Account connected hai!</b>\nPrivate channels se full photos, videos aur PDFs automatic uth rahe hain.\n\n<i>Logout karne ke liye <code>LOGOUT</code> likhkar bhejein.</i>', { parse_mode: 'HTML' });
        return;
      }
      userSessions[userId] = 'awaiting_phone';
      bot.sendMessage(chatId, `
🔐 <b>CONNECT TELEGRAM ACCOUNT</b>
━━━━━━━━━━━━━━━━━━━━
Private channel se full photos, videos aur PDFs lene ke liye apna Telegram number connect karein:

📱 <b>Apna Telegram Phone Number bhejein:</b>
(Country code ke sath, jaise: <code>+919876543210</code>)
      `.trim(), { parse_mode: 'HTML' });
      break;

    // 📦 Instant Cloner (Last 10 Posts with Full Media)
    case 'clone_now':
      if (u.source === 'Not Set' || u.destination === 'Not Set') {
        bot.sendMessage(chatId, '⚠️ <b>Pehle Source aur Destination channel set karein!</b>', { parse_mode: 'HTML' });
        return;
      }
      bot.sendMessage(chatId, `🚀 <b>Cloning Shuru Ho Gayi!</b>\nSource Channel se <b>saare Photos, Videos, PDFs aur Text</b> utha kar deliver kiye ja rahe hain...`, { parse_mode: 'HTML' });

      // Check if Userbot Client is active
      const userClient = await getUserClient(userId);
      const isPrivate = u.source.startsWith('-100') || u.source.includes('+') || u.source.includes('joinchat');

      if (isPrivate || userClient) {
        if (!userClient) {
          bot.sendMessage(chatId, '⚠️ <b>Private Channel se content lene ke liye "🔐 Connect Telegram" button se apna account connect karein!</b>', { parse_mode: 'HTML' });
          return;
        }

        try {
          const entity = await userClient.getEntity(u.source);
          const messages = await userClient.getMessages(entity, { limit: 15 });
          let count = 0;

          for (const m of messages.reverse()) {
            if (!m.message && !m.media) continue;

            const postText = m.message || '';
            const docName = (m.file && m.file.name) ? m.file.name : '';

            // 1. Blocklist Filter (Negative Keywords)
            if (isPostBlocked(postText, docName, u.blocklist)) {
              console.log(`Skipping post ${m.id}: Contains blocked keyword.`);
              continue;
            }

            // 2. Inclusion Keyword Filter
            if (u.keyword) {
              const kw = u.keyword.toLowerCase();
              if (!postText.toLowerCase().includes(kw) && !docName.toLowerCase().includes(kw)) {
                continue;
              }
            }

            // 3. Media Type Filter
            if (u.filterType === 'PDF_ONLY') {
              const isPdf = m.document && (m.document.mimeType === 'application/pdf' || docName.toLowerCase().endsWith('.pdf'));
              if (!isPdf) continue;
            } else if (u.filterType === 'VIDEO_ONLY') {
              if (!m.video) continue;
            }

            // 4. Strip Source Identity & Apply Custom Footer
            const cleanText = cleanAndBrandText(postText, u.removeLinks, u.footer);

            try {
              if (m.media) {
                // Downloads full media directly from Telegram CDN (even if copy-protected!)
                const buffer = await userClient.downloadMedia(m.media);
                await userClient.sendFile(u.destination, {
                  file: buffer,
                  caption: cleanText,
                  attributes: m.document ? m.document.attributes : undefined
                });
              } else if (cleanText) {
                await userClient.sendMessage(u.destination, { message: cleanText });
              }
              count++;
            } catch (err) {
              console.error('Send error:', err.message);
            }
            await new Promise(r => setTimeout(r, 1500));
          }

          bot.sendMessage(chatId, `🎉 <b>CLONING COMPLETE!</b>\nTotal <b>${count} items (Media + Text)</b> aapke channel me deliver ho gaye!\n<i>Source ki identity bilkul gayab kar di gayi hai.</i>`, { parse_mode: 'HTML' });
          return;
        } catch (e) {
          bot.sendMessage(chatId, `⚠️ Private Channel Error: ${e.message}`, { parse_mode: 'HTML' });
        }
      }

      // Fallback for Public Channels
      const posts = await scrapePublicChannel(u.source);
      if (posts.length === 0) {
        bot.sendMessage(chatId, `⚠️ <b>Source Channel (${u.source}) se posts nahi mil paaye!</b>`, { parse_mode: 'HTML' });
      } else {
        let clonedCount = 0;
        const targetPosts = posts.length > 10 ? posts.slice(-10) : posts;

        for (const p of targetPosts) {
          // Blocklist check
          if (isPostBlocked(p.text, p.docTitle, u.blocklist)) continue;

          // Keyword check
          if (u.keyword) {
            const kw = u.keyword.toLowerCase();
            if (!p.text.toLowerCase().includes(kw) && !p.docTitle.toLowerCase().includes(kw)) continue;
          }

          // Media check
          if (u.filterType === 'PDF_ONLY' && !p.isPdf) continue;
          if (u.filterType === 'VIDEO_ONLY' && !p.video) continue;

          const ok = await forwardPost(u.destination, u.source, p, u.removeLinks, u.footer);
          if (ok) {
            clonedCount++;
            u.lastPostId = Math.max(u.lastPostId || 0, p.id);
            saveDb();
          }
          await new Promise(r => setTimeout(r, 1200));
        }

        bot.sendMessage(chatId, `🎉 <b>CLONING COMPLETE!</b>\nTotal <b>${clonedCount} posts (Media & Text)</b> deliver ho gaye!`, { parse_mode: 'HTML' });
      }
      break;

    // 📚 Bulk Cloner: Clone ALL PDFs from History
    case 'bulk_pdf':
      if (u.source === 'Not Set' || u.destination === 'Not Set') {
        bot.sendMessage(chatId, '⚠️ <b>Pehle Source aur Destination channel set karein!</b>', { parse_mode: 'HTML' });
        return;
      }

      const client = await getUserClient(userId);
      if (!client) {
        bot.sendMessage(chatId, '⚠️ <b>Bulk PDF Cloner ke liye pehle "🔐 Connect Telegram" button se apna account connect karein!</b>', { parse_mode: 'HTML' });
        return;
      }

      bot.sendMessage(chatId, `⏳ <b>Channel History se Saare PDFs dhoondhe ja rahe hain...</b>\nPlease wait!`, { parse_mode: 'HTML' });

      try {
        const entity = await client.getEntity(u.source);
        let pdfCount = 0;

        for await (const message of client.iterMessages(entity, { limit: 100 })) {
          const docName = (message.file && message.file.name) ? message.file.name : '';
          const postText = message.message || '';

          // Blocklist check
          if (isPostBlocked(postText, docName, u.blocklist)) continue;

          const isPdf = message.document && (
            message.document.mimeType === 'application/pdf' ||
            docName.toLowerCase().endsWith('.pdf')
          );

          if (isPdf) {
            const caption = cleanAndBrandText(postText, u.removeLinks, u.footer);

            try {
              const buffer = await client.downloadMedia(message.media);
              await client.sendFile(u.destination, {
                file: buffer,
                caption: caption,
                attributes: message.document ? message.document.attributes : undefined
              });
              pdfCount++;
              await new Promise(r => setTimeout(r, 1500));
            } catch (err) {
              console.error('PDF Send Error:', err.message);
            }
          }
        }

        bot.sendMessage(chatId, `🎉 <b>BULK PDF CLONING COMPLETE!</b>\nTotal <b>${pdfCount} PDF Files</b> aapke channel me deliver kar di gayi hain!`, { parse_mode: 'HTML' });
      } catch (err) {
        bot.sendMessage(chatId, `❌ Bulk PDF Error: ${err.message}`, { parse_mode: 'HTML' });
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
        const statStr = u.isActive ? '🚀 Auto-Cloning ON! Naye posts aate hi turant forward honge!' : '⏸️ Forwarding Pause Kar Di Gayi Hai.';
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
    saveDb();
    bot.sendMessage(msg.chat.id, '🚪 <b>Telegram Account Disconnected!</b>', { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // 1. Enter Phone Number for MTProto
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
━━━━━━━━━━━━━━━━━━━━
Aapke <b>Telegram App</b> me 5-digit ka official Login Code aaya hoga.

👇 <b>Wo Code yahan bhejein:</b>
<i>(Tip: Aap spaces ke sath bhi likh sakte hain, jaise: <code>1 2 3 4 5</code>)</i>
      `.trim(), { parse_mode: 'HTML' });
    } catch (err) {
      delete userSessions[userId];
      bot.sendMessage(msg.chat.id, `❌ Code bhejne me error: <b>${err.message || err.errorMessage}</b>\nKripya phone number (+country code ke sath) sahi daalein aur dubara try karein.`, { parse_mode: 'HTML' });
    }
    return;
  }

  // 2. Enter OTP Code for MTProto
  if (session === 'awaiting_otp') {
    const cleanCode = text.replace(/\s+/g, '').trim();
    const authData = userAuthStore[userId];

    if (!authData || !authData.client) {
      delete userSessions[userId];
      bot.sendMessage(msg.chat.id, '⚠️ Session expire ho gaya. Kripya dubara "Connect Telegram" par click karein.');
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

      bot.sendMessage(msg.chat.id, `🎉 <b>TELEGRAM ACCOUNT SUCCESSFULLY CONNECTED!</b> 🚀\nAb aap Private Channels se bhi full photos, videos aur PDFs clone kar sakte hain!`, { parse_mode: 'HTML' });

      const m = getMainMenu(userId);
      bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    } catch (err) {
      if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        userSessions[userId] = 'awaiting_2fa';
        bot.sendMessage(msg.chat.id, `🔐 <b>Two-Step Verification Detected!</b>\nApna Two-Step Password yahan bhejein:`, { parse_mode: 'HTML' });
      } else {
        bot.sendMessage(msg.chat.id, `❌ Login Error: <b>${err.message || err.errorMessage}</b>\nKripya code dubara bhejein.`);
      }
    }
    return;
  }

  // 3. Enter 2FA Password
  if (session === 'awaiting_2fa') {
    const authData = userAuthStore[userId];
    if (!authData || !authData.client) {
      delete userSessions[userId];
      bot.sendMessage(msg.chat.id, '⚠️ Session expire ho gaya. Dubara try karein.');
      return;
    }

    bot.sendMessage(msg.chat.id, '⏳ <i>Password verify kiya ja raha hai...</i>', { parse_mode: 'HTML' });

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

      bot.sendMessage(msg.chat.id, `🎉 <b>SUCCESS! Account Connected with 2FA!</b>`, { parse_mode: 'HTML' });
      const m = getMainMenu(userId);
      bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ Password galat hai: ${err.message || err.errorMessage}.`);
    }
    return;
  }

  // 4. Blocklist / Negative Keywords Input
  if (session === 'awaiting_blocklist') {
    const blk = text.toUpperCase() === 'NONE' ? '' : text;
    u.blocklist = blk;
    delete userSessions[userId];
    saveDb();
    const blkMsg = blk ? `In words wale posts forward nahi honge: <code>${blk}</code>` : 'Blocklist filter hata diya gaya hai.';
    bot.sendMessage(msg.chat.id, `✅ <b>Blocked Words Set:</b> ${blkMsg}`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });
    return;
  }

  // Standard Bot Settings Inputs
  if (session === 'awaiting_source') {
    u.source = text.trim();
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Source Channel Set:</b> <code>${u.source}</code>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });

  } else if (session === 'awaiting_dest') {
    const clean = cleanChannelHandle(text);
    u.destination = `@${clean}`;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Destination Channel Set:</b> <code>@${clean}</code>\n<i>(Make sure bot is Admin there!)</i>`, { parse_mode: 'HTML' });
    const m = getMainMenu(userId);
    bot.sendMessage(msg.chat.id, m.text, { parse_mode: 'HTML', reply_markup: m.keyboard });

  } else if (session === 'awaiting_kw') {
    const kw = text.toUpperCase() === 'NONE' ? '' : text;
    u.keyword = kw;
    delete userSessions[userId];
    saveDb();
    const kwMsg = kw ? `Sirf wahi posts aayenge jisme <code>${kw}</code> hoga!` : 'Keyword filter hata diya gaya hai.';
    bot.sendMessage(msg.chat.id, `✅ <b>Include Keyword Set:</b> ${kwMsg}`, { parse_mode: 'HTML' });
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

// 8. Real-Time Auto Listener Interval (Public & Private)
setInterval(async () => {
  for (const uid of Object.keys(db)) {
    const u = db[uid];
    if (u.isActive && u.source !== 'Not Set' && u.destination !== 'Not Set') {
      try {
        const userClient = await getUserClient(uid);
        const isPrivate = u.source.startsWith('-100') || u.source.includes('+') || u.source.includes('joinchat');

        // Private Channel Real-Time Listener via MTProto (Full Media Support!)
        if (isPrivate && userClient) {
          try {
            const entity = await userClient.getEntity(u.source);
            const messages = await userClient.getMessages(entity, { limit: 5 });

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

                // 1. Blocklist Filter (Negative Keywords)
                if (isPostBlocked(postText, docName, u.blocklist)) {
                  console.log(`Skipping real-time post ${nm.id}: Contains blocked keyword.`);
                  u.lastPostId = nm.id;
                  saveDb();
                  continue;
                }

                // 2. Media Type Filter
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

                // 3. Clean Text & Custom Footer
                const cleanText = cleanAndBrandText(postText, u.removeLinks, u.footer);

                // 4. Send Media or Message
                if (nm.media) {
                  const buffer = await userClient.downloadMedia(nm.media);
                  await userClient.sendFile(u.destination, {
                    file: buffer,
                    caption: cleanText,
                    attributes: nm.document ? nm.document.attributes : undefined
                  });
                } else if (cleanText) {
                  await userClient.sendMessage(u.destination, { message: cleanText });
                }

                console.log(`🚀 [PRIVATE FORWARDED]: Post ${nm.id} to ${u.destination}`);
                u.lastPostId = nm.id;
                saveDb();
              }
            }
          } catch (e) {}
          continue;
        }

        // Public Channel Real-Time Listener
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

            // Media check
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

            const ok = await forwardPost(u.destination, u.source, np, u.removeLinks, u.footer);
            if (ok) {
              console.log(`🚀 [PUBLIC FORWARDED]: Post ${np.id} to ${u.destination}`);
              u.lastPostId = np.id;
              saveDb();
            }
          }
        }
      } catch (e) {}
    }
  }
}, 4000);
