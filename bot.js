// telegram-bot.js
import express from 'express';
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mongoose from 'mongoose';
import path from 'path';
import fetch from "node-fetch";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdf = require("pdf-parse");
const mammoth = require("mammoth");

const ADMIN_ID = 7941060822;
const FORCE_JOIN_CHANNEL = "@bello_world";

//membership check function
async function isUserMember(chatId) {
  try {
    const member = await bot.getChatMember(FORCE_JOIN_CHANNEL, chatId);
    const status = member.status; 
    // "creator", "administrator", "member" are valid
    return ["creator", "administrator", "member"].includes(status);
  } catch (err) {
    console.warn("⚠️ Membership check failed:", err.message);
    return false; // treat errors as not a member
  }
}


async function downloadFile(fileId) {
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path}`;
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

dotenv.config();
const PORT = process.env.PORT || 3000;

const MODELS = {
  gemini: {
    name: "Gemini 1.5 Flash",
    key: process.env.GEMINI_API_KEY,
    type: "gemini"
  },
  gemini_flash2: {
    name: "Gemini 1.5 Flash-2.0",
    key: process.env.GEMINI_API_KEY,
    type: "gemini-1.5-flash-002"
  },
  gemini_pro: {
    name: "Gemini 1.5 Pro",
    key: process.env.GEMINI_API_KEY,
    type: "gemini-1.5-pro"
  },
  openai: {
    name: "GPT-4o-mini",
    key: process.env.OPENAI_API_KEY,
    type: "openai"
  },
  claude: {
    name: "Claude 3 Haiku",
    key: process.env.CLAUDE_API_KEY,
    type: "claude"
  },
};

const userSelectedModel = {}; // { chatId: "gemini" }


mongoose.connect(process.env.MONGODB_CONNECT, { dbName: "Telegram" }).then((req, res) => {
  console.log("MongoDb is Connected....");
});

const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  messages: [
    {
      role: { type: String, enum: ["user", "bot"], required: true },
      text: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  requests: { type: Number, default: 0 },        // daily requests
  lastReset: { type: Date, default: Date.now },  // daily reset for requests
  usage: {
    tokensUsed: { type: Number, default: 0 },   // total tokens used today
    resetDate: { type: Date, default: Date.now } // when to reset quota
  }
});

const User = mongoose.model("User", userSchema);



const app = express();

// -- set view engine to ejs --
app.set("view engine", "ejs");

// -- ejs files
app.get("/", (req, res) => res.render("home"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/terms", (req, res) => res.render("terms"));


// --- Load API keys from .env ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


// --- Initialize Telegram Bot ---
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// 2️⃣ Set the webhook URL
//bot.setWebHook(`https://telegram-bot-1-qzck.onrender.com/bot${TELEGRAM_TOKEN}`);

// 3️⃣ Express route to receive updates
app.use(express.json());
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// --- Running on this port ---
app.listen(PORT, () => console.log(`✅ Web server running on port ${PORT}`));

//--- reply keywords ---
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ["🔍 Search", "🎨 Imagine"],
      ["🤖 Set Model", "📄 Document Analysis"],
      [{ text: '/help' }, { text: '/account' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};


// --- Register Commands with Telegram ---
bot.setMyCommands([
  { command: "start", description: "🤖About the bot" },
  { command: "help", description: "📝List of commands" },
  { command: "account", description: "👤 My account info" },
  { command: "language", description: "🌐 Change language" },
  { command: "clearchat", description: "🧹 Clear chat history" },
  { command: "about", description: "👀About this bot" },
  { command: "terms", description: "📜 Terms of service" },

]);


// --- Initialize Gemini ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Define supported languages
const LANGUAGES = {
  en: "🇬🇧 English",
  hi: "🇮🇳 Hindi",
  es: "🇪🇸 Spanish",
  fr: "🇫🇷 French",
  de: "🇩🇪 German",
  ja: "🇯🇵 Japanese",
  ru: "🇷🇺 Russian",
  ar: "🇸🇦 Arabic",
};


//usage limit 
const userUsage = {}; 
// Format: userUsage[chatId] = { date: "YYYY-MM-DD", search: 0, imagine: 0, doc: 0, img: 0, proTokens: 0 }
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function checkLimit(chatId, type, limit) {
  const today = getToday();
  if (!userUsage[chatId] || userUsage[chatId].date !== today) {
    userUsage[chatId] = { date: today, search: 0, imagine: 0, doc: 0, img: 0, proTokens: 0 };
  }

  if (userUsage[chatId][type] >= limit) return false;
  userUsage[chatId][type]++;
  return true;
}





// --- Commands ---
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `👋 Hi ${msg.from.first_name}!
I am your Private AI assistant.
Type any question and I’ll try to answer.`, mainKeyboard
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `📌 Available commands:
/start - Start the bot
/help - Show help
/about - About this bot
/clearchat - Clear chat history
/terms - Terms of services
/account - My account info
/imagine - For image generation
/search - For Web Search
/setmodel - To choose from different Ai Models
/language - Change language

Additionaly you can send any documemt and photo 
for analysis and other related questions.
`);

});

bot.onText(/\/about/, (msg) => {
  bot.sendMessage(msg.chat.id, `🤖 This bot is built with:
- Telegram Bot API
- Google Gemini API
- OpenAi API
- Claude API
- MongoDB for data storage
- Node.js`);
});

bot.onText(/\/clearchat/, async (msg) => {
  const chatId = msg.chat.id;

  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  

  let user = await User.findOne({ chatId });
  if (!user) {
    bot.sendMessage(chatId, "⚠️ No chat history found.");
    return;
  }

  // ✅ Clear all saved messages
  user.messages = [];
  await user.save();

  bot.sendMessage(chatId, "🧹 Your chat history has been cleared.");
});


bot.onText(/\/terms/, (msg) => {
  const chatId = msg.chat.id;

  const terms = `
  📜 *Terms of Service*
  
  1. This bot is provided for educational and personal use only.  
  2. Do not use this bot to share harmful, illegal, or inappropriate content.  
  3. The bot may store limited usage data to improve responses and enforce usage limits.  
  4. Responses are generated by AI (Gemini API) and may not always be accurate.  
  5. By using this bot, you agree to these terms.
  `;

  bot.sendMessage(chatId, terms, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📄 Full Terms of Service", url: "https://telegram-bot-1-qzck.onrender.com/terms" },
          { text: "🔒 Privacy Policy", url: "https://telegram-bot-1-qzck.onrender.com/privacy" }
        ]
      ]
    }
  });
});


const DEFAULT_LIMIT = 20; // requests per day
const userData = {}; // { chatId: { requests: 0, limit: 20, lastReset: Date } }

function resetUserLimits() {
  const now = new Date();

  for (const chatId in userData) {
    const user = userData[chatId];
    const lastReset = user.lastReset || new Date(0);

    // If last reset was before today, reset requests
    if (lastReset.toDateString() !== now.toDateString()) {
      user.requests = 0;
      user.lastReset = now;
    }
  }
}

// Run reset every hour (or any interval)
setInterval(resetUserLimits, 60 * 60 * 1000); // every 1 hour



// --- My Account ---
bot.onText(/\/account/, async (msg) => {
  const chatId = msg.chat.id;

  //force join 
  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  

  // Fetch user from DB
  let user = await User.findOne({ chatId });
  if (!user) {
    user = new User({
      chatId,
      requests: 0,
      lastReset: new Date(),
      usage: { tokensUsed: 0, resetDate: new Date() },
      messages: [],
    });
    await user.save();
  }

  const remainingRequests = 20 - user.requests;
  const usedTokens = user.usage?.tokensUsed || 0;
  const remainingTokens = 1000 - usedTokens;
  const lang = userLanguages[chatId] || "en";

  // Calculate midnight reset time
  const resetTime = new Date();
  resetTime.setHours(24, 0, 0, 0); // midnight

  // ---- NEW PART: usage limits tracking ----
  const today = getToday();
  const usage = userUsage[chatId] || { date: today, search: 0, imagine: 0, doc: 0, img: 0, proTokens: 0 };
  if (usage.date !== today) {
    usage.search = 0;
    usage.imagine = 0;
    usage.doc = 0;
    usage.img = 0;
    usage.proTokens = 0;
    usage.date = today;
  }

  const limits = {
    search: 10,
    imagine: 5,
    doc: 3,
    img: 3,
    proTokens: 5
  };

  bot.sendMessage(
    chatId,
    `
👤 *My Account*
━━━━━━━━━━━━━
- Requests used today: ${user.requests}
- Requests remaining: ${remainingRequests}
- Daily request limit: 20

- Tokens used today: ${usedTokens}
- Tokens remaining: ${remainingTokens}
- Daily token limit: 1000
- Max tokens per reply: 100

🌍 Current language: ${LANGUAGES[lang]} (${lang})

🕒 Quota resets at: ${resetTime.toLocaleString()}

📊 *Feature Usage Today*
━━━━━━━━━━━━━
🔍 Searches: ${usage.search}/${limits.search}
🎨 Image Generations: ${usage.imagine}/${limits.imagine}
📄 Document Analyses: ${usage.doc}/${limits.doc}
🖼️ Image Analyses: ${usage.img}/${limits.img}
🤖 Gemini-Pro Requests: ${usage.proTokens}/${limits.proTokens}
    `,
    { parse_mode: "Markdown" }
  );
});


