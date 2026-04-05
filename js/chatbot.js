/**
 * AI-Powered Bureaucracy Assistant Chatbot (Gemini Powered via Vercel API)
 * Handles UI, Personalized AI Logic, Voice Input, and History Persistence
 */

class BureaucracyChatbot {
    constructor() {
        this.isOpen = false;
        this.isTyping = false;
        this.isListening = false;
        this.recognition = null;

        // Chat history storage
        this.messages = [];
        this.STORAGE_KEY = 'gov_ai_chat_history';

        // System Prompt for Gemini
        this.systemPrompt = `
You are the "AI Bureaucracy Assistant" for a government digital services portal.
Your goal is to provide clear, professional, and personalized guidance to citizens.

ANSWERING RULES:
1. If the question is simple like: "Who are you?", "What's your name?". Just answer it simply. Do not need to specify website features.
2. Answer to the question always.

WEBSITE FEATURES TO REFERENCE:
1. "Upload & OCR": Users can upload ID cards (Aadhaar, PAN, DL). The system automatically extracts data to fill their profile.
2. "My Profile": A digital identity vault where personal details are stored securely.
3. "Document Management": A secure repository for all uploaded citizen documents.
4. "Application Status": Real-time tracking for all submitted government applications.
5. "Security": We use SSL and government-grade encryption.(Only once during introduction)

PERSONALIZATION RULES:
- If you know the user's name, use it.
- If you know their Citizen ID, you can reference it if relevant.
- Be concise, polite, and use a "Digital Officer" persona.
- If a query is unrelated to the website or bureaucracy, politely guide them back to the portal's features.
`;

        this.init();
    }

    init() {
        this.injectHTML();
        this.setupEventListeners();
        this.initSpeechRecognition();
        this.loadHistory();
    }

    injectHTML() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="chatbot-launcher" id="chat-launcher">
                <i class="fas fa-comment"></i>
            </div>
            <div class="chatbot-container" id="chat-container">
                <div class="chat-header">
                    <div class="chat-header-info">
                        <h3>AI Assistant</h3>
                        <p id="chat-subtitle">Personalized Guidance</p>
                    </div>
                    <div class="chat-header-actions">
                        <div class="chat-close" id="chat-close">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                </div>
                <div class="chat-body" id="chat-messages"></div>
                <div class="chat-input-area">
                    <div class="chat-input-wrapper">
                        <input type="text" class="chat-input" id="chat-input" placeholder="Ask me anything..." autocomplete="off">
                        <div class="mic-btn" id="mic-btn" title="Voice Input">
                            <i class="fas fa-microphone"></i>
                        </div>
                    </div>
                    <button class="send-btn" id="send-btn" disabled>
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="chat-footer">
                    <p>Powered by Gemini AI • Personalized Guidance</p>
                    <div class="secure-label">
                        <i class="fas fa-shield-alt"></i> 🔒 SECURE & PRIVATE INTERACTION
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        this.launcher = document.getElementById('chat-launcher');
        this.container = document.getElementById('chat-container');
        this.closeBtn = document.getElementById('chat-close');
        this.messagesContainer = document.getElementById('chat-messages');
        this.inputField = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.subtitle = document.getElementById('chat-subtitle');
    }

    setupEventListeners() {
        this.launcher.addEventListener('click', () => this.toggleChat());
        this.closeBtn.addEventListener('click', () => this.toggleChat());

        this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSendMessage();
        });

        this.inputField.addEventListener('input', () => {
            this.sendBtn.disabled = this.inputField.value.trim() === '';
        });

        this.messagesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const query = e.target.getAttribute('data-query');
                this.handleSendMessage(query);
            }
        });

        this.micBtn.addEventListener('click', () => this.toggleSpeech());
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.container.classList.toggle('active', this.isOpen);
        if (this.isOpen) {
            this.inputField.focus();
            this.launcher.style.transform = 'scale(0)';
            this.updateSubtitleWithUser();
        } else {
            this.launcher.style.transform = 'scale(1)';
        }
    }

    updateSubtitleWithUser() {
        const context = this.extractUserContext();
        if (context.userName) {
            this.subtitle.textContent = `Assisting ${context.userName.split(' ')[0]}`;
        }
    }

    extractUserContext() {
        const userName =
            document.getElementById('header-user-name')?.textContent?.trim() ||
            document.getElementById('view-full-name')?.textContent?.trim() || "";

        const citizenId =
            document.querySelector('p.text-\\[10px\\].text-slate-500.uppercase')?.textContent?.trim() || "";

        const activeSection =
            document.getElementById('section-title')?.textContent?.trim() || "Dashboard";

        return { userName, citizenId, activeSection };
    }

    saveHistory() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.messages));
    }

    loadHistory() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                this.messages = JSON.parse(stored);
                this.renderHistory();
            } catch {
                this.messages = [];
                this.renderInitialMessage();
            }
        } else {
            this.renderInitialMessage();
        }
    }

    renderHistory() {
        this.messagesContainer.innerHTML = '';
        this.messages.forEach(msg => {
            this.addMessageToUI(msg.type, msg.content, false);
        });
        this.scrollToBottom();
    }

    renderInitialMessage() {
        const text = "Hello! I am your AI Bureaucracy Assistant. How can I assist you today?";
        this.addMessage('ai', text);
    }

    async handleSendMessage(forcedText = null) {
        const text = forcedText || this.inputField.value.trim();
        if (!text || this.isTyping) return;

        this.addMessage('user', text);
        this.inputField.value = '';
        this.sendBtn.disabled = true;

        this.showTypingIndicator();

        try {
            const response = await this.getGeminiResponse(text);
            this.hideTypingIndicator();
            this.addMessage('ai', response);
        } catch {
            this.hideTypingIndicator();
            this.addMessage('ai', "I'm having trouble connecting right now.");
        }
    }

    async getGeminiResponse(userQuery) {
        const context = this.extractUserContext();

        const historyContext = this.messages.slice(-10).map(m =>
            `${m.type === 'user' ? 'User' : 'Assistant'}: ${m.content}`
        ).join('\n');

        const fullPrompt = `
${this.systemPrompt}

User: ${context.userName}
Citizen ID: ${context.citizenId}
Section: ${context.activeSection}

${historyContext}

Query: ${userQuery}
`;

        const response = await fetch(GOV_AI_CONFIG.API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        const data = await response.json();

        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";
    }

    addMessage(type, content) {
        this.messages.push({ type, content });
        this.saveHistory();
        this.addMessageToUI(type, content);
    }

    addMessageToUI(type, content) {
    const div = document.createElement('div');
    div.className = `chat-message ${type}-message`;

    // ✅ Convert Markdown to HTML
    const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // bold
        .replace(/\n/g, '<br>'); // line breaks

    div.innerHTML = formattedContent;

    this.messagesContainer.appendChild(div);
    this.scrollToBottom();
}

    showTypingIndicator() {
        this.isTyping = true;
        const div = document.createElement('div');
        div.id = 'typing';
        div.innerText = "Typing...";
        this.messagesContainer.appendChild(div);
    }

    hideTypingIndicator() {
        this.isTyping = false;
        document.getElementById('typing')?.remove();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();

        this.recognition.onresult = (e) => {
            this.inputField.value = e.results[0][0].transcript;
            this.handleSendMessage();
        };
    }

    toggleSpeech() {
        if (this.recognition) this.recognition.start();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.govChatbot = new BureaucracyChatbot();
});
