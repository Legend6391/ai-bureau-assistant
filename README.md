# AI-Bureacracy-Assistant

<div align="center">

# 🏛️ AI Bureau Assistant
### *Bridging Citizens and Government — One Smart Form at a Time*

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-ai--bureau--assistant.vercel.app-blue?style=for-the-badge)](https://ai-bureau-assistant.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Legend6391-black?style=for-the-badge&logo=github)](https://github.com/Legend6391/ai-bureau-assistant)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)](https://ai-bureau-assistant.vercel.app)

</div>

---

## 💡 What & Why

Government paperwork is slow, error-prone, and frustrating — especially for citizens who lack digital literacy. **AI Bureau Assistant** is a citizen-facing web platform that automates the most painful parts: identity management, document scanning, form auto-fill, and application tracking — all in one place.

> Built as a full-stack simulation of a real-world GovTech product, demonstrating practical integration of AI APIs, OCR, authentication, and database services.

---

## 🚀 Live Features

| Feature | Description |
|---|---|
| 🔐 **Auth System** | Secure login & registration via Firebase Authentication |
| 👤 **Profile Vault** | Encrypted personal data storage — fill forms once, use everywhere |
| 📄 **OCR Extraction** | Upload documents; AI auto-extracts fields using OCR API |
| ✍️ **Smart Auto-Fill** | One-click population of government application forms |
| 📊 **Application Dashboard** | Track all submitted applications and their real-time status |
| 🔔 **Deadline Alerts** | Notifications for renewals and upcoming deadlines |
| 💬 **NLP Query Engine** | Ask questions about procedures in plain English |
| 🌐 **Multi-language UI** | English, Hindi, Tamil support |

---

## 🛠️ Tech Stack

```
Frontend      →  HTML5 · CSS3 · Vanilla JavaScript
Auth          →  Firebase Authentication
Database      →  Supabase (PostgreSQL)
AI / OCR      →  External OCR API (via /api layer)
Deployment    →  Vercel (Serverless)
```

---

## 📁 Project Structure

```
ai-bureau-assistant/
├── index.html          # Landing page
├── pages/              # Login, Register, Dashboard, Forms
├── js/                 # Client-side logic & API calls
├── css/                # Styling
├── api/                # Serverless API endpoints (OCR, NLP)
├── firebase/           # Auth configuration
└── Supabase/           # DB schema & queries
```

---

## 🎯 Problem This Solves

- 🇮🇳 India processes **millions of government applications** annually — most still paper-based
- Citizens waste hours re-entering the same data across different portals
- Errors in forms lead to rejection delays of weeks or months
- Senior citizens and rural populations face significant access barriers

**This project proposes and prototypes a unified AI-driven portal** that eliminates repetitive data entry and reduces form errors using intelligent automation.

---

## ⚙️ Run Locally

```bash
git clone https://github.com/Legend6391/ai-bureau-assistant.git
cd ai-bureau-assistant

# No build step needed — open index.html in a browser
# Or use Live Server in VS Code
```

> Add your own Firebase and Supabase credentials in the respective config files before running.

---

## 🌱 Roadmap

- [ ] Aadhaar / DigiLocker API integration
- [ ] AI chatbot for guided form assistance
- [ ] Mobile-responsive PWA version
- [ ] Admin dashboard for government operators

---

<div align="center">

**Built with purpose. Designed for scale.**

[![Visit Project](https://img.shields.io/badge/Visit%20Live%20Project-%E2%86%92-brightgreen?style=for-the-badge)](https://ai-bureau-assistant.vercel.app)

</div>
