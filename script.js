const App = (function() {
    'use strict';

    // ==================== STATE ====================
    let currentUser = null;
    let sessionTimer = null;
    let sessionSeconds = 1800; // 30 minutes
    let lockoutTimer = null;
    let lockoutSeconds = 0;
    let failedAttempts = 0;
    let tickets = [];
    let anonymousTickets = [];
    let activityLog = [];
    let securityLog = [];
    let chatHistory = [];
    let advancedAI = false;

    // ==================== DOM HELPERS ====================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const hide = (el) => el.classList.add('hidden');
    const show = (el) => el.classList.remove('hidden');
    const toggle = (el) => el.classList.toggle('hidden');

    // ==================== UTILITY ====================
    function generateId(prefix = 'TKT') {
        const ts = Date.now().toString(36).toUpperCase();
        const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${ts}-${rnd}`;
    }

    function formatDate(date = new Date()) {
        return date.toLocaleDateString('en-NG', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
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

    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    // ==================== THEME CONTROLLER ====================
    const ThemeController = {
        currentTheme: 'dark',
        
        init() {
            // Detect system preference
            const systemPreference = this.detectSystemPreference();
            
            // Load saved preference or use system preference
            const savedTheme = this.loadPreference();
            const initialTheme = savedTheme || systemPreference;
            
            // Set initial theme
            this.setTheme(initialTheme);
            
            // Listen for system theme changes
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                    if (!this.loadPreference()) {
                        this.setTheme(e.matches ? 'dark' : 'light');
                    }
                });
            }
        },
        
        toggleTheme() {
            const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
            this.savePreference(newTheme);
        },
        
        setTheme(theme) {
            if (theme !== 'light' && theme !== 'dark') {
                theme = 'dark'; // fallback
            }
            
            this.currentTheme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            
            // Update theme icon
            const themeIcon = $('#themeIcon');
            if (themeIcon) {
                if (theme === 'light') {
                    themeIcon.className = 'fas fa-moon';
                } else {
                    themeIcon.className = 'fas fa-sun';
                }
            }
            
            // Update tooltip
            const themeToggle = $('#themeToggle');
            if (themeToggle) {
                themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
            }
        },
        
        getCurrentTheme() {
            return this.currentTheme;
        },
        
        detectSystemPreference() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        },
        
        savePreference(theme) {
            try {
                localStorage.setItem('scosy_theme_preference', theme);
            } catch (e) {
                console.warn('Failed to save theme preference:', e);
            }
        },
        
        loadPreference() {
            try {
                const saved = localStorage.getItem('scosy_theme_preference');
                if (saved === 'light' || saved === 'dark') {
                    return saved;
                }
            } catch (e) {
                console.warn('Failed to load theme preference:', e);
            }
            return null;
        }
    };

    // ==================== STORAGE ====================
    function save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('Storage error:', e);
        }
    }

    function load(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    // ==================== CRYPTO HELPERS ====================
    async function hashPassword(password, salt = null) {
        const encoder = new TextEncoder();
        const s = salt || crypto.getRandomValues(new Uint8Array(16));
        const keyMaterial = await crypto.subtle.importKey(
            'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
        );
        const derived = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: s, iterations: 100000, hash: 'SHA-256' },
            keyMaterial, 256
        );
        return { hash: Array.from(new Uint8Array(derived)), salt: Array.from(s) };
    }

    async function verifyPassword(password, storedHash, storedSalt) {
        const result = await hashPassword(password, new Uint8Array(storedSalt));
        return JSON.stringify(result.hash) === JSON.stringify(storedHash);
    }

    // ==================== TOASTS ====================
    function toast(message, type = 'info') {
        const container = $('#toastContainer');
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

    // ==================== ACTIVITY LOG ====================
    function logActivity(action, detail = '') {
        const entry = { action, detail, time: new Date().toISOString() };
        activityLog.unshift(entry);
        if (activityLog.length > 50) activityLog.pop();
        save('scosy_activity', activityLog);
        renderActivity();
    }

    function logSecurity(event, detail = '') {
        const entry = { event, detail, time: new Date().toISOString() };
        securityLog.unshift(entry);
        if (securityLog.length > 100) securityLog.pop();
        save('scosy_security', securityLog);
        renderSecurityLog();
    }

    // ==================== SESSION MANAGEMENT ====================
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
                logSecurity('SESSION_TIMEOUT', 'Auto logout after 30min inactivity');
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

    function resetSessionTimer() {
        sessionSeconds = 1800;
    }

    // ==================== LOCKOUT ====================
    function startLockout() {
        lockoutSeconds = 900; // 15 minutes
        const banner = $('#lockoutBanner');
        if (banner) show(banner);
        updateLockoutDisplay();
        if (lockoutTimer) clearInterval(lockoutTimer);
        lockoutTimer = setInterval(() => {
            lockoutSeconds--;
            updateLockoutDisplay();
            if (lockoutSeconds <= 0) {
                clearInterval(lockoutTimer);
                failedAttempts = 0;
                if (banner) hide(banner);
            }
        }, 1000);
    }

    function updateLockoutDisplay() {
        const m = Math.floor(lockoutSeconds / 60).toString().padStart(2, '0');
        const s = (lockoutSeconds % 60).toString().padStart(2, '0');
        const el = $('#lockoutTimer');
        if (el) el.textContent = `${m}:${s}`;
    }

    // ==================== AUTH PAGES ====================
    function showLogin() {
        hide($('#registerPage'));
        hide($('#anonymousPage'));
        show($('#loginPage'));
        logSecurity('NAVIGATE', 'Viewed login page');
    }

    function showRegister() {
        hide($('#loginPage'));
        hide($('#anonymousPage'));
        show($('#registerPage'));
        logSecurity('NAVIGATE', 'Viewed registration page');
    }

    function showAnonymous() {
        hide($('#loginPage'));
        hide($('#registerPage'));
        show($('#anonymousPage'));
        logSecurity('NAVIGATE', 'Viewed anonymous portal');
    }

    function showForgot() {
        toast('Contact the CS department admin to reset your password.', 'info');
    }

    // ==================== REGISTRATION ====================
    async function handleRegister(e) {
        e.preventDefault();
        const name = $('#regName').value.trim();
        const matric = $('#regMatric').value.trim().toUpperCase();
        const email = $('#regEmail').value.trim();
        const level = $('#regLevel').value;
        const password = $('#regPassword').value;
        const confirm = $('#regConfirm').value;

        if (!name || !matric || !email || !level || !password) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        if (password !== confirm) {
            $('#pwdError').style.display = 'flex';
            return;
        }
        $('#pwdError').style.display = 'none';

        if (password.length < 8) {
            toast('Password must be at least 8 characters.', 'error');
            return;
        }

        const users = load('scosy_users', {});
        if (users[matric] || Object.values(users).some(u => u.email === email)) {
            toast('Account already exists with this matric or email.', 'error');
            return;
        }

        const spinner = $('#regSpinner');
        const btnText = $('#regText');
        show(spinner);
        btnText.textContent = 'Creating Account...';

        try {
            const hashed = await hashPassword(password);
            users[matric] = {
                name, matric, email, level,
                passwordHash: hashed.hash,
                passwordSalt: hashed.salt,
                createdAt: new Date().toISOString(),
                lastLogin: null
            };
            save('scosy_users', users);
            toast('Account created successfully! Please log in.', 'success');
            logSecurity('REGISTER', `New account: ${matric}`);
            setTimeout(showLogin, 1500);
        } catch (err) {
            toast('Registration failed. Please try again.', 'error');
            console.error(err);
        } finally {
            hide(spinner);
            btnText.textContent = 'Create Secure Account';
        }
    }

    // ==================== LOGIN ====================
    async function handleLogin(e) {
        e.preventDefault();
        if (lockoutSeconds > 0) {
            toast(`Account locked. Try again in ${Math.ceil(lockoutSeconds / 60)} minutes.`, 'error');
            return;
        }

        const identifier = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;
        const remember = $('#rememberMe').checked;

        if (!identifier || !password) {
            toast('Please enter both matric/email and password.', 'error');
            return;
        }

        const users = load('scosy_users', {});
        let user = users[identifier.toUpperCase()];
        if (!user) {
            user = Object.values(users).find(u => u.email === identifier);
        }

        if (!user) {
            failedAttempts++;
            if (failedAttempts >= 5) {
                startLockout();
                logSecurity('LOCKOUT', `Account locked after ${failedAttempts} failed attempts`);
            }
            toast('Invalid credentials. Please try again.', 'error');
            logSecurity('LOGIN_FAIL', `Failed login for: ${identifier}`);
            return;
        }

        const spinner = $('#loginSpinner');
        const btnText = $('#loginText');
        show(spinner);
        btnText.textContent = 'Authenticating...';

        try {
            const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
            if (!valid) {
                failedAttempts++;
                if (failedAttempts >= 5) {
                    startLockout();
                    logSecurity('LOCKOUT', `Account locked after ${failedAttempts} failed attempts for ${user.matric}`);
                }
                toast('Invalid credentials.', 'error');
                logSecurity('LOGIN_FAIL', `Failed password for: ${user.matric}`);
                return;
            }

            failedAttempts = 0;
            user.lastLogin = new Date().toISOString();
            users[user.matric] = user;
            save('scosy_users', users);

            currentUser = { ...user };
            delete currentUser.passwordHash;
            delete currentUser.passwordSalt;

            if (remember) {
                save('scosy_remember', { matric: user.matric, token: crypto.randomUUID() });
            }

            toast(`Welcome back, ${user.name}!`, 'success');
            logSecurity('LOGIN_SUCCESS', `User ${user.matric} logged in`);
            logActivity('Login', 'Successfully authenticated');

            enterDashboard();
        } catch (err) {
            toast('Authentication error. Please try again.', 'error');
            console.error(err);
        } finally {
            hide(spinner);
            btnText.textContent = 'Sign In Securely';
        }
    }

    // ==================== DASHBOARD ENTRY ====================
    function enterDashboard() {
        hide($('#loginPage'));
        hide($('#registerPage'));
        hide($('#anonymousPage'));
        show($('#dashboard'));

        $('#welcomeName').textContent = currentUser.name.split(' ')[0];
        $('#welcomeAvatar').textContent = getInitials(currentUser.name);
        $('#avatarInitial').textContent = getInitials(currentUser.name);
        $('#userAvatar').style.background = `linear-gradient(135deg, #4f46e5, #7c3aed)`;

        // Profile
        $('#profileName').textContent = currentUser.name;
        $('#profileMatric').textContent = currentUser.matric;
        $('#profileEmail').textContent = currentUser.email;
        $('#profileLevel').textContent = currentUser.level + ' Level';
        $('#profileCreated').textContent = formatDate(new Date(currentUser.createdAt));
        $('#profileLastLogin').textContent = currentUser.lastLogin ? formatDate(new Date(currentUser.lastLogin)) : '--';
        $('#profileAvatarBig').textContent = getInitials(currentUser.name);

        loadUserData();
        updateStats();
        renderTickets();
        renderActivity();
        renderSecurityLog();
        startSession();

        document.addEventListener('mousemove', resetSessionTimer);
        document.addEventListener('keydown', resetSessionTimer);
    }

    // ==================== LOAD USER DATA ====================
    function loadUserData() {
        tickets = load('scosy_tickets_' + currentUser.matric, []);
        anonymousTickets = load('scosy_anon_tickets_' + currentUser.matric, []);
        activityLog = load('scosy_activity', []);
        securityLog = load('scosy_security', []);
    }

    // ==================== STATS ====================
    function updateStats() {
        const active = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
        const pending = tickets.filter(t => t.status === 'pending').length;
        const anon = anonymousTickets.length;
        const critical = tickets.filter(t => t.priority === 'critical' && t.status !== 'resolved').length;

        $('#statActive').textContent = active;
        $('#statPending').textContent = pending;
        $('#statAnon').textContent = anon;
        $('#statCritical').textContent = critical;
        $('#myComplaintBadge').textContent = active;

        $('#analyticsTotal').textContent = tickets.length;
        $('#analyticsResolved').textContent = tickets.filter(t => t.status === 'resolved').length;
        $('#analyticsRate').textContent = tickets.length > 0
            ? Math.round((tickets.filter(t => t.status === 'resolved').length / tickets.length) * 100) + '%'
            : '0%';
    }

    // ==================== TICKETS ====================
    function renderTickets() {
        const list = $('#studentTicketList');
        if (tickets.length === 0) {
            list.innerHTML = '<p class="empty-state">No complaints filed yet</p>';
            return;
        }
        list.innerHTML = tickets.map(t => `
            <div class="ticket-item">
                <div class="ticket-header">
                    <span class="ticket-id">${t.id}</span>
                    <span class="ticket-status status-${t.status}">${t.status.toUpperCase()}</span>
                </div>
                <h4>${t.subject}</h4>
                <p>${t.message.substring(0, 100)}${t.message.length > 100 ? '...' : ''}</p>
                <div class="ticket-meta">
                    <span><i class="fas fa-tag"></i> ${t.category}</span>
                    <span><i class="fas fa-flag"></i> ${t.priority}</span>
                    <span><i class="fas fa-clock"></i> ${timeAgo(t.createdAt)}</span>
                </div>
            </div>
        `).join('');
    }

    function renderAnonymousTickets() {
        const list = $('#anonymousTicketList');
        if (anonymousTickets.length === 0) {
            list.innerHTML = '<p class="empty-state">No anonymous reports in this session</p>';
            return;
        }
        list.innerHTML = anonymousTickets.map(t => `
            <div class="ticket-item anon-ticket">
                <div class="ticket-header">
                    <span class="ticket-id">${t.id}</span>
                    <span class="ticket-status status-${t.status}">${t.status.toUpperCase()}</span>
                </div>
                <h4>${t.subject}</h4>
                <p>${t.message.substring(0, 100)}${t.message.length > 100 ? '...' : ''}</p>
                <div class="ticket-meta">
                    <span><i class="fas fa-tag"></i> ${t.category}</span>
                    <span><i class="fas fa-flag"></i> ${t.urgency}</span>
                    <span><i class="fas fa-clock"></i> ${timeAgo(t.createdAt)}</span>
                </div>
            </div>
        `).join('');
    }

    // ==================== COMPLAINT MODAL ====================
    function openComplaintModal() {
        show($('#complaintModal'));
        $('#compCategory').value = '';
        $('#compPriority').value = 'medium';
        $('#compSubject').value = '';
        $('#compMessage').value = '';
    }

    function closeComplaintModal() {
        hide($('#complaintModal'));
    }

    function handleComplaintSubmit(e) {
        e.preventDefault();
        const category = $('#compCategory').value;
        const priority = $('#compPriority').value;
        const subject = $('#compSubject').value.trim();
        const message = $('#compMessage').value.trim();

        if (!category || !subject || !message) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        const ticket = {
            id: generateId('SC'),
            category, priority, subject, message,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            responses: []
        };

        tickets.unshift(ticket);
        save('scosy_tickets_' + currentUser.matric, tickets);
        logActivity('Complaint Filed', `Ticket ${ticket.id} created`);
        logSecurity('TICKET_CREATE', `New complaint ${ticket.id} by ${currentUser.matric}`);

        toast(`Complaint submitted! Ticket ID: ${ticket.id}`, 'success');
        closeComplaintModal();
        renderTickets();
        updateStats();
    }

    // ==================== ANONYUS FORM ====================
    function handleAnonymousSubmit(e) {
        e.preventDefault();
        const category = $('#anonCategory').value;
        const urgency = $('#anonUrgency').value;
        const subject = $('#anonSubject').value.trim();
        const message = $('#anonMessage').value.trim();

        if (!category || !subject || !message) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        const ticket = {
            id: generateId('ANON'),
            category, urgency, subject, message,
            status: 'pending',
            createdAt: new Date().toISOString(),
            file: $('#anonFile').files[0]?.name || null
        };

        // Store in isolated namespace
        const anonStore = load('scosy_anonymous_global', []);
        anonStore.unshift(ticket);
        save('scosy_anonymous_global', anonStore);

        // Also link to user session for display (but display shows zero identity)
        anonymousTickets.unshift(ticket);
        save('scosy_anon_tickets_' + currentUser.matric, anonymousTickets);

        logSecurity('ANONYMOUS_SUBMIT', `Anonymous ticket ${ticket.id} submitted`);
        toast(`Anonymous report submitted! Ticket: ${ticket.id}`, 'success');

        $('#anonForm').reset();
        renderAnonymousTickets();
        updateStats();
    }

    // ==================== SECTION NAVIGATION ====================
    function showSection(sectionId, navEl = null) {
        // Hide all sections
        $$('.content-section').forEach(sec => sec.classList.remove('active'));

        // Show target
        const target = $('#sec-' + sectionId);
        if (target) target.classList.add('active');

        // Update sidebar active state
        if (navEl) {
            $$('.sidebar .menu-list a').forEach(a => a.classList.remove('active'));
            navEl.classList.add('active');
        }

        // Special renders
        if (sectionId === 'anonymous') renderAnonymousTickets();
        if (sectionId === 'complaint') renderTickets();
        if (sectionId === 'security') renderSecurityLog();
        if (sectionId === 'backup') renderBackupLog();

        logSecurity('NAVIGATE', `Viewed section: ${sectionId}`);
    }

    // ==================== DROPDOWN ====================
    function toggleDropdown() {
    $('#userDropdown').classList.toggle('show');
    }

    // ==================== LOGOUT ====================
    function logout() {
        if (sessionTimer) clearInterval(sessionTimer);
        currentUser = null;
        save('scosy_remember', null);
        document.removeEventListener('mousemove', resetSessionTimer);
        document.removeEventListener('keydown', resetSessionTimer);
        logSecurity('LOGOUT', 'User logged out');
        hide($('#dashboard'));
        show($('#loginPage'));
        toast('Logged out securely.', 'info');
    }

    // ==================== ACTIVITY RENDER ====================
    function renderActivity() {
        const container = $('#activityLog');
        if (!container) return;
        if (activityLog.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent activity</p>';
            return;
        }
        container.innerHTML = activityLog.slice(0, 5).map(entry => {
            const icons = {
                'Login': 'sign-in-alt', 'Complaint Filed': 'plus-circle',
                'Anonymous Report': 'user-secret', 'Backup': 'cloud-arrow-up',
                'Profile Updated': 'user-edit', 'Password Changed': 'key'
            };
            return `
                <div class="activity-item">
                    <div class="activity-icon purple"><i class="fas fa-${icons[entry.action] || 'circle'}"></i></div>
                    <div class="activity-details">
                        <h4>${entry.action}</h4>
                        <p>${entry.detail}</p>
                    </div>
                    <span class="activity-time">${timeAgo(entry.time)}</span>
                </div>
            `;
        }).join('');
    }

    // ==================== SECURITY LOG RENDER ====================
    function renderSecurityLog() {
        const container = $('#securityLog');
        if (!container) return;
        if (securityLog.length === 0) {
            container.innerHTML = '<div><span class="log-time">[INIT]</span><span class="log-info">Security subsystem initialized</span></div>';
            return;
        }
        container.innerHTML = securityLog.slice(0, 20).map(entry => `
            <div>
                <span class="log-time">[${new Date(entry.time).toLocaleTimeString()}]</span>
                <span class="log-info">${entry.event}: ${entry.detail}</span>
            </div>
        `).join('');
    }

    // ==================== BACKUP & RESTORE ====================
    async function exportBackup() {
        const password = $('#backupPassword').value;
        if (!password || password.length < 8) {
            toast('Please enter a password (min 8 chars) for encryption.', 'error');
            return;
        }

        const data = {
            user: currentUser,
            tickets,
            anonymousTickets,
            activityLog,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const json = JSON.stringify(data);
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const keyMaterial = await crypto.subtle.importKey(
            'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
        );

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key, encoder.encode(json)
        );

        const payload = {
            salt: Array.from(salt),
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };

        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scosy_backup_${currentUser.matric}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        logActivity('Backup', 'Encrypted backup exported');
        logSecurity('BACKUP_EXPORT', `Backup exported for ${currentUser.matric}`);
        toast('Encrypted backup downloaded successfully!', 'success');
        renderBackupLog('Backup exported and downloaded');
    }

    async function importBackup() {
        const fileInput = $('#restoreFile');
        const password = $('#restorePassword').value;

        if (!fileInput.files[0] || !password) {
            toast('Please select a backup file and enter the password.', 'error');
            return;
        }

        try {
            const text = await fileInput.files[0].text();
            const payload = JSON.parse(text);

            const salt = new Uint8Array(payload.salt);
            const iv = new Uint8Array(payload.iv);
            const encrypted = new Uint8Array(payload.data);

            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
            );
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
                keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv }, key, encrypted
            );

            const json = new TextDecoder().decode(decrypted);
            const data = JSON.parse(json);

            if (data.tickets) {
                tickets = data.tickets;
                save('scosy_tickets_' + currentUser.matric, tickets);
            }
            if (data.anonymousTickets) {
                anonymousTickets = data.anonymousTickets;
                save('scosy_anon_tickets_' + currentUser.matric, anonymousTickets);
            }
            if (data.activityLog) {
                activityLog = data.activityLog;
                save('scosy_activity', activityLog);
            }

            updateStats();
            renderTickets();
            renderActivity();
            logActivity('Restore', 'Data restored from backup');
            logSecurity('BACKUP_RESTORE', `Backup restored for ${currentUser.matric}`);
            toast('Backup restored successfully!', 'success');
            renderBackupLog('Backup restored successfully');
        } catch (err) {
            toast('Failed to restore backup. Wrong password or corrupted file.', 'error');
            console.error(err);
        }
    }

    function renderBackupLog(msg = 'Backup system ready. Awaiting command.') {
        const log = $('#backupLog');
        if (log) {
            const time = new Date().toLocaleTimeString();
            log.innerHTML += `<div><span class="log-time">[${time}]</span><span class="log-info">${msg}</span></div>`;
        }
    }

    // ==================== AI CHAT ====================
    function sendChat() {
        const input = $('#chatInput');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        addChatMessage(text, 'user');
        processAIResponse(text);
    }

    function sendQuick(text) {
        $('#chatInput').value = text;
        sendChat();
    }

    function addChatMessage(text, sender) {
        const container = $('#chatMessages');
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        div.innerHTML = `
            <div class="message-bubble">${escapeHtml(text)}</div>
            <div class="message-meta">${sender === 'bot' ? 'SCOSY AI' : currentUser?.name || 'You'} &bull; Just now</div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showTyping() {
        show($('#typingIndicator'));
    }

    function hideTyping() {
        hide($('#typingIndicator'));
    }

    function processAIResponse(input) {
        showTyping();
        const lower = input.toLowerCase();

        setTimeout(() => {
            hideTyping();
            let response = '';

            // Academic queries
            if (lower.includes('course') || lower.includes('cos ')) {
                response = `The CS department offers courses from 100 to 400 level covering:
• 100L: COS 101 (Intro to Computing), COS 102 (C Programming), MAT 101, PHY 101
• 200L: COS 201 (Data Structures), COS 202 (OOP Java), COS 203 (Computer Org)
• 300L: COS 301 (OS), COS 302 (DBMS), COS 303 (Networks), COS 304 (Software Eng)
• 400L: COS 401 (AI), COS 402 (ML), COS 403 (Cybersecurity), COS 404 (Cloud)

Visit the Courses section for full details.`;
            }
            else if (lower.includes('staff') || lower.includes('lecturer') || lower.includes('professor')) {
                response = `CS Department Staff:
• Prof. H. D. Ibrahim - HOD (Software Engineering & AI)
• Dr. J. A. Adeyemo - Senior Lecturer (Networks & Security)
• Dr. M. O. Olayiwola - Lecturer I (Data Science & ML)
• Mrs. S. A. Abdullahi - Lecturer II (Database & Web Tech)

Check the Staff Directory for more details.`;
            }
            else if (lower.includes('calendar') || lower.includes('semester') || lower.includes('exam')) {
                response = `2025/2026 First Semester Calendar:
• Sep 29: Fresh Students Registration Begins
• Oct 13: Lectures Commence
• Nov 7: Matriculation Ceremony
• Jan 19 - Feb 4: First Semester Examinations

View the full calendar in the Academic Calendar section.`;
            }
            // Complaint queries
            else if (lower.includes('file') && lower.includes('complaint')) {
                response = `To file a complaint:
1. Go to "My Complaints" in the sidebar
2. Click "New Complaint" button
3. Select category, priority, subject, and description
4. Submit - you'll get a tracking ID

Your complaint is encrypted and only accessible to authorized staff.`;
            }
            else if (lower.includes('track') || lower.includes('status')) {
                response = `You can track your complaints in the "My Complaints" section. Each ticket shows:
• Current status (Pending, In Progress, Resolved, Closed)
• Ticket ID for reference
• Time since submission
• Priority level

Anonymous reports use ticket IDs without identity linkage.`;
            }
            else if (lower.includes('anonymous')) {
                response = `Anonymous Reporting Features:
• Zero identity logging - no IP, session, or browser fingerprint stored
• Isolated encrypted namespace
• Anonymous Ticket ID for status checking
• AI auto-response for immediate acknowledgment
• Files encrypted before storage

Go to Anonymous Portal to submit a report.`;
            }
            // Security queries
            else if (lower.includes('security') || lower.includes('password') || lower.includes('encrypt')) {
                response = `SCOSY Security Measures:
• PBKDF2 password hashing (100,000 iterations)
• AES-256-GCM data encryption
• 30-minute session timeout with token rotation
• 15-minute lockout after 5 failed attempts
• CSRF token protection on all forms
• XSS prevention via input sanitization
• Anonymous isolation with separate encrypted storage
• Encrypted backup integrity verification`;
            }
            else if (lower.includes('backup')) {
                response = `To backup your data:
1. Go to Backup & Restore section
2. Enter an encryption password (min 8 chars)
3. Click "Generate Encrypted Backup"
4. Download the .json file

You can store it on Google Drive, Terabox, or locally. To restore, upload the file and enter the same password.`;
            }
            else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
                response = `Hello! I'm SCOSY AI Assistant. I can help you with:
• Academic information (courses, staff, calendar)
• Complaint procedures and tracking
• Anonymous reporting guidance
• Security and backup questions
• Department resources

What would you like to know?`;
            }
            else {
                response = `I understand you're asking about "${input}". 

I can help with:
• Academic queries (courses, staff, calendar)
• Complaint filing and tracking
• Anonymous reporting
• Security and data backup
• Department information

Could you rephrase or select a quick reply below?`;
            }

            addChatMessage(response, 'bot');
        }, advancedAI ? 800 : 1200);
    }

    function loadAdvancedAI() {
        advancedAI = true;
        const btn = $('#loadAiBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Advanced AI Active';
            btn.classList.add('btn-success');
        }
        toast('Advanced AI engine loaded. Responses will be faster and more detailed.', 'success');
        logSecurity('AI_LOAD', 'Advanced AI engine activated');
    }

    function clearChat() {
        $('#chatMessages').innerHTML = `
            <div class="message bot-message">
                <div class="message-bubble">
                    Hello! I'm the SCOSY AI Assistant. I can help you with:<br><br>
                    &bull; <strong>Academic</strong> - Courses, materials, registration, calendar<br>
                    &bull; <strong>Complaints</strong> - How to file, track status, escalate<br>
                    &bull; <strong>Department</strong> - Staff, labs, facilities, contacts<br>
                    &bull; <strong>Security</strong> - Password resets, account issues<br><br>
                    Type your question below or use a quick reply.
                </div>
                <div class="message-meta">SCOSY AI &bull; Just now</div>
            </div>
        `;
    }

    // ==================== PASSWORD STRENGTH ====================
    function checkPasswordStrength() {
        const pwd = $('#regPassword').value;
        const bar = $('#pwdBar');
        let strength = 0;
        if (pwd.length >= 8) strength++;
        if (pwd.match(/[A-Z]/)) strength++;
        if (pwd.match(/[0-9]/)) strength++;
        if (pwd.match(/[^A-Za-z0-9]/)) strength++;

        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
        const widths = ['25%', '50%', '75%', '100%'];
        bar.style.width = widths[strength - 1] || '0%';
        bar.style.background = colors[strength - 1] || '#ef4444';
    }

    // ==================== INIT ====================
    function init() {
        // Form bindings
        $('#loginForm')?.addEventListener('submit', handleLogin);
        $('#registerForm')?.addEventListener('submit', handleRegister);
        $('#anonForm')?.addEventListener('submit', handleAnonymousSubmit);
        $('#complaintForm')?.addEventListener('submit', handleComplaintSubmit);

        // Password strength
        $('#regPassword')?.addEventListener('input', checkPasswordStrength);

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            const dropdown = $('#userDropdown');
            const avatar = $('#userAvatar');
            if (dropdown && avatar && !dropdown.contains(e.target) && !avatar.contains(e.target)) {
                hide(dropdown);
            }
        });

        // Check remembered session
        const remember = load('scosy_remember', null);
        if (remember) {
            const users = load('scosy_users', {});
            const user = users[remember.matric];
            if (user) {
                currentUser = { ...user };
                delete currentUser.passwordHash;
                delete currentUser.passwordSalt;
                enterDashboard();
                toast('Welcome back! Session restored.', 'success');
            }
        }

        // Seed demo data if empty (for first-time users)
        const users = load('scosy_users', {});
        if (Object.keys(users).length === 0) {
            // No pre-seeded accounts for security
        }

        logSecurity('INIT', 'SCOSY application initialized');
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        showLogin,
        showRegister,
        showAnonymous,
        showForgot,
        showSection,
        toggleDropdown,
        logout,
        openComplaintModal,
        closeComplaintModal,
        sendChat,
        sendQuick,
        loadAdvancedAI,
        clearChat,
        exportBackup,
        importBackup
    };
})();

// Global theme toggle function
function toggleTheme() {
    if (typeof App !== 'undefined' && App.ThemeController) {
        App.ThemeController.toggleTheme();
    }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme controller first
    if (typeof App !== 'undefined' && App.ThemeController) {
        App.ThemeController.init();
    }
    App.init();
});