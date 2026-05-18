/**
 * SCOSY — Student Dashboard (Supabase)
 * Depends on: supabase-client.js
 */
(function () {
    'use strict';

    // ---- State ----
    let currentUser    = null;
    let currentProfile = null;
    let complaints     = [];
    let sessionTimer   = null;
    let sessionSeconds = 1800;
    let realtimeSubs   = [];

    // ---- DOM helpers ----
    const $ = (sel) => document.querySelector(sel);

    // ---- Utility ----
    function generateId(prefix = 'TKT') {
        return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ---- Toast ----
    window.toast = function toast(message, type = 'info') {
        const container = $('#toastContainer');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'circle-exclamation' : 'info-circle';
        el.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(100%)';
            setTimeout(() => el.remove(), 300);
        }, 4000);
    };

    // ---- Session timer ----
    function startSession() {
        sessionSeconds = 1800;
        updateSessionDisplay();
        if (sessionTimer) clearInterval(sessionTimer);
        sessionTimer = setInterval(() => {
            sessionSeconds--;
            updateSessionDisplay();
            if (sessionSeconds <= 0) {
                clearInterval(sessionTimer);
                toast('Session expired. Logging out.', 'error');
                logout();
            }
        }, 1000);
    }

    function updateSessionDisplay() {
        const m = Math.floor(sessionSeconds / 60).toString().padStart(2, '0');
        const s = (sessionSeconds % 60).toString().padStart(2, '0');
        const el = $('#sessionTimer');
        if (el) el.textContent = `${m}:${s}`;
    }

    function resetSessionTimer() { sessionSeconds = 1800; }

    // ---- Navigation ----
    function showSection(sectionName, linkElement) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        const target = $(`#${sectionName}-section`);
        if (target) target.classList.add('active');

        document.querySelectorAll('.menu-list a').forEach(a => a.classList.remove('active'));
        if (linkElement) linkElement.classList.add('active');

        if (sectionName === 'chat') {
            loadMessages();
        }
        if (sectionName === 'scosy-ai') {
            if (window.ScosyAI) window.ScosyAI.greet();
            setTimeout(() => { const i = $('#scosyAiInput'); if (i) i.focus(); }, 200);
        }
    }

    // ---- UI update ----
    function updateUserInterface() {
        if (!currentProfile) return;
        const firstName = currentProfile.name.split(' ')[0];
        const initials  = currentProfile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
        set('#welcomeName', firstName);
        set('#welcomeAvatar', initials);
        set('#userInitials', initials);
        set('#dropdownName', currentProfile.name);
        set('#dropdownMatric', currentProfile.matric || '');
        set('#dropdownAvatar', initials);
    }

    // ---- Stats ----
    async function updateStats() {
        const total    = complaints.length;
        const pending  = complaints.filter(c => c.status === 'pending').length;
        const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'answered').length;

        // Unread messages from DB
        const msgs = await Messages.getForStudent(currentUser.id).catch(() => []);
        const unread = msgs.filter(m => !m.read_by?.includes(currentUser.id)).length;

        const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
        set('#totalComplaints', total);
        set('#pendingComplaints', pending);
        set('#resolvedComplaints', resolved);
        set('#totalMessages', unread);
        set('#complaintBadge', total);
        set('#messageBadge', unread > 0 ? unread : '0');
    }

    // ---- Complaints ----
    async function loadComplaints() {
        if (!currentUser) return;
        try {
            complaints = await Complaints.getForStudent(currentUser.id);
            renderComplaints();
            updateStats();
        } catch (err) {
            console.error('Load complaints error:', err);
            toast('Failed to load complaints.', 'error');
        }
    }

    function renderComplaints(filteredList) {
        const container = $('#studentTicketList');
        if (!container) return;
        const list = filteredList !== undefined ? filteredList : complaints;

        if (list.length === 0) {
            container.innerHTML = '<p class="empty-state">No complaints filed yet</p>';
            return;
        }

        container.innerHTML = list.map(complaint => {
            const isAnswered  = complaint.status === 'answered';
            const hasResponse = complaint.response_count > 0;
            const answeredClass = isAnswered ? ' ticket-item--answered' : '';
            const answeredBadge = isAnswered
                ? `<span class="ticket-answered-badge"><i class="fas fa-reply"></i> New Response</span>` : '';
            const viewBtn = hasResponse
                ? `<button class="ticket-view-response-btn" onclick="showSection('chat')">
                       <i class="fas fa-comments"></i> View Response
                   </button>` : '';

            return `
            <div class="ticket-item${answeredClass}">
                <div class="ticket-header">
                    <div class="ticket-id">${complaint.id.substring(0, 8).toUpperCase()}</div>
                    <div class="ticket-status status-${complaint.status}">${complaint.status}</div>
                    ${answeredBadge}
                </div>
                <div class="ticket-content">
                    <h4>${escapeHtml(complaint.subject)}</h4>
                    <p>${escapeHtml(complaint.message.substring(0, 100))}${complaint.message.length > 100 ? '...' : ''}</p>
                    <div class="ticket-meta">
                        <span><i class="fas fa-tag"></i> ${complaint.category}</span>
                        <span><i class="fas fa-flag"></i> ${complaint.priority}</span>
                        <span><i class="fas fa-clock"></i> ${timeAgo(complaint.created_at)}</span>
                    </div>
                    ${viewBtn}
                </div>
            </div>`;
        }).join('');
    }

    function filterComplaints(status) {
        if (!status || status === 'all') {
            renderComplaints(complaints);
        } else {
            renderComplaints(complaints.filter(c => c.status === status));
        }
    }

    async function handleComplaintSubmission(e) {
        e.preventDefault();
        const category    = $('#complaintCategory').value;
        const priority    = $('#complaintPriority').value;
        const subject     = $('#complaintSubject').value.trim();
        const message     = $('#complaintMessage').value.trim();
        const isAnonymous = $('#isAnonymous').checked;

        if (!category || !priority || !subject || !message) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        const btn = $('[type="submit"]', $('#complaintForm'));
        if (btn) btn.disabled = true;

        try {
            await Complaints.submit({
                studentId:     isAnonymous ? null : currentUser.id,
                studentName:   isAnonymous ? 'Anonymous' : currentProfile.name,
                studentMatric: isAnonymous ? null : currentProfile.matric,
                category, priority, subject, message, isAnonymous
            });

            toast('Complaint submitted successfully!', 'success');
            $('#complaintForm').reset();
            showSection('complaints');
            await loadComplaints();
        } catch (err) {
            console.error('Submit complaint error:', err);
            toast('Failed to submit complaint. Please try again.', 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    // ---- Messages / Chat ----
    async function loadMessages() {
        if (!currentUser) return;
        try {
            const msgs = await Messages.getForStudent(currentUser.id);
            renderChatThread(msgs);

            // Mark all as read
            const unread = msgs.filter(m => !m.read_by?.includes(currentUser.id));
            if (unread.length > 0) {
                for (const m of unread) {
                    await db.from('messages')
                        .update({ read_by: [...(m.read_by || []), currentUser.id] })
                        .eq('id', m.id);
                }
                updateStats();
            }
        } catch (err) {
            console.error('Load messages error:', err);
        }
    }

    function renderChatThread(msgs) {
        const thread = $('#chatThread');
        if (!thread) return;

        if (!msgs || msgs.length === 0) {
            thread.innerHTML = '<div class="empty-state">No messages yet</div>';
            return;
        }

        thread.innerHTML = msgs.map(m => {
            const isBroadcast  = m.is_broadcast;
            const bubbleClass  = isBroadcast ? 'broadcast' : (m.sender_type === 'admin' ? 'admin' : 'student');
            const ts = m.created_at
                ? new Date(m.created_at).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '';
            const broadcastLabel = isBroadcast ? '<span class="broadcast-label">📢 System Announcement</span>' : '';
            return `
                <div class="chat-bubble ${bubbleClass}">
                    ${broadcastLabel}
                    <div class="bubble-text">${escapeHtml(m.message)}</div>
                    <div class="bubble-meta">
                        <span class="bubble-sender">${escapeHtml(m.sender_name || 'Unknown')}</span>
                        <span class="bubble-time">${ts}</span>
                    </div>
                </div>`;
        }).join('');

        thread.scrollTop = thread.scrollHeight;
    }

    async function sendStudentReply() {
        const textarea = $('#studentReplyText');
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) { toast('Please enter a message.', 'error'); return; }

        try {
            await Messages.send({
                complaintId:     null,
                senderId:        currentUser.id,
                senderName:      currentProfile.name,
                senderType:      'student',
                targetStudentId: currentUser.id,
                message:         text,
                isBroadcast:     false
            });
            textarea.value = '';
            await loadMessages();
            toast('Reply sent.', 'success');
        } catch (err) {
            console.error('Send reply error:', err);
            toast('Failed to send reply.', 'error');
        }
    }

    // ---- Notifications ----
    async function loadNotifications() {
        if (!currentUser) return;
        try {
            const notifs = await Notifications.getUnread(currentUser.id);
            // Show browser notification for each unread
            notifs.forEach(n => {
                PushNotify.show(n.title, n.body, { tag: n.id });
            });
        } catch (err) {
            console.error('Load notifications error:', err);
        }
    }

    // ---- Realtime subscriptions ----
    function setupRealtime() {
        // Complaints: update status in real time
        const complaintSub = Complaints.subscribeStudent(currentUser.id, (payload) => {
            if (payload.eventType === 'UPDATE') {
                const idx = complaints.findIndex(c => c.id === payload.new.id);
                if (idx !== -1) {
                    complaints[idx] = payload.new;
                } else {
                    complaints.unshift(payload.new);
                }
                renderComplaints();
                updateStats();

                if (payload.new.status === 'answered' && payload.old.status !== 'answered') {
                    toast('Your complaint has been answered!', 'success');
                    PushNotify.show('Complaint Answered', 'An admin has responded to your complaint.');
                }
            }
            if (payload.eventType === 'INSERT') {
                complaints.unshift(payload.new);
                renderComplaints();
                updateStats();
            }
        });

        // Messages: refresh chat in real time
        const messageSub = Messages.subscribeStudent(currentUser.id, (payload) => {
            if (payload.eventType === 'INSERT') {
                loadMessages();
                updateStats();
                if (payload.new.sender_type === 'admin') {
                    toast('New message from admin!', 'info');
                    PushNotify.show('New Message', payload.new.sender_name + ': ' + payload.new.message.substring(0, 60));
                }
            }
        });

        // Notifications
        const notifSub = Notifications.subscribe(currentUser.id, (payload) => {
            if (payload.eventType === 'INSERT') {
                const n = payload.new;
                toast(n.title, 'info');
                PushNotify.show(n.title, n.body);
            }
        });

        realtimeSubs = [complaintSub, messageSub, notifSub];
    }

    function cleanupRealtime() {
        realtimeSubs.forEach(sub => {
            if (sub) db.removeChannel(sub);
        });
        realtimeSubs = [];
    }

    // ---- Theme ----
    const ThemeController = {
        currentTheme: 'dark',
        init() {
            const saved = localStorage.getItem('scosy_theme') || 'dark';
            this.setTheme(saved);
        },
        toggleTheme() {
            const next = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(next);
            localStorage.setItem('scosy_theme', next);
        },
        setTheme(theme) {
            this.currentTheme = theme;
            document.documentElement.setAttribute('data-theme', theme);
        }
    };

    // ---- Dropdown ----
    function toggleUserDropdown() {
        const d = $('#userDropdown');
        if (d) d.classList.toggle('show');
    }

    document.addEventListener('click', (e) => {
        const d = $('#userDropdown');
        const m = $('.user-menu');
        if (d && m && !m.contains(e.target)) d.classList.remove('show');
    });

    // ---- Logout ----
    async function logout() {
        cleanupRealtime();
        if (sessionTimer) clearInterval(sessionTimer);
        try { await Auth.logout(); } catch (_) {}
        toast('Logged out securely.', 'info');
        setTimeout(() => { window.location.href = '../pages/login.html'; }, 800);
    }

    // ---- Mobile menu ----
    function toggleMobileMenu() {
        const s = $('.sidebar');
        if (s) s.classList.toggle('mobile-open');
    }

    // ---- Globals ----
    window.showSection        = showSection;
    window.filterComplaints   = filterComplaints;
    window.sendStudentReply   = sendStudentReply;
    window.toggleUserDropdown = toggleUserDropdown;
    window.toggleTheme        = () => ThemeController.toggleTheme();
    window.logout             = logout;
    window.toggleMobileMenu   = toggleMobileMenu;
    window.showProfile        = () => toast('Profile feature coming soon!', 'info');
    window.showSettings       = () => toast('Settings feature coming soon!', 'info');
    window.showAnonymousForm  = () => { window.location.href = '../pages/login.html#anonymous'; };
    window.currentUser        = null;

    // ---- Init ----
    async function init() {
        console.log('🚀 SCOSY Student Dashboard initializing…');

        const session = await Auth.getSession();
        if (!session) {
            window.location.href = '../pages/login.html';
            return;
        }

        currentUser = session.user;
        window.currentUser = currentUser;

        try {
            currentProfile = await Auth.getProfile(currentUser.id);
        } catch (err) {
            console.error('Profile load error:', err);
            window.location.href = '../pages/login.html';
            return;
        }

        if (currentProfile.user_type !== 'student') {
            window.location.href = '../pages/login.html';
            return;
        }

        console.log('✅ Student session:', currentProfile.name);

        ThemeController.init();
        updateUserInterface();
        await loadComplaints();
        await loadNotifications();
        setupRealtime();
        startSession();
        await PushNotify.requestPermission();

        const form = $('#complaintForm');
        if (form) form.addEventListener('submit', handleComplaintSubmission);

        document.addEventListener('mousemove', resetSessionTimer);
        document.addEventListener('keydown', resetSessionTimer);
        document.addEventListener('click', resetSessionTimer);

        // Stat card click handlers
        const cards = {
            '#statCardTotal':    () => { showSection('complaints'); filterComplaints('all'); },
            '#statCardPending':  () => { showSection('complaints'); filterComplaints('pending'); },
            '#statCardResolved': () => { showSection('complaints'); filterComplaints('resolved'); },
            '#statCardMessages': () => showSection('chat')
        };
        Object.entries(cards).forEach(([id, fn]) => {
            const el = $(id);
            if (el) {
                el.addEventListener('click', fn);
                el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
            }
        });

        console.log('✅ SCOSY Student Dashboard ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
