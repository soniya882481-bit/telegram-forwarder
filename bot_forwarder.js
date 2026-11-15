/**
 * 📦 COMMERCIAL TELEGRAM AUTO-FORWARDER (SAAS CLOUD EDITION)
 * 24/7 Permanent Cloud Engine - Runs on Render / Any Cloud
 * Zero code, zero files for the customer - 100% managed inside Telegram Chat!
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 🔑 CONFIGURATION (Loaded securely from Cloud Environment Variables)
const BOT_TOKEN = process.env.FORWARDER_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('FATAL: BOT_TOKEN or FORWARDER_BOT_TOKEN environment variable not set!');
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'customers.json');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚡ COMMERCIAL TELEGRAM AUTO-FORWARDER (24/7 CLOUD) ⚡');
console.log('🌐 Multi-Customer In-Chat Control Panel');
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

// Memory tracking for awaiting customer inputs
const userSessions = {};

// Helper: Clean channel usernames / links
function cleanChannelHandle(input) {
  if (!input) return '';
  return input.trim()
    .replace(/^@+/, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^t\.me\//i, '')
    .trim();
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
      isActive: false,
      lastPostId: 0
    };
    saveDb();
  }

  const u = db[userId];
  const statusText = u.isActive ? '🟢 <b>RUNNING (ACTIVE)</b>' : '🔴 <b>PAUSED (STOPPED)</b>';
  const rmLinkText = u.removeLinks ? '✅ ON' : '❌ OFF';
  const filterBadge = u.filterType === 'PDF_ONLY' ? '📄 ONLY PDFs' :
                      u.filterType === 'VIDEO_ONLY' ? '🎥 ONLY VIDEOS' : '🌐 ALL POSTS';
  const kwBadge = u.keyword ? `<code>${u.keyword}</code>` : 'None';

  const text = `
🤖 <b>TELEGRAM AUTO-FORWARDER PRO PANEL</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>Status:</b> ${statusText}
📥 <b>Source Channel:</b> <code>${u.source}</code>
📤 <b>My Channel:</b> <code>${u.destination}</code>
📑 <b>Media Filter:</b> <b>${filterBadge}</b>
🔍 <b>Keyword Filter:</b> ${kwBadge}
🧹 <b>Watermark Remover:</b> ${rmLinkText}
🏷️ <b>Custom Footer:</b> <i>${u.footer || 'None'}</i>
━━━━━━━━━━━━━━━━━━━━
👇 <i>Buttons par click karke settings karein:</i>
  `.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📥 1. Set Source', callback_data: 'set_src' },
        { text: '📤 2. Set My Channel', callback_data: 'set_dst' }
      ],
      [
        { text: `📑 Filter: ${filterBadge}`, callback_data: 'tog_filter' },
        { text: '🔍 Set Keyword', callback_data: 'set_kw' }
      ],
      [
        { text: '📦 CLONE POSTS NOW (Instant Test)', callback_data: 'clone_now' }
      ],
      [
        { text: `🧹 Remover: ${u.removeLinks ? 'ON' : 'OFF'}`, callback_data: 'tog_lnk' },
        { text: '🏷️ Set Custom Footer', callback_data: 'set_ftr' }
      ],
      [
        { text: u.isActive ? '⏸️ PAUSE' : '▶️ START AUTO-CLONE', callback_data: 'tog_act' },
        { text: '🔄 Refresh', callback_data: 'refresh' }
      ]
    ]
  };

  return { text, keyboard };
}

// 5. Public Web Scraper
async function scrapePublicChannel(channelName) {
  const clean = cleanChannelHandle(channelName);
  if (!clean) return [];
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

      // 1. Post ID
      const postMatch = block.match(/data-post="[^/]+\/(\d+)"/);
      if (!postMatch) continue;
      const postId = parseInt(postMatch[1], 10);

      // 2. Text
      let msgText = '';
      const textMatch = block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (textMatch) {
        let raw = textMatch[1];
        raw = raw.replace(/<br\s*\/?>/gi, '\n');
        raw = raw.replace(/<[^>]+>/g, '');
        msgText = raw.trim();
      }

      // 3. Photo URL
      let photoUrl = '';
      const photoMatch = block.match(/background-image:url\('([^']+)'\)/);
      if (photoMatch) {
        photoUrl = photoMatch[1];
      }

      // 4. Video URL
      let videoUrl = '';
      const videoMatch = block.match(/<video[^>]*src="([^"]+)"/);
      if (videoMatch) {
        videoUrl = videoMatch[1];
      }

      // 5. Document / PDF Check
      const isPdf = block.includes('tgme_widget_message_document') ||
                    block.includes('.pdf') ||
                    msgText.toLowerCase().includes('pdf') ||
                    block.includes('document');

      // 6. Document Title
      let docTitle = '';
      const docMatch = block.match(/class="tgme_widget_message_document_title[^"]*"[^>]*>([^<]+)</);
      if (docMatch) {
        docTitle = docMatch[1].trim();
      }

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
    console.error(`Scrape error for ${channelName}:`, err.message);
    return [];
  }
}

// 6. Universal Forward / Clone Dispatcher
async function forwardPost(destinationChat, sourceChat, post, removeLinks = true, footer = '') {
  const cleanDest = destinationChat.startsWith('@') ? destinationChat : `@${destinationChat}`;
  const cleanSrc = cleanChannelHandle(sourceChat);
  const cleanSrcHandle = `@${cleanSrc}`;

  let text = post.text || '';
  if (removeLinks && text) {
    text = text.replace(/@[a-zA-Z0-9_]+/g, '')
               .replace(/https?:\/\/[^\s]+/g, '')
               .replace(/t\.me\/[^\s]+/g, '')
               .trim();
  }
  if (footer) {
    if (text) {
      text = `${text}\n\n━━━━━━━━━━━━━━━━━━━━\n${footer.trim()}`;
    } else {
      text = footer.trim();
    }
  }

  // Strategy 1: Telegram Native copyMessage (Transfers native PDFs, high-res videos & photos!)
  try {
    const copyUrl = `https://api.telegram.org/bot${BOT_TOKEN}/copyMessage`;
    const payload = {
      chat_id: cleanDest,
      from_chat_id: cleanSrcHandle,
      message_id: post.id
    };
    if (text) {
      payload.caption = text;
      payload.parse_mode = 'HTML';
    }
    const res = await axios.post(copyUrl, payload, { timeout: 15000 });
    if (res.data && res.data.ok) {
      return true;
    }
  } catch (e) {
    // Fallback to Strategy 2
  }

  // Strategy 2: Scraped Media Sender
  if (post.photo) {
    try {
      await bot.sendPhoto(cleanDest, post.photo, { caption: text, parse_mode: 'HTML' });
      return true;
    } catch (e) {}
  }

  if (post.video) {
    try {
      await bot.sendVideo(cleanDest, post.video, { caption: text, parse_mode: 'HTML' });
      return true;
    } catch (e) {}
  }

  if (text) {
    try {
      await bot.sendMessage(cleanDest, text, { parse_mode: 'HTML' });
      return true;
    } catch (e) {
      try {
        await bot.sendMessage(cleanDest, text);
        return true;
      } catch (e2) {}
    }
  }

  // Strategy 3: Document Reference fallback
  if (post.isPdf) {
    try {
      const docName = post.docTitle || 'Document/PDF';
      let docMsg = `📄 <b>${docName}</b>\n\n🔗 <a href="https://t.me/${cleanSrc}/${post.id}">Click here to open and download from source</a>`;
      if (footer) {
        docMsg += `\n\n━━━━━━━━━━━━━━━━━━━━\n${footer.trim()}`;
      }
      await bot.sendMessage(cleanDest, docMsg, { parse_mode: 'HTML' });
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

  if (!db[userId]) {
    getMainMenu(userId);
  }
  const u = db[userId];

  switch (data) {
    case 'set_src':
      userSessions[userId] = 'awaiting_source';
      bot.sendMessage(chatId, '📥 <b>Source Channel ka username bhejo:</b>\n(Jaise: <code>@cricket_line_live</code> ya <code>https://t.me/simpleforextools</code>)', { parse_mode: 'HTML' });
      break;

    case 'set_dst':
      userSessions[userId] = 'awaiting_dest';
      bot.sendMessage(chatId, '📤 <b>Apne Channel ka username bhejo:</b>\n(Jaise: <code>@my_channel</code>)\n\n⚠️ <i>Naye Bot ko apne channel me ADMIN banana zaroori hai!</i>', { parse_mode: 'HTML' });
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
      bot.sendMessage(chatId, '🔍 <b>Keyword Filter Bhejo:</b>\n(Jaise: <code>#notes</code>, <code>PDF</code>, ya <code>IPL</code>)\n<i>Sab kuch lene ke liye <code>NONE</code> likhkar bhejein.</i>', { parse_mode: 'HTML' });
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

    case 'clone_now':
      if (u.source === 'Not Set' || u.destination === 'Not Set') {
        bot.sendMessage(chatId, '⚠️ <b>Pehle Source aur Destination channel set karein!</b>', { parse_mode: 'HTML' });
        return;
      }
      bot.sendMessage(chatId, `🚀 <b>Cloning Shuru Ho Gayi!</b>\nSource Channel (<code>${u.source}</code>) se posts utha kar <code>${u.destination}</code> me bheje ja rahe hain...`, { parse_mode: 'HTML' });

      const posts = await scrapePublicChannel(u.source);
      if (posts.length === 0) {
        bot.sendMessage(chatId, `⚠️ <b>Source Channel (${u.source}) se posts nahi mil paaye!</b>\nCheck karein ki kya username sahi hai aur channel public hai.`, { parse_mode: 'HTML' });
      } else {
        let filtered = posts;
        if (u.filterType === 'PDF_ONLY') {
          filtered = posts.filter(p => p.isPdf);
        } else if (u.filterType === 'VIDEO_ONLY') {
          filtered = posts.filter(p => p.video);
        }

        if (u.keyword) {
          const kw = u.keyword.toLowerCase();
          filtered = filtered.filter(p => (p.text && p.text.toLowerCase().includes(kw)) || (p.docTitle && p.docTitle.toLowerCase().includes(kw)));
        }

        if (filtered.length === 0) {
          bot.sendMessage(chatId, `⚠️ <b>Filter ke anusaar (${u.filterType}) posts nahi mile!</b>\nMedia Filter ko <b>ALL POSTS</b> karke dubara try karein.`, { parse_mode: 'HTML' });
        } else {
          let clonedCount = 0;
          const targetPosts = filtered.length > 10 ? filtered.slice(-10) : filtered;

          for (const p of targetPosts) {
            const ok = await forwardPost(u.destination, u.source, p, u.removeLinks, u.footer);
            if (ok) {
              clonedCount++;
              u.lastPostId = Math.max(u.lastPostId || 0, p.id);
              saveDb();
              console.log(`✅ [CLONED]: Post ${p.id} to ${u.destination}`);
            }
            await new Promise(r => setTimeout(r, 1200));
          }

          bot.sendMessage(chatId, `🎉 <b>CLONING COMPLETE!</b>\nTotal <b>${clonedCount} posts</b> aapke channel (<code>${u.destination}</code>) me successfully deliver ho gaye!`, { parse_mode: 'HTML' });
        }
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

// Text Message Inputs
bot.on('message', (msg) => {
  const userId = String(msg.from.id);
  const text = msg.text ? msg.text.trim() : '';
  if (!text || text.startsWith('/')) return;

  const session = userSessions[userId];
  if (!session) return;
  const u = db[userId];

  if (session === 'awaiting_source') {
    const clean = cleanChannelHandle(text);
    u.source = `@${clean}`;
    delete userSessions[userId];
    saveDb();
    bot.sendMessage(msg.chat.id, `✅ <b>Source Channel Set:</b> <code>@${clean}</code>`, { parse_mode: 'HTML' });
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
    bot.sendMessage(msg.chat.id, `✅ <b>Keyword Filter Set:</b> ${kwMsg}`, { parse_mode: 'HTML' });
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

// 8. Real-Time Auto Listener Interval
setInterval(async () => {
  for (const uid of Object.keys(db)) {
    const u = db[uid];
    if (u.isActive && u.source !== 'Not Set' && u.destination !== 'Not Set') {
      try {
        const posts = await scrapePublicChannel(u.source);
        if (posts.length > 0) {
          if (!u.lastPostId || u.lastPostId === 0) {
            u.lastPostId = posts[posts.length - 1].id;
            saveDb();
            continue;
          }

          const newOnes = posts.filter(p => p.id > u.lastPostId);

          for (const np of newOnes) {
            // Media filter
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

            // Keyword check
            if (u.keyword) {
              const kw = u.keyword.toLowerCase();
              const hasKw = (np.text && np.text.toLowerCase().includes(kw)) ||
                            (np.docTitle && np.docTitle.toLowerCase().includes(kw));
              if (!hasKw) {
                u.lastPostId = np.id;
                saveDb();
                continue;
              }
            }

            const ok = await forwardPost(u.destination, u.source, np, u.removeLinks, u.footer);
            if (ok) {
              console.log(`🚀 [REAL-TIME FORWARDED]: Post ${np.id} to ${u.destination}`);
              u.lastPostId = np.id;
              saveDb();
            }
          }
        }
      } catch (e) {
        // Silent error catch to keep interval looping
      }
    }
  }
}, 4000);