bot.onText(/\/language/, (msg) => {
  const chatId = msg.chat.id;

  // Convert LANGUAGES object to inline keyboard (2 buttons per row)
  const buttons = Object.entries(LANGUAGES).map(([code, name]) => {
    return { text: name, callback_data: `lang_${code}` };
  });

  // Split into rows of 2 buttons
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += 2) {
    keyboard.push(buttons.slice(i, i + 2));
  }

  bot.sendMessage(chatId, "🌐 Choose your language:", {
    reply_markup: { inline_keyboard: keyboard }
  });
});

const userLanguages = {}; // store user language in-memory

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;

  if (query.data.startsWith("lang_")) {
    const lang = query.data.replace("lang_", "");
    userLanguages[chatId] = lang;

    bot.sendMessage(chatId, `✅ Language changed to: ${LANGUAGES[lang]}`);
    bot.answerCallbackQuery(query.id);
  }
});


async function saveMessage(chatId, role, text) {
  let user = await User.findOne({ chatId });
  if (!user) {
    user = new User({ chatId });
  }

  user.messages.push({ role, text });

  // keep only last 10 messages
  if (user.messages.length > 10) {
    user.messages = user.messages.slice(-10);
  }

  await user.save();
}

async function checkAndUpdateUsage(chatId, tokensUsedNow) {
  let user = await User.findOne({ chatId });
  if (!user) {
    user = new User({ chatId });
  }

  const today = new Date();
  const resetDate = new Date(user.usage.resetDate);

  // reset daily
  if (today.toDateString() !== resetDate.toDateString()) {
    user.usage.tokensUsed = 0;
    user.usage.resetDate = today;
  }

  if (user.usage.tokensUsed + tokensUsedNow > 1000) {
    return { allowed: false, remaining: 0 };
  }

  user.usage.tokensUsed += tokensUsedNow;
  await user.save();

  return { allowed: true, remaining: 1000 - user.usage.tokensUsed };
}

//search the web
bot.onText(/\/search (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  //force join 
  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  
  const query = match[1];
  bot.sendChatAction(chatId, "typing");

  //added limit to 10
  if (!checkLimit(chatId, "search", 10)) {
    bot.sendMessage(chatId, "⚠️ Daily search limit reached (10). Try again tomorrow.");
    return;
  }
  

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query })
    });

    if (!res.ok) {
      throw new Error(`Serper API error: ${res.status}`);
    }

    const data = await res.json();

    const results = data.organic?.slice(0, 5)
      .map((r, i) => `${i + 1}. [${r.title}](${r.link})\n${r.snippet}`)
      .join("\n\n");

    if (!results) {
      bot.sendMessage(chatId, "⚠ No search results found.");
      return;
    }

    bot.sendMessage(chatId, `🔍 *Search results for:* ${query}\n\n${results}`, {
      parse_mode: "Markdown",
      disable_web_page_preview: true
    });

  } catch (err) {
    console.error("❌ Search error:", err);
    bot.sendMessage(chatId, "⚠ Could not perform web search.");
  }
});


//select model
bot.onText(/\/setmodel/, async(msg) => {
  const chatId = msg.chat.id;

  //force join
  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  

  // Build buttons dynamically only for models with keys
  const buttons = Object.entries(MODELS)
    .map(([id, m]) => ({
      text: m.name + (m.key ? "" : " ❌ Unavailable"),
      callback_data: m.key ? `model_${id}` : `unavailable_${id}`
    }))
    .map(b => [b]); // one button per row

  bot.sendMessage(chatId, "🤖 Choose your AI model:", {
    reply_markup: { inline_keyboard: buttons }
  });
});


bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;

  if (query.data.startsWith("model_")) {
    const modelId = query.data.replace("model_", "");
    userSelectedModel[chatId] = modelId;

    bot.sendMessage(chatId, `✅ Model set to *${MODELS[modelId].name}*`, { parse_mode: "Markdown" });
    bot.answerCallbackQuery(query.id);
  }

  if (query.data.startsWith("unavailable_")) {
    bot.answerCallbackQuery(query.id, {
      text: "⚠ This model is not available right now.",
      show_alert: true
    });
  }
});


//imagine 
bot.onText(/\/imagine (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];

  bot.sendChatAction(chatId, "upload_photo");

  //added limit to 5 image 
  if (!checkLimit(chatId, "imagine", 5)) {
    bot.sendMessage(chatId, "⚠️ Daily image generation limit reached (5). Try again tomorrow.");
    return;
  }
  

  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

    await bot.sendPhoto(chatId, imageUrl, {
      caption: `🎨 Prompt: ${prompt}`
    });
  } catch (err) {
    console.error("❌ Image generation error:", err);
    bot.sendMessage(chatId, "⚠ Could not generate image.");
  }
});

//document analysis
bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  //force join
  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  
  const fileName = msg.document.file_name.toLowerCase();

  bot.sendChatAction(chatId, "typing");

  //added limit to 3 
  if (!checkLimit(chatId, "doc", 3)) {
    bot.sendMessage(chatId, "⚠️ Daily document analysis limit reached (3). Try again tomorrow.");
    return;
  }
  

  try {
    const fileBuffer = await downloadFile(msg.document.file_id);
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      bot.sendMessage(chatId, "⚠️ Could not download your document.");
      return;
    }

    let text = "";
    if (fileName.endsWith(".pdf")) {
      const data = await pdf(fileBuffer);
      text = data.text;
    } else if (fileName.endsWith(".docx")) {
      const data = await mammoth.extractRawText({ buffer: fileBuffer });
      text = data.value;
    } else if (fileName.endsWith(".txt")) {
      text = fileBuffer.toString("utf-8");
    } else {
      bot.sendMessage(chatId, "⚠️ Only PDF, DOCX or TXT files are supported.");
      return;
    }

    if (!text.trim()) {
      bot.sendMessage(chatId, "⚠️ No readable text found in this file.");
      return;
    }

    if (text.length > 20000) text = text.slice(0, 20000); // safety limit

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `Summarize this document:\n\n${text}` }] }
      ],
      generationConfig: { maxOutputTokens: 200 }
    });

    const reply = result?.response?.text() || "⚠️ No response from Gemini.";
    bot.sendMessage(chatId, "📄 Document summary:\n\n" + reply);

  } catch (err) {
    console.error("❌ Document analysis error:", err);
    bot.sendMessage(chatId, "⚠️ Could not analyze your document.");
  }
});


//image analysis
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;

  //force join
  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  
  const photo = msg.photo[msg.photo.length - 1]; // largest size

  bot.sendChatAction(chatId, "typing");

  //added limit to 3
  if (!checkLimit(chatId, "img", 3)) {
    bot.sendMessage(chatId, "⚠️ Daily image analysis limit reached (3). Try again tomorrow.");
    return;
  }
  

  try {
    const fileBuffer = await downloadFile(photo.file_id);
    const base64Image = fileBuffer.toString("base64");

    const result = await model.generateContent([
      "Describe this image clearly.",
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
    ]);

    const reply = result?.response?.text() || "⚠️ No response from Gemini.";
    bot.sendMessage(chatId, "🖼️ Image analysis:\n\n" + reply);

  } catch (err) {
    console.error("❌ Image analysis error:", err);
    bot.sendMessage(chatId, "⚠️ Could not analyze your image.");
  }
});


