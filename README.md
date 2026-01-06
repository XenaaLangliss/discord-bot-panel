# 🤖 Discord Bot Control Panel v1.0

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18.x--21.x-green)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Deploy](https://img.shields.io/badge/Deploy-Railway%20%7C%20Docker%20%7C%20VPS-orange)
![Bots](https://img.shields.io/badge/Bots-Discord-brightgreen)

**Web-based control panel for managing Discord bots easily!**

---

## Features

- 🔐 **Login System** - Username & password protection
- 📦 **File Upload** - Upload bot files (.js, .json, .zip, dll)
- 🚀 **Bot Control** - Start, Stop, Restart, Kill
- 📊 **Live Console** - Real-time log monitoring
- 💾 **Memory Monitor** - View RAM usage
- ⏱️ **Uptime Tracker** - Online time tracking
- 🔧 **Multi Node.js** - Switch Node.js versions
- 📱 **Mobile Responsive** - Responsive UI

---

## 🚀 Quick Deploy

### One-Click Railway Deployment
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/zln0Si)

## 📖 How to Use

### Upload Bot Files
- Upload `.zip` file (recommended) or individual files
- Supported: `.js`, `.json`, `.txt`, `.env`, `.md`, `.zip`

### Set Bot Token
1. Get token from [Discord Developer Portal](https://discord.com/developers/applications)
2. Paste in panel → Settings → Bot Token → Save

### Start Bot
1. Open Console page
2. Click **"Start Bot"**
3. View real-time logs

### Controls
- **Start** - Start bot
- **Stop** - Stop gracefully
- **Restart** - Restart bot
- **Kill** - Force terminate
- **Clear Logs** - Clear logs

---

## ⚙️ Environment Variables

**Required:**
| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `USERNAME` | Login username | `admin` |
| `PASSWORD` | Login password | `admin123` |

**Optional:**
| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | Session encryption | Random string |
| `DEFAULT_NODE_VERSION` | Node.js version | `18.17.0` |
| `NODE_ENV` | Environment | `production` |

---

## 🐛 Quick Fixes

- **Login failed?** Check credentials in Railway Variables
- **Bot won't start?** Verify bot token and check console logs
- **File upload failed?** Max 20MB per file, check file type

---

## 📦 Project Structure

```
discord-bot-panel/
├── server.js              # Main server
├── public/                # Frontend files
├── bot_files/             # Bot storage
└── package.json           # Dependencies
```

---

## 📝 License

MIT License - Free to use!