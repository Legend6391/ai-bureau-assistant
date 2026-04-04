/**
 * GOV-AI Dashboard Controller
 * ============================
 * Handles:
 *  1. Trie-based Smart Search (services + user documents from Supabase)
 *  2. Dynamic Document-Count Stat Card (live from Supabase)
 *  3. Quick Actions Navigation
 *  4. Stat Card Navigation (click-to-navigate)
 */

import { auth } from "../firebase/config.js";
import { supabase } from "../Supabase/supabaseConfig.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

// ============================================================
// §1  TRIE DATA STRUCTURE
// Efficient prefix-based search used for O(L) query time
// where L = length of the search prefix.
// ============================================================

class TrieNode {
    constructor() {
        this.children = {};    // char → TrieNode
        this.resultIds = [];   // array of SearchResult indices stored at this node
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
        this.catalog = [];     // master list of SearchResult objects
    }

    /**
     * Add a search result to the catalog and index all its keywords into the trie.
     * Each keyword is inserted character-by-character; every node along the path
     * stores a reference to this result so prefix lookups work in O(L).
     */
    addResult(result) {
        const idx = this.catalog.length;
        this.catalog.push(result);

        for (const keyword of result.keywords) {
            this._insertWord(keyword.toLowerCase(), idx);
        }
    }

    _insertWord(word, idx) {
        let node = this.root;
        for (const ch of word) {
            if (!node.children[ch]) node.children[ch] = new TrieNode();
            node = node.children[ch];
            // Store index only once per node (avoid duplicates)
            if (!node.resultIds.includes(idx)) {
                node.resultIds.push(idx);
            }
        }
    }

    /**
     * Return a de-duplicated, ordered list of SearchResult objects
     * matching the given prefix.  Results are sorted by relevance score
     * (services first by priority, documents alphabetically).
     */
    query(prefix) {
        if (!prefix || prefix.trim() === "") return [];
        const lc = prefix.trim().toLowerCase();
        let node = this.root;
        for (const ch of lc) {
            if (!node.children[ch]) return [];
            node = node.children[ch];
        }

        // Gather unique indices and map to catalog entries
        const seen = new Set();
        const results = [];
        for (const idx of node.resultIds) {
            if (!seen.has(idx)) {
                seen.add(idx);
                results.push(this.catalog[idx]);
            }
        }

        // Sort: services first (lower priority number = higher rank), then docs
        results.sort((a, b) => {
            if (a.type !== b.type) return a.type === "service" ? -1 : 1;
            return (a.priority || 99) - (b.priority || 99);
        });

        return results;
    }
}

// ============================================================
// §2  SERVICE DIRECTORY
// All navigable sections with their keywords & metadata.
// ============================================================

const SERVICE_DIRECTORY = [
    {
        type: "service",
        section: "overview",
        label: "Dashboard Overview",
        desc: "View your stats and quick actions",
        icon: "dashboard",
        priority: 1,
        keywords: ["dashboard", "overview"]
    },
    {
        type: "service",
        section: "profile",
        label: "My Profile",
        desc: "View and edit your citizen profile",
        icon: "person",
        priority: 2,
        keywords: ["my", "profile", "my profile"]
    },
    {
        type: "service",
        section: "documents",
        label: "Document Management",
        desc: "Browse your secure document vault",
        icon: "folder_open",
        priority: 3,
        keywords: ["document", "documents", "management", "vault", "manage", "files"]
    },
    {
        type: "service",
        section: "upload",
        label: "Upload & OCR",
        desc: "Upload documents and extract data with AI",
        icon: "cloud_upload",
        priority: 4,
        keywords: ["upload", "ocr", "scan", "extract", "autofill"]
    },
    {
        type: "service",
        section: "status",
        label: "Application Status",
        desc: "Track your government applications",
        icon: "track_changes",
        priority: 5,
        keywords: ["application", "status", "pending"]
    },
    {
        type: "service",
        section: "open-chatbot",
        label: "AI Chatbot",
        desc: "Open AI Chatbot",
        icon: "chat_bubble",
        priority: 6,
        keywords: ["AI", "chat", "bot", "chatbot"]
    }
];

