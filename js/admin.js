/**
 * SCOSY — Admin Dashboard (Supabase)
 * Depends on: supabase-client.js
 */
(function () {
    'use strict';

    // ---- State ----
    let currentUser    = null;
    let currentProfile = null;
    let allComplaints  = [];
    let allUsers       = [];
    let allAdmins      = [];
    let sessionTimer   = null;
    let sessionSeconds = 1800;
    let realtimeSubs   = [];

    // ---- DOM helpers ----
    const $ = (sel) => document.querySelector(sel);

    // ---- Utility ----
    function timeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-NG', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    // ---- Toast ----
    function toast(message, type = 'info') {
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
    }

    // ---- Session ----
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
    }

    // ---- UI ----
    function updateUserInterface() {
        if (!currentProfile) return;
        const firstName = currentProfile.name.split(' ')[0];
        const initials  = getInitials(currentProfile.name);
        const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
        set('#welcomeName', firstName);
        set('#welcomeLevel', currentProfile.admin_level);
        set('#welcomeAvatar', initials);
        set('#userInitials', initials);
        set('#dropdownName', currentProfile.name);
        set('#dropdownRole', `Level ${currentProfile.admin_level} Administrator`);
        set('#dropdownAvatar', initials);
        set('#adminLevel', `Level ${currentProfile.admin_level} Admin`);

        // Hide admin management for Level 2 admins
        if (currentProfile.admin_level !== 1) {
            const adminSection = $('#adminSection');
            if (adminSection) adminSection.style.display = 'none';
        }
    }

    // ---- Data loading ----
    async function loadAllData() {
        try {
            allComplaints = await Complaints.getAll();
            allUsers      = await AdminMgmt.getStudents();
            allAdmins     = await AdminMgmt.getAll();
            updateStats();
            renderComplaints();
            renderUsers();
            renderAdmins();
        } catch (err) {
            console.error('Load data error:', err);
            toast('Failed to load dashboard data.', 'error');
        }
    }

    // ---- Stats ----
    function updateStats() {
        const total   = allComplaints.length;
        const pending = allComplaints.filter(c => c.status === 'pending').length;
        const users   = allUsers.length;
        const today   = new Date().toDateString();
        const resolvedToday = allComplaints.filter(c =>
            (c.status === 'resolved' || c.status === 'answered') &&
            new Date(c.updated_at || c.created_at).toDateString() === today
        ).length;

        const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
        set('#totalComplaints', total);
        set('#pendingComplaints', pending);
        set('#totalUsers', users);
        set('#resolvedToday', resolvedToday);
        set('#totalComplaintsBadge', total);
        set('#pendingComplaintsBadge', pending);
        set('#anonymousComplaintsBadge', allComplaints.filter(c => c.is_anonymous).length);
    }

    // ---- Complaints rendering ----
    function renderComplaints(filter = 'all') {
        let filtered = allComplaints;
        if (filter !== 'all') filtered = allComplaints.filter(c => c.status === filter);

        renderComplaintList('#allComplaintsList', filtered);
        renderComplaintList('#pendingComplaintsList', allComplaints.filter(c => c.status === 'pending'));
        renderComplaintList('#anonymousComplaintsList', allComplaints.filter(c => c.is_anonymous));
    }

    function renderComplaintList(containerId, complaints) {
        const container = $(containerId);
        if (!container) return;

        if (complaints.length === 0) {
            container.innerHTML = '<div class="empty-state">No complaints found</div>';
            return;
        }

        container.innerHTML = complaints.map(c => `
            <div class="complaint-item">
                <div class="complaint-header">
                    <div class="complaint-id">${c.id.substring(0, 8).toUpperCase()}</div>
                    <div class="complaint-status status-${c.status}">${c.status}</div>
                    <div class="complaint-priority priority-${c.priority || 'medium'}">${c.priority || 'medium'}</div>
                </div>
                <div class="complaint-content">
                    <h4>${escapeHtml(c.subject)}</h4>
                    <p>${escapeHtml(c.message.substring(0, 150))}${c.message.length > 150 ? '...' : ''}</p>
                    <div class="complaint-meta">
                        <span><i class="fas fa-user"></i> ${c.is_anonymous ? 'Anonymous' : escapeHtml(c.student_name || 'Student')}</span>
                        <span><i class="fas fa-tag"></i> ${c.category}</span>
                        <span><i class="fas fa-clock"></i> ${timeAgo(c.created_at)}</span>
                    </div>
                </div>
                <div class="complaint-actions">
                    <button class="btn btn-sm btn-primary" onclick="respondToComplaint('${c.id}')">
                        <i class="fas fa-reply"></i> Respond
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="viewComplaintDetails('${c.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </div>`).join('');
    }

    // ---- Users rendering ----
    function renderUsers() {
        const container = $('#usersList');
        if (!container) return;
        if (allUsers.length === 0) {
            container.innerHTML = '<div class="empty-state">No users found</div>';
            return;
        }
        container.innerHTML = allUsers.map(u => `
            <div class="user-item">
                <div class="user-avatar">${getInitials(u.name)}</div>
                <div class="user-info">
                    <h4>${escapeHtml(u.name)}</h4>
                    <p>${u.matric || ''} | ${u.email}</p>
                    <div class="user-meta">
                        <span><i class="fas fa-layer-group"></i> ${u.level || ''} Level</span>
                        <span><i class="fas fa-calendar"></i> Joined ${formatDate(u.created_at)}</span>
                        ${u.last_login ? `<span><i class="fas fa-clock"></i> Last login ${timeAgo(u.last_login)}</span>` : ''}
                    </div>
                </div>
            </div>`).join('');
    }

    // ---- Admins rendering ----
    function renderAdmins() {
        const container = $('#adminsList');
        if (!container) return;
        if (allAdmins.length === 0) {
            container.innerHTML = '<div class="empty-state">No administrators found</div>';
            return;
        }
        container.innerHTML = allAdmins.map(a => `
            <div class="admin-item">
                <div class="admin-avatar">${getInitials(a.name)}</div>
                <div class="admin-info">
                    <h4>${escapeHtml(a.name)}</h4>
                    <p>${a.staff_id || ''} | ${a.email}</p>
                    <div class="admin-meta">
                        <span class="admin-level level-${a.admin_level}">
                            <i class="fas fa-crown"></i> Level ${a.admin_level} Admin
                        </span>
                        <span class="admin-status status-${a.approval_status}">
                            <i class="fas fa-${a.approval_status === 'approved' ? 'check-circle' : 'clock'}"></i>
                            ${a.approval_status}
                        </span>
                    </div>
                </div>
                <div class="admin-actions">
                    ${currentProfile.admin_level === 1 && a.id !== currentUser.id && a.approval_status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" onclick="approveAdmin('${a.id}')">
                            <i class="fas fa-check"></i> Approve
                        </button>` : ''}
                </div>
            </div>`).join('');
    }

    // ---- Response modal ----
    let _activeComplaintId = null;

    function renderAdminChatThread(complaintId) {
        const thread = $('#complaintChatThread');
        if (!thread) return;

        Messages.getForComplaint(complaintId).then(msgs => {
            if (msgs.length === 0) {
                thread.innerHTML = '<div class="empty-state">No messages yet — be the first to respond.</div>';
                return;
            }
            thread.innerHTML = msgs.map(m => {
                const bubbleClass = m.sender_type === 'admin' ? 'admin' : 'student';
                const ts = m.created_at
                    ? new Date(m.created_at).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '';
                return `
                    <div class="chat-bubble ${bubbleClass}">
                        <div class="bubble-text">${escapeHtml(m.message)}</div>
                        <div class="bubble-meta">
                            <span class="bubble-sender">${escapeHtml(m.sender_name || 'Unknown')}</span>
                            <span class="bubble-time">${ts}</span>
                        </div>
                    </div>`;
            }).join('');
            thread.scrollTop = thread.scrollHeight;
        }).catch(err => console.error('Load chat thread error:', err));
    }

    function openResponseModal(complaintId) {
        const complaint = allComplaints.find(c => c.id === complaintId);
        if (!complaint) return;
        _activeComplaintId = complaintId;

        const detailsEl = $('#complaintDetails');
        if (detailsEl) {
            detailsEl.innerHTML = `
                <div class="complaint-summary" style="margin-bottom:12px;padding:12px;background:var(--bg-light);border-radius:8px;border:1px solid var(--border);">
                    <strong>${escapeHtml(complaint.subject)}</strong>
                    <span class="complaint-status status-${complaint.status}" style="margin-left:8px;">${complaint.status}</span>
                    <p style="margin-top:6px;font-size:0.88rem;color:var(--text-secondary);">${escapeHtml(complaint.message.substring(0, 200))}${complaint.message.length > 200 ? '…' : ''}</p>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">
                        <span><i class="fas fa-user"></i> ${complaint.is_anonymous ? 'Anonymous' : escapeHtml(complaint.student_name || 'Student')}</span>
                        &nbsp;|&nbsp;
                        <span><i class="fas fa-tag"></i> ${escapeHtml(complaint.category)}</span>
                    </div>
                </div>`;
        }

        const textarea = $('#adminResponseText');
        if (textarea) textarea.value = '';

        renderAdminChatThread(complaintId);

        const btnSend = $('#btnSendResponse');
        if (btnSend) btnSend.onclick = () => sendAdminResponse(complaintId, false);

        const btnBroadcast = $('#btnSendToEveryone');
        if (btnBroadcast) btnBroadcast.onclick = () => sendAdminResponse(complaintId, true);

        const modal = $('#responseModal');
        if (modal) modal.style.display = 'flex';
    }

    async function sendAdminResponse(complaintId, isBroadcast) {
        const textarea = $('#adminResponseText');
        if (!textarea) return;
        const text = textarea.value.trim();
        if (!text) { toast('Please enter a response.', 'error'); return; }

        const complaint = allComplaints.find(c => c.id === complaintId);
        if (!complaint) return;

        const btnSend = $('#btnSendResponse');
        const btnBcast = $('#btnSendToEveryone');
        if (btnSend) btnSend.disabled = true;
        if (btnBcast) btnBcast.disabled = true;

        try {
            // Send message
            await Messages.send({
                complaintId,
                senderId:        currentUser.id,
                senderName:      currentProfile.name,
                senderType:      'admin',
                targetStudentId: isBroadcast ? null : (complaint.student_id || null),
                message:         text,
                isBroadcast
            });

            // Update complaint status
            await Complaints.updateStatus(complaintId, {
                status:              'answered',
                has_unread_response: true,
                last_response_at:    new Date().toISOString(),
                response_count:      (complaint.response_count || 0) + 1,
                updated_at:          new Date().toISOString()
            });

            textarea.value = '';
            renderAdminChatThread(complaintId);
            await loadAllData();
            toast(isBroadcast ? 'Broadcast sent to everyone!' : 'Response sent successfully!', 'success');

        } catch (err) {
            console.error('Send response error:', err);
            toast('Failed to send response. Please try again.', 'error');
        } finally {
            if (btnSend) btnSend.disabled = false;
            if (btnBcast) btnBcast.disabled = false;
        }
    }

    function respondToComplaint(complaintId) {
        openResponseModal(complaintId);
    }

    function viewComplaintDetails(complaintId) {
        const c = allComplaints.find(x => x.id === complaintId);
        if (!c) return;
        alert(`Complaint Details\n\nID: ${c.id.substring(0, 8).toUpperCase()}\nSubject: ${c.subject}\nCategory: ${c.category}\nPriority: ${c.priority}\nStatus: ${c.status}\nStudent: ${c.is_anonymous ? 'Anonymous' : c.student_name}\nCreated: ${formatDate(c.created_at)}\n\nMessage:\n${c.message}`);
    }

    // ---- Admin approval ----
    async function approveAdmin(profileId) {
        if (!confirm('Approve this admin account?')) return;
        try {
            await AdminMgmt.approve(profileId);
            toast('Admin account approved!', 'success');
            await loadAllData();
        } catch (err) {
            console.error('Approve admin error:', err);
            toast('Failed to approve admin.', 'error');
        }
    }

    // ---- Filter ----
    function filterComplaints() {
        const filter = $('#complaintFilter')?.value || 'all';
        renderComplaints(filter);
    }

    // ---- Realtime ----
    function setupRealtime() {
        const complaintSub = Complaints.subscribeAdmin((payload) => {
            if (payload.eventType === 'INSERT') {
                allComplaints.unshift(payload.new);
                updateStats();
                renderComplaints();
                toast('New complaint submitted!', 'info');
                PushNotify.show('New Complaint', `${payload.new.student_name || 'Anonymous'}: ${payload.new.subject}`);
            }
            if (payload.eventType === 'UPDATE') {
                const idx = allComplaints.findIndex(c => c.id === payload.new.id);
                if (idx !== -1) allComplaints[idx] = payload.new;
                updateStats();
                renderComplaints();
            }
        });

        const messageSub = Messages.subscribeAdmin((payload) => {
            if (payload.eventType === 'INSERT' && payload.new.sender_type === 'student') {
                toast('New student message received!', 'info');
                PushNotify.show('New Student Message', payload.new.sender_name + ': ' + payload.new.message.substring(0, 60));
            }
        });

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
        realtimeSubs.forEach(sub => { if (sub) db.removeChannel(sub); });
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
    window.showSection          = showSection;
    window.toggleUserDropdown   = toggleUserDropdown;
    window.toggleTheme          = () => ThemeController.toggleTheme();
    window.logout               = logout;
    window.toggleMobileMenu     = toggleMobileMenu;
    window.filterComplaints     = filterComplaints;
    window.respondToComplaint   = respondToComplaint;
    window.openResponseModal    = openResponseModal;
    window.sendAdminResponse    = sendAdminResponse;
    window.viewComplaintDetails = viewComplaintDetails;
    window.approveAdmin         = approveAdmin;
    window.showProfile          = () => toast('Profile feature coming soon!', 'info');
    window.showSettings         = () => toast('Settings feature coming soon!', 'info');
    window.closeModal           = (id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    };

    // ---- Init ----
    async function init() {
        console.log('🚀 SCOSY Admin Dashboard initializing…');

        const session = await Auth.getSession();
        if (!session) {
            window.location.href = '../pages/login.html';
            return;
        }

        currentUser = session.user;

        try {
            currentProfile = await Auth.getProfile(currentUser.id);
        } catch (err) {
            window.location.href = '../pages/login.html';
            return;
        }

        if (currentProfile.user_type !== 'admin' || currentProfile.approval_status !== 'approved') {
            await Auth.logout();
            window.location.href = '../pages/login.html';
            return;
        }

        console.log('✅ Admin session:', currentProfile.name, `Level ${currentProfile.admin_level}`);

        ThemeController.init();
        updateUserInterface();
        await loadAllData();
        setupRealtime();
        startSession();
        await PushNotify.requestPermission();

        document.addEventListener('mousemove', resetSessionTimer);
        document.addEventListener('keydown', resetSessionTimer);
        document.addEventListener('click', resetSessionTimer);

        // Stat card click handlers
        const attachCard = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', fn);
            el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
        };
        attachCard('adminStatCardTotal',    () => showSection('complaints'));
        attachCard('adminStatCardPending',  () => showSection('pending'));
        attachCard('adminStatCardUsers',    () => showSection('users'));
        attachCard('adminStatCardResolved', () => {
            showSection('complaints');
            const f = $('#complaintFilter');
            if (f) { f.value = 'resolved'; filterComplaints(); }
        });

        console.log('✅ SCOSY Admin Dashboard ready');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
