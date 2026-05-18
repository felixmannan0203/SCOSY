/**
 * SCOSY AI — Dedicated Module
 * Handles the AI chat section: greeting, message rendering,
 * typing indicator, and connect-to-admin flow.
 *
 * Depends on:
 *   - window.currentUser  (set by student.js after login)
 *   - window.showSection  (navigation helper from student.js)
 *   - window.toast        (toast helper from student.js)
 */

(function () {
    'use strict';

    /* ---- Helpers ---- */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTime() {
        return new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    }

    function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    }

    function getThread() {
        return document.getElementById('scosyAiMessages');
    }

    /* ---- Render a message row ---- */
    function appendMessage(text, sender, withConnectBtn) {
        const thread = getThread();
        if (!thread) return;

        const isAI = sender === 'ai';
        const row = document.createElement('div');
        row.className = `sai-row ${isAI ? 'sai-row--ai' : 'sai-row--user'}`;

        if (isAI) {
            row.innerHTML = `
                <div class="sai-avatar"><i class="fas fa-robot"></i></div>
                <div class="sai-body">
                    <div class="sai-bubble sai-bubble--ai">${escapeHtml(text)}</div>
                    <div class="sai-time">${formatTime()}</div>
                </div>`;

            if (withConnectBtn) {
                const bubble = row.querySelector('.sai-bubble--ai');
                const btn = document.createElement('button');
                btn.className = 'sai-connect-btn';
                btn.innerHTML = '<i class="fas fa-headset"></i> Connect to Admin';
                btn.onclick = () => {
                    if (window.showSection) window.showSection('chat');
                    if (window.toast) window.toast('Connecting you to the admin team…', 'info');
                };
                bubble.appendChild(document.createElement('br'));
                bubble.appendChild(document.createElement('br'));
                bubble.appendChild(btn);
            }
        } else {
            row.innerHTML = `
                <div class="sai-body">
                    <div class="sai-bubble sai-bubble--user">${escapeHtml(text)}</div>
                    <div class="sai-time sai-time--right">${formatTime()}</div>
                </div>`;
        }

        thread.appendChild(row);
        thread.scrollTop = thread.scrollHeight;
    }

    /* ---- Typing indicator ---- */
    function showTyping() {
        const thread = getThread();
        if (!thread) return;
        const row = document.createElement('div');
        row.className = 'sai-row sai-row--ai';
        row.id = 'scosyTypingIndicator';
        row.innerHTML = `
            <div class="sai-avatar"><i class="fas fa-robot"></i></div>
            <div class="sai-body">
                <div class="sai-bubble sai-bubble--ai sai-typing">
                    <span class="sai-dot"></span>
                    <span class="sai-dot"></span>
                    <span class="sai-dot"></span>
                </div>
            </div>`;
        thread.appendChild(row);
        thread.scrollTop = thread.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('scosyTypingIndicator');
        if (el) el.remove();
    }

    /* ---- Core AI object ---- */
    const ScosyAI = {
        greeted: false,

        greet() {
            if (this.greeted) return;
            this.greeted = true;
            const user = window.currentUser;
            const name = user ? user.name.split(' ')[0] : 'there';
            setTimeout(() => {
                appendMessage(
                    `${getGreeting()}, ${name}! 👋 I'm SCOSY AI, your virtual assistant. How can I help you today?`,
                    'ai', false
                );
            }, 300);
        },

        respond() {
            showTyping();
            setTimeout(() => {
                removeTyping();
                appendMessage(
                    `Thanks for your question! I've noted it. For the best help, let me connect you to one of our admin team members who can assist you directly.`,
                    'ai', true
                );
            }, 1400);
        },

        send() {
            const input = document.getElementById('scosyAiInput');
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            appendMessage(text, 'user', false);
            input.value = '';
            this.respond();
        }
    };

    /* ---- Expose globals ---- */
    window.ScosyAI      = ScosyAI;
    window.scosyAiSend  = () => ScosyAI.send();
    window.scosyAiKeydown = (e) => { if (e.key === 'Enter') ScosyAI.send(); };

})();