// ============================================================
// §3  DASHBOARD CONTROLLER
// ============================================================

class DashboardController {
    constructor() {
        this.trie = new Trie();
        this.userDocuments = [];   // Populated from Supabase once auth resolves
        this.currentUser = null;
        this.searchTimeout = null;

        // DOM refs
        this.searchInput = document.getElementById("global-search-input");
        this.dropdown = document.getElementById("search-results-dropdown");
        this.resultsList = document.getElementById("search-results-list");
        this.noResults = document.getElementById("search-no-results");
        this.statDocCount = document.getElementById("stat-doc-count");
        this.statDocSub = document.getElementById("stat-doc-sub");
        this.docRingProgress = document.getElementById("doc-ring-progress");
        this.docRingPct = document.getElementById("doc-ring-pct");

        this._buildServiceIndex();
        this._setupSearch();
        this._setupQuickActions();
        this._setupStatCardNavigation();
        this._waitForAuth();
    }

    // ----------------------------------------------------------
    // Build the Trie index from the static service directory
    // ----------------------------------------------------------
    _buildServiceIndex() {
        for (const service of SERVICE_DIRECTORY) {
            this.trie.addResult(service);
        }
    }

    // ----------------------------------------------------------
    // Index user's documents fetched from Supabase into the Trie
    // ----------------------------------------------------------
    _indexDocuments(docs) {
        for (const doc of docs) {
            const name = (doc.fileName || "").replace(/\.[^.]+$/, ""); // strip extension
            const words = name.toLowerCase().split(/[\s_\-\.]+/).filter(Boolean);
            this.trie.addResult({
                type: "document",
                section: "documents",
                docId: doc.id,
                label: doc.fileName || "Document",
                desc: `Uploaded ${doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ""}`,
                icon: (doc.fileType || "").includes("pdf") ? "picture_as_pdf" : "image",
                keywords: [doc.fileName?.toLowerCase() || "", ...words, "document", "file"]
            });
        }
    }

