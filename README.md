# 🤖 AI Assistant Telegram Bot

A powerful, feature-rich Telegram bot acting as your private AI companion. This bot integrates **Google Gemini, OpenAI, and Claude** to provide intelligent conversations, image generation, web searches, and document analysis.

It includes a robust **User Management System** (via MongoDB) to track usage, enforce limits, and manage access (Public/Private modes).

---

## ✨ Key Features

* **🧠 Multi-Model Support:** Switch between Gemini (Flash/Pro), GPT-4o, and Claude 3.
* **💬 Intelligent Chat:** Context-aware conversations with memory (stores last 10 messages).
* **🔍 Web Search:** Real-time web search capabilities using Serper API.
* **🎨 Image Generation:** Create images from text prompts (via Pollinations AI).
* **👁️ Image Vision:** Send photos to ask questions about them (uses Gemini Vision).
* **📄 Document Analysis:** Summarize and analyze PDF, DOCX, and TXT files.
* **🛡️ Admin Controls:**
    * Public vs. Private mode (whitelist specific users).
    * Broadcast messages to all users.
    * View usage reports and analytics.
* **📉 Rate Limiting:** Built-in daily limits for requests, tokens, and media to prevent abuse.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following:

1.  **Node.js** (v18 or higher) installed.
2.  **MongoDB Database** (You can get a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)).
3.  **Telegram Bot Token** (Get it from [@BotFather](https://t.me/BotFather)).
4.  **API Keys** for the AI services you wish to use (Gemini is required; OpenAI/Claude are optional).

---

## 🚀 Environment Configuration

Create a file named `.env` in the root of your project directory. Copy and paste the keys below and fill in your details:

    # 🤖 Telegram Bot Token (Required)
    # Get this from @BotFather on Telegram
    TELEGRAM_TOKEN=your_telegram_bot_token_here
    
    # 🧠 AI API Keys (Gemini is Required)
    # Get Gemini key: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
    GEMINI_API_KEY=your_gemini_api_key_here
    
    # Optional: Add these if you want to use OpenAI or Claude models
    # OPENAI_API_KEY=sk-...
    # CLAUDE_API_KEY=sk-...
    
    # 💾 Database (Required)
    # Connection string from MongoDB Atlas
    MONGODB_CONNECT=mongodb+srv://user:pass@cluster.mongodb.net/Telegram
    
    # 🔍 Search Capability (Required for /search)
    # Get a free key: [https://serper.dev/](https://serper.dev/)
    SERPER_API_KEY=your_serper_api_key_here
    
    # 🌐 Deployment URL (Required for Webhooks)
    # The URL where your bot is hosted (e.g., [https://my-bot.onrender.com](https://my-bot.onrender.com))
    # If running locally, you need a tunnel like Ngrok.
    RENDER_URL=[https://your-app-url.onrender.com](https://your-app-url.onrender.com)
    
    # 👮 Admin & Security
    # Your Telegram User ID (get it from @userinfobot)
    ADMIN_ID=123456789
    
    # Force users to join this channel to use the bot (Optional)
    # Leave empty if not needed. Format: @channelname
    FORCE_JOIN_CHANNEL=@your_channel

---

## 📦 Installation & Local Setup

1.  **Clone the repository:**

        git clone https://github.com/Aman-20/Telegram_bot.git
        cd Telegram_bot

2.  **Install dependencies:**

        npm install

3.  **Start the bot:**

        npm start

    *Note: Since this bot uses Webhooks, running it locally requires a public URL. We recommend using **Render** for easy deployment.*

---

## ☁️ Deployment Guide (Render.com)

This bot is optimized for **Render**, but works on Heroku, Railway, or any VPS.

1.  **Push your code to GitHub.**
2.  Go to [Render.com](https://render.com) and create a new **Web Service**.
3.  Connect your GitHub repository.
4.  **Settings:**
    * **Runtime:** Node
    * **Build Command:** `npm install`
    * **Start Command:** `npm start`
5.  **Environment Variables:**
    * Scroll down to "Environment Variables" and add all the keys from the `.env` section above.
    * **Crucial:** For `RENDER_URL`, enter the URL Render assigns to you (e.g., `https://my-bot.onrender.com`).
6.  Click **Deploy**.

Once deployed, the bot will automatically set the Webhook to your Render URL.

---

## 🎮 Commands

### 👤 User Commands

| Command | Description |
| :--- | :--- |
| `/start` | Initialize the bot. |
| `/help` | Show the list of available commands. |
| `/search <query>` | Search the web for information. |
| `/imagine <prompt>` | Generate an image using AI. |
| `/setmodel` | Switch between Gemini, GPT, or Claude. |
| `/account` | Check your daily usage, token limits, and stats. |
| `/language` | Change the bot's response language. |
| `/clearchat` | Clear your conversation history memory. |

### 👮 Admin Commands (Only for `ADMIN_ID`)

| Command | Description |
| :--- | :--- |
| `/status` | Check if you are an admin. |
| `/broadcast <msg>` | Send a message to all bot users. |
| `/usage` | View a report of today's total usage. |
| `/users` | List all approved users (in Private Mode). |
| `/approve <id>` | Grant access to a user for 24 hours. |
| `/remove <id>` | Revoke a user's access. |
| `/public` | Open the bot to everyone. |
| `/private` | Lock the bot (whitelist only). |

---

## 📂 Project Structure

* `bot.js` - Main entry point containing all logic.
* `views/` - EJS templates for the home/privacy pages.
* `.env` - API keys and configuration.

---

## 📜 License & Terms

This bot is for educational and personal use.
* **Privacy:** Chat history is stored in MongoDB for context but can be cleared by the user at any time.
* **AI Disclaimer:** Responses are generated by AI and may be inaccurate.

---

**Made with ❤️ using Node.js and Gemini**