// --- Chat with Gemini ---
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  //force join
  if (!(await isUserMember(chatId))) {
    bot.sendMessage(chatId,
      `⚠️ You must join our channel first to use this bot.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: `https://t.me/${FORCE_JOIN_CHANNEL.replace("@","")}` }]
          ]
        }
      }
    );
    return;
  }
  
  const text = msg.text;

  if (text && text.startsWith("/")) return; // ignore commands & empty

  //if is not text
  if (msg.video || msg.audio || msg.voice || msg.sticker || msg.video_note || msg.animation || msg.contact || msg.location || msg.poll || msg.venue || msg.poll ||  msg.dice || msg.game || msg.invoice || msg.successful_payment || msg.pinned_message
  ) {
    bot.sendMessage(chatId, "⚠️ Only text, images, and documents are allowed.");
    return;
  }

  // Block pure link messages (optional)
  if (msg.text && /^https?:\/\//i.test(msg.text.trim())) {
    bot.sendMessage(chatId, "⚠️ Links are not allowed. Please send text, document, or image.");
    return;
  }


  //reply keywords
  if (text === "🔍 Search") {
    bot.sendMessage(chatId, "🔍 Please type your search like:\n`/search your query`", { parse_mode: "Markdown" });
    return;
  }

  if (text === "🎨 Imagine") {
    bot.sendMessage(chatId, "🎨 Please type your prompt like:\n`/imagine your prompt`", { parse_mode: "Markdown" });
    return;
  }

  if (text === "🤖 Set Model") {
    bot.sendMessage(chatId, "Type /setmodel to choose your model.");
    return;
  }

  if (text === "📄 Document Analysis") {
    bot.sendMessage(chatId, "Send any document and image for it's analysis.");
    return;
  }


  // Fetch or create user from DB
  let user = await User.findOne({ chatId });
  if (!user) {
    user = new User({
      chatId,
      requests: 0,
      lastReset: new Date(),
      usage: { tokensUsed: 0, resetDate: new Date() },
      messages: [],
    });
    await user.save();
  }

  // Reset request limits daily
  const today = new Date().toDateString();
  if (user.lastReset.toDateString() !== today) {
    user.requests = 0;
    user.lastReset = new Date();
  }

  // Reset token usage daily
  if (user.usage.resetDate.toDateString() !== today) {
    user.usage.tokensUsed = 0;
    user.usage.resetDate = new Date();
  }

  // Check request limit (20/day)
  if (user.requests >= 20) {
    bot.sendMessage(chatId, `⚠️ You’ve reached your daily request limit (20). Try again tomorrow.`);
    return;
  }

  // Estimate input tokens
  const inputTokens = Math.ceil(text.split(/\s+/).length * 1.3);

  // Check token limit (1000/day)
  if (user.usage.tokensUsed + inputTokens >= 1000) {
    bot.sendMessage(chatId, `⚠️ You’ve reached your daily token limit (1000). Try again tomorrow.`);
    return;
  }

  // Language
  const lang = userLanguages[chatId] || "en";

  try {
    bot.sendChatAction(chatId, "typing");

    // Get last 10 messages for context
    const history = user.messages
      .slice(-10)
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n");

    // Ask Gemini with output limit
    const selectedId = userSelectedModel[chatId] || "gemini";
    const chosen = MODELS[selectedId];

    // If model has no API key, block the request
    if (!chosen.key) {
      bot.sendMessage(chatId, "⚠ This model is not available right now. Please choose another using /setmodel");
      return;
    }

    let reply = "";

    if (chosen.type === "gemini") {
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: `Answer in ${LANGUAGES[lang]} (${lang})\n\nConversation so far:\n${history}\n\nUser: ${text}` }],
          },
        ],
        generationConfig: { maxOutputTokens: 100 },
      });

      reply = result?.response?.text() || "⚠️ No response from Gemini.";
    } else if (chosen.type === "openai") {
      //if api key is not available then 
      if (!process.env.OPENAI_API_KEY) {
        bot.sendMessage(chatId, "⚠ This model is not available right now.");
        return;
      }
      //other wise normal response 
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: `Answer in ${LANGUAGES[lang]} (${lang})\n\nConversation so far:\n${history}\n\nUser: ${text}` }
        ],
        max_tokens: 100
      });

      reply = result.choices[0].message.content || "⚠ No response from OpenAI.";
    } else if (chosen.type === "claude") {
      //if api is not available
      if (!process.env.CLAUDE_API_KEY) {
        bot.sendMessage(chatId, "⚠ This model is not available right now.");
        return;
      }
      //otherwise normal response
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `Answer in ${LANGUAGES[lang]} (${lang})\n\nConversation so far:\n${history}\n\nUser: ${text}`
          }
        ]
      });

      reply = response.content?.[0]?.text || "⚠ No response from Claude.";
    } else if (chosen.type === "gemini-1.5-flash-002") {
      const result = await model.generateContent({
        model: "gemini-1.5-flash-002",
        contents: [
          {
            role: "user",
            parts: [{ text: `Answer in ${LANGUAGES[lang]} (${lang})\n\nConversation so far:\n${history}\n\nUser: ${text}` }],
          },
        ],
        generationConfig: { maxOutputTokens: 100 },
      });

      reply = result?.response?.text() || "⚠️ No response from Gemini.";
    } else if (chosen.type === "gemini-1.5-pro") {
      //added limit here
      if (!checkLimit(chatId, "proTokens", 5)) {
        bot.sendMessage(chatId, "⚠️ Gemini-Pro usage limit reached (5 messages/day).");
        return;
      }
      
      const result = await model.generateContent({
        model: "gemini-1.5-pro",
        contents: [
          {
            role: "user",
            parts: [{ text: `Answer in ${LANGUAGES[lang]} (${lang})\n\nConversation so far:\n${history}\n\nUser: ${text}` }],
          },
        ],
        generationConfig: { maxOutputTokens: 100 },
      });

      reply = result?.response?.text() || "⚠️ No response from Gemini.";
    }

    // Later you will add:
    // else if (chosen.type === "openai") { ... }
    // else if (chosen.type === "claude") { ... }


    // Estimate output tokens
    const outputTokens = Math.ceil(reply.split(/\s+/).length * 1.3);

    // Final check for token limit
    if (user.usage.tokensUsed + inputTokens + outputTokens > 1000) {
      bot.sendMessage(chatId, "⚠️ This reply would exceed your daily token limit (1000). Try again tomorrow.");
      return;
    }

    // Save conversation in MongoDB
    user.messages.push({ role: "user", text });
    user.messages.push({ role: "bot", text: reply });

    //limit number of chat saved
    if (user.messages.length > 50) {
      user.messages = user.messages.slice(-50);
    }

    // Update usage
    user.requests += 1;
    user.usage.tokensUsed += inputTokens + outputTokens;
    await user.save();

    // Reply with usage info
    bot.sendMessage(
      chatId,
      reply + `\n\n🪙 Requests left: ${20 - user.requests}, Tokens left: ${1000 - user.usage.tokensUsed}`
    );
  } catch (err) {
    console.error("❌ BOT ERROR:", err);
    bot.sendMessage(chatId, "⚠️ Error: Could not process your request.");
  }
});