    // ----------------------------------------------------------
    // Wait for Firebase auth, then load Supabase data
    // ----------------------------------------------------------
    _waitForAuth() {
        onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            this.currentUser = user;
            await Promise.all([
                this._loadDocumentCount(user.uid),
                this._loadDocumentsForSearch(user.uid)
            ]);
        });
    }

    // ----------------------------------------------------------
    // Fetch document count and update the Dashboard stat card
    // ----------------------------------------------------------
    async _loadDocumentCount(uid) {
        try {
            const { count, error } = await supabase
                .from("documents")
                .select("id", { count: "exact", head: true })
                .eq("user_id", uid);

            if (error) throw error;

            const n = count || 0;
            this._updateDocCard(n);

            // Expose globally so documents.js can call this after an upload
            window._govAiUpdateDocCount = (newCount) => this._updateDocCard(newCount);

        } catch (err) {
            console.error("Dashboard: failed to load doc count", err);
            if (this.statDocCount) this.statDocCount.textContent = "—";
            if (this.statDocSub) this.statDocSub.textContent = "Could not load";
        }
    }

    // ----------------------------------------------------------
    // Fetch documents for full-text document search
    // ----------------------------------------------------------
    async _loadDocumentsForSearch(uid) {
        try {
            const { data, error } = await supabase
                .from("documents")
                .select("id, fileName, fileType, created_at")
                .eq("user_id", uid)
                .order("created_at", { ascending: false });

            if (error) throw error;
            this.userDocuments = data || [];
            this._indexDocuments(this.userDocuments);
        } catch (err) {
            console.error("Dashboard: failed to load docs for search", err);
        }
    }

    // ----------------------------------------------------------
    // Update the Documents Store card (count + ring animation)
    // ----------------------------------------------------------
    _updateDocCard(count) {
        if (!this.statDocCount) return;

        // Animate number
        this.statDocCount.textContent = count;

        // Update sub-label
        if (this.statDocSub) {
            this.statDocSub.textContent = count === 0
                ? "No documents yet"
                : `${count} file${count !== 1 ? "s" : ""} in vault`;
        }

        // Animate the SVG ring — max visual fill at 20 docs (100%)
        const maxDocs = 20;
        const pct = Math.min(Math.round((count / maxDocs) * 100), 100);
        if (this.docRingProgress) {
            this.docRingProgress.setAttribute(
                "stroke-dasharray",
                `${pct}, 100`
            );
        }
        if (this.docRingPct) {
            this.docRingPct.textContent = `${pct}%`;
        }
    }

    // ----------------------------------------------------------
    // Smart Search — event wiring
    // ----------------------------------------------------------
    _setupSearch() {
        if (!this.searchInput) return;

        this.searchInput.addEventListener("input", () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this._runSearch(this.searchInput.value);
            }, 120); // 120 ms debounce
        });

        this.searchInput.addEventListener("focus", () => {
            if (this.searchInput.value.trim()) this._runSearch(this.searchInput.value);
        });

        // Keyboard navigation
        this.searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this._closeDropdown();
            if (e.key === "Enter") this._selectFirst();
            if (e.key === "ArrowDown") {
                e.preventDefault();
                const first = this.resultsList?.querySelector(".search-result-item");
                first?.focus();
            }
        });

        // Close dropdown on outside click
        document.addEventListener("click", (e) => {
            if (!document.getElementById("search-wrapper")?.contains(e.target)) {
                this._closeDropdown();
            }
        });

        // Keyboard navigation inside dropdown
        this.resultsList?.addEventListener("keydown", (e) => {
            const items = [...this.resultsList.querySelectorAll(".search-result-item")];
            const idx = items.indexOf(document.activeElement);
            if (e.key === "ArrowDown" && idx < items.length - 1) {
                e.preventDefault();
                items[idx + 1].focus();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (idx > 0) items[idx - 1].focus();
                else this.searchInput.focus();
            } else if (e.key === "Escape") {
                this._closeDropdown();
                this.searchInput.focus();
            }
        });
    }

    // ----------------------------------------------------------
    // Execute search and render results
    // ----------------------------------------------------------
    _runSearch(query) {
        if (!query.trim()) {
            this._closeDropdown();
            return;
        }

        const results = this.trie.query(query);
        this._renderDropdown(results);
    }

    // ----------------------------------------------------------
    // Render the search results dropdown
    // ----------------------------------------------------------
    _renderDropdown(results) {
        if (!this.resultsList || !this.dropdown) return;
        this.resultsList.innerHTML = "";

        if (results.length === 0) {
            this.noResults?.classList.remove("hidden");
            this.dropdown.classList.remove("hidden");
            return;
        }

        this.noResults?.classList.add("hidden");

        // Group: services then documents
        const services = results.filter(r => r.type === "service");
        const docs = results.filter(r => r.type === "document");

        if (services.length > 0) this._renderGroup("Services", services);
        if (docs.length > 0) this._renderGroup("Your Documents", docs);

        this.dropdown.classList.remove("hidden");
    }

    _renderGroup(title, items) {
        // Group header
        const header = document.createElement("div");
        header.className = "px-4 pt-3 pb-1 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest";
        header.textContent = title;
        this.resultsList.appendChild(header);

        for (const item of items) {
            const el = this._createResultItem(item);
            this.resultsList.appendChild(el);
        }
    }

    _createResultItem(item) {
        const btn = document.createElement("button");
        btn.className = "search-result-item w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:outline-none text-left";
        btn.setAttribute("tabindex", "0");

        const iconColor = item.type === "document"
            ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30"
            : "bg-blue-50 text-primary dark:bg-blue-900/30";

        btn.innerHTML = `
            <div class="h-8 w-8 rounded-xl ${iconColor} flex items-center justify-center shrink-0">
                <span class="material-icons-outlined text-[16px]">${item.icon}</span>
            </div>
            <div class="flex-1 overflow-hidden">
                <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${item.label}</p>
                <p class="text-[10px] text-slate-400 truncate">${item.desc}</p>
            </div>
            <span class="material-icons-outlined text-slate-300 text-base shrink-0">chevron_right</span>
        `;

        btn.addEventListener("click", () => this._navigateTo(item));
        return btn;
    }

    // ----------------------------------------------------------
    // Navigate to the section that a search result points to
    // ----------------------------------------------------------
    _navigateTo(item) {
        this._closeDropdown();
        if (this.searchInput) this.searchInput.value = "";

        // Special sections that trigger actions rather than hash navigation
        if (item.section === "open-chatbot") {
            if (window.govChatbot) {
                window.govChatbot.toggleChat();
            } else {
                // Fallback: chatbot not yet initialised — click the launcher directly
                document.getElementById("chat-launcher")?.click();
            }
            return;
        }

        // Standard hash-based routing for all real sections
        window.location.hash = item.section;

        // If it's a document result, highlight it after the section loads
        if (item.type === "document" && item.docId) {
            setTimeout(() => this._highlightDocument(item.docId), 400);
        }
    }

    _highlightDocument(docId) {
        const card = document.getElementById(`doc-card-${docId}`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => card.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2500);
    }

    // ----------------------------------------------------------
    // Select the first dropdown result on Enter
    // ----------------------------------------------------------
    _selectFirst() {
        const first = this.resultsList?.querySelector(".search-result-item");
        if (first) first.click();
    }

    _closeDropdown() {
        this.dropdown?.classList.add("hidden");
        this.resultsList && (this.resultsList.innerHTML = "");
    }

    // ----------------------------------------------------------
    // Quick Actions — data-attribute-driven navigation
    // ----------------------------------------------------------
    _setupQuickActions() {
        document.querySelectorAll(".quick-action-nav").forEach(btn => {
            btn.addEventListener("click", () => {
                const section = btn.dataset.qaNavigate;
                const action = btn.dataset.qaAction;

                if (section) {
                    window.location.hash = section;
                } else if (action === "open-chatbot") {
                    // Toggle the chatbot widget
                    if (window.govChatbot) {
                        window.govChatbot.toggleChat();
                    } else {
                        // Fallback: chatbot not loaded yet — try the launcher button
                        document.getElementById("chat-launcher")?.click();
                    }
                }
            });
        });
    }

    // ----------------------------------------------------------
    // Stat Card Navigation — click card → navigate to section
    // ----------------------------------------------------------
    _setupStatCardNavigation() {
        document.querySelectorAll("[data-navigate]").forEach(card => {
            card.addEventListener("click", () => {
                const section = card.dataset.navigate;
                if (section) window.location.hash = section;
            });

            // Visual cursor hint already set via `cursor-pointer` in HTML
        });
    }
}

// ============================================================
// §4  GLOBAL DOC COUNT BRIDGE
// documents.js calls this after every upload / delete
// so the overview card stays in sync without a page reload.
// ============================================================

/**
 * Called by documents.js after a successful upload.
 * documents.js places the actual new count from its own DOM knowledge.
 */
window._govAiIncrementDocCount = () => {
    const el = document.getElementById("stat-doc-count");
    if (!el) return;
    const current = parseInt(el.textContent, 10) || 0;
    const next = current + 1;
    window._govAiUpdateDocCount?.(next);
};

window._govAiDecrementDocCount = () => {
    const el = document.getElementById("stat-doc-count");
    if (!el) return;
    const current = parseInt(el.textContent, 10) || 0;
    const next = Math.max(0, current - 1);
    window._govAiUpdateDocCount?.(next);
};

// ============================================================
// §5  BOOT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    window._govAiDashboard = new DashboardController();
});