//broadcast 
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.chat.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "⚠️ Unauthorized");
  }

  const message = match[1];

  try {
    const users = await User.find({});
    let success = 0, failed = 0;

    for (const u of users) {
      try {
        await bot.sendMessage(u.chatId, `📢 Broadcast from Admin:\n\n${message}`);
        success++;
      } catch (err) {
        console.warn(`⚠️ Could not send to ${u.chatId}: ${err.message}`);
        failed++;
      }
    }

    bot.sendMessage(
      ADMIN_ID,
      `✅ Broadcast sent to ${success} users.\n⚠️ Failed to send to ${failed} users.`
    );
  } catch (err) {
    console.error("❌ Broadcast error:", err);
    bot.sendMessage(ADMIN_ID, "⚠️ Failed to send broadcast.");
  }
});


//usage
bot.onText(/\/usage/, async (msg) => {
  if (msg.chat.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "⚠️ Unauthorized");
  }

  try {
    const users = await User.find({});
    const today = getToday();

    let report = `📊 *Usage Report* (${today})\n━━━━━━━━━━━━━\n`;

    for (const u of users) {
      const usage = userUsage[u.chatId] || { search: 0, imagine: 0, doc: 0, img: 0, proTokens: 0, date: today };

      report += `
👤 ID: \`${u.chatId}\`
Requests: ${u.requests}, Tokens: ${u.usage?.tokensUsed || 0}
🔍 ${usage.search || 0} | 🎨 ${usage.imagine || 0} | 📄 ${usage.doc || 0} | 🖼️ ${usage.img || 0} | 🤖 ${usage.proTokens || 0}
━━━━━━━━━━━━━`;
    }

    bot.sendMessage(ADMIN_ID, report, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("❌ Usage report error:", err);
    bot.sendMessage(ADMIN_ID, "⚠️ Failed to generate usage report.");
  }
});
