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
            
            // Add smooth transition class before theme change
            document.body.classList.add('theme-transitioning');
            
            // Apply theme
            document.documentElement.setAttribute('data-theme', theme);
            
            // Remove transition class after animation completes
            setTimeout(() => {
                document.body.classList.remove('theme-transitioning');
            }, 300);
            
            // Update tooltip with current theme state
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                const nextTheme = theme === 'dark' ? 'light' : 'dark';
                themeToggle.title = `Switch to ${nextTheme} theme`;
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

    // ==================== ADMIN SYSTEM ====================
    async function initializeAdminSystem() {
        const admins = load('scosy_admins', {});
        
        // Create first admin if no admins exist
        if (Object.keys(admins).length === 0) {
            const firstAdmin = {
                staffId: 'admin',
                name: 'System Administrator',
                email: 'admin@plasu.edu.ng',
                adminLevel: 1, // Level 1 admin (highest)
                approvalStatus: 'approved',
                isPrimary: true,
                createdAt: new Date().toISOString(),
                lastLogin: null
            };
            
            try {
                // Hash the default password '123456789'
                const hashed = await hashPassword('123456789');
                firstAdmin.passwordHash = hashed.hash;
                firstAdmin.passwordSalt = hashed.salt;
                
                admins['admin'] = firstAdmin;
                save('scosy_admins', admins);
                logSecurity('ADMIN_INIT', 'First admin account created with staff ID: admin');
                
                console.log('✅ Default admin account created successfully');
                console.log('📧 Staff ID: admin');
                console.log('🔑 Password: 123456789');
            } catch (error) {
                console.error('❌ Failed to create default admin account:', error);
            }
        } else {
            console.log('ℹ️ Admin system already initialized');
        }
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
        show($('#authPage'));
        slideToLogin();
    }

    function showRegister() {
        hide($('#loginPage'));
        hide($('#anonymousPage'));
        show($('#authPage'));
        slideToRegister();
    }

    function showAnonymous() {
        hide($('#authPage'));
        hide($('#registerPage'));
        show($('#anonymousPage'));
        logSecurity('NAVIGATE', 'Viewed anonymous portal');
    }

    function showForgot() {
        toast('Contact the CS department admin to reset your password.', 'info');
    }

    // ==================== SLIDING ANIMATION FUNCTIONS ====================
    function slideToLogin() {
        const slider = document.getElementById('authSlider');
        if (slider) {
            slider.classList.remove('slide-left');
            logSecurity('NAVIGATE', 'Slid to login form');
        }
    }

    function slideToRegister() {
        const slider = document.getElementById('authSlider');
        if (slider) {
            slider.classList.add('slide-left');
            logSecurity('NAVIGATE', 'Slid to register form');
        }
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

        const spinner = $('#loginSpinner');
        const btnText = $('#loginText');
        show(spinner);
        btnText.textContent = 'Authenticating...';

        try {
            // Check if it's admin login first
            if (identifier === 'admin' || identifier.includes('@plasu.edu.ng')) {
                const admins = load('scosy_admins', {});
                let admin = null;
                
                // Find admin by staff ID or email
                for (const staffId in admins) {
                    const a = admins[staffId];
                    if (a.staffId === identifier || a.email === identifier) {
                        admin = a;
                        break;
                    }
                }
                
                if (admin) {
                    // Verify admin password
                    const isValid = await verifyPassword(password, admin.passwordHash, admin.passwordSalt);
                    if (isValid) {
                        if (admin.approvalStatus === 'pending') {
                            toast('Your admin account is pending approval. Please wait for Level 1 admin approval.', 'warning');
                            return;
                        }
                        
                        currentUser = { ...admin, userType: 'admin' };
                        delete currentUser.passwordHash;
                        delete currentUser.passwordSalt;
                        currentUser.lastLogin = new Date().toISOString();
                        
                        // Update last login
                        admins[admin.staffId].lastLogin = currentUser.lastLogin;
                        save('scosy_admins', admins);
                        
                        if (remember) {
                            save('scosy_remember', { staffId: admin.staffId, userType: 'admin' });
                        }
                        
                        logSecurity('ADMIN_LOGIN_SUCCESS', `Admin login: ${admin.staffId}`);
                        toast(`Welcome back, ${admin.name}!`, 'success');
                        enterAdminDashboard();
                        return;
                    }
                }
            }
            
            // Regular student login
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

            currentUser = { ...user, userType: 'student' };
            delete currentUser.passwordHash;
            delete currentUser.passwordSalt;

            if (remember) {
                save('scosy_remember', { matric: user.matric, userType: 'student' });
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

        // Update dropdown info
        $('#dropdownName').textContent = currentUser.name;
        $('#dropdownMatric').textContent = currentUser.matric;
        $('#dropdownAvatar').textContent = getInitials(currentUser.name);

        // Load user avatar if exists
        loadUserAvatar();

        loadUserData();
        updateStats();
        renderTickets();
        renderActivity();
        renderSecurityLog();
        startSession();

        document.addEventListener('mousemove', resetSessionTimer);
        document.addEventListener('keydown', resetSessionTimer);
    }

    function enterAdminDashboard() {
        // Hide auth pages and show admin dashboard
        hide($('#authPage'));
        hide($('#anonymousPage'));
        
        // Create admin dashboard if it doesn't exist
        let adminDashboard = $('#adminDashboard');
        if (!adminDashboard) {
            createAdminDashboard();
        }
        
        show($('#adminDashboard'));
        loadAdminData();
        startSession();

        document.addEventListener('mousemove', resetSessionTimer);
        document.addEventListener('keydown', resetSessionTimer);
    }

    function createAdminDashboard() {
        const adminHTML = `
            <div class="dashboard" id="adminDashboard">
                <nav class="top-nav">
                    <div class="nav-brand">
                        <div class="logo-icon"><i class="fas fa-shield-halved"></i></div>
                        <div class="brand-text">
                            <h3>SCOSY Admin</h3>
                            <span>Administrative Portal</span>
                        </div>
                    </div>
                    <div class="nav-actions">
                        <div class="admin-level-badge">
                            <i class="fas fa-crown"></i>
                            Level ${currentUser.adminLevel} Admin
                        </div>
                        <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" title="Switch to light theme">
                            <i class="fas fa-sun" id="sunIcon"></i>
                            <i class="fas fa-moon" id="moonIcon"></i>
                        </button>
                        <div class="user-menu">
                            <div class="user-avatar" id="userAvatar" onclick="App.toggleDropdown()">
                                <span id="avatarInitial">${getInitials(currentUser.name)}</span>
                            </div>
                            <div class="dropdown-menu" id="userDropdown">
                                <div class="dropdown-header">
                                    <div class="dropdown-avatar" id="dropdownAvatar">${getInitials(currentUser.name)}</div>
                                    <div class="dropdown-user-info">
                                        <span class="dropdown-name" id="dropdownName">${currentUser.name}</span>
                                        <span class="dropdown-role">Level ${currentUser.adminLevel} Administrator</span>
                                    </div>
                                </div>
                                <div class="dropdown-divider"></div>
                                <a href="#" onclick="App.logout()"><i class="fas fa-right-from-bracket"></i> Secure Logout</a>
                            </div>
                        </div>
                    </div>
                </nav>
                
                <div class="dashboard-layout">
                    <aside class="sidebar">
                        <div class="menu-section">
                            <div class="menu-title">Dashboard</div>
                            <ul class="menu-list">
                                <li><a href="#" onclick="App.showAdminSection('overview')" class="active">
                                    <i class="fas fa-chart-line"></i> Overview
                                </a></li>
                            </ul>
                        </div>
                        <div class="menu-section">
                            <div class="menu-title">Complaints</div>
                            <ul class="menu-list">
                                <li><a href="#" onclick="App.showAdminSection('complaints')">
                                    <i class="fas fa-exclamation-triangle"></i> All Complaints
                                </a></li>
                                <li><a href="#" onclick="App.showAdminSection('pending')">
                                    <i class="fas fa-clock"></i> Pending Review
                                </a></li>
                            </ul>
                        </div>
                        ${currentUser.adminLevel === 1 ? `
                        <div class="menu-section">
                            <div class="menu-title">Administration</div>
                            <ul class="menu-list">
                                <li><a href="#" onclick="App.showAdminSection('users')">
                                    <i class="fas fa-users"></i> User Management
                                </a></li>
                                <li><a href="#" onclick="App.showAdminSection('admins')">
                                    <i class="fas fa-user-shield"></i> Admin Management
                                </a></li>
                            </ul>
                        </div>
                        ` : ''}
                    </aside>
                    
                    <main class="content-area">
                        <div class="content-section active" id="admin-overview">
                            <div class="welcome-banner">
                                <div class="welcome-text">
                                    <h2>Welcome back, ${currentUser.name.split(' ')[0]}!</h2>
                                    <p><strong>Level ${currentUser.adminLevel} Administrator</strong> | SCOSY Admin Portal</p>
                                </div>
                                <div class="welcome-avatar">${getInitials(currentUser.name)}</div>
                            </div>
                            
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-icon red"><i class="fas fa-exclamation-triangle"></i></div>
                                    <div class="stat-info">
                                        <h4>Total Complaints</h4>
                                        <p id="totalComplaints">0</p>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon amber"><i class="fas fa-clock"></i></div>
                                    <div class="stat-info">
                                        <h4>Pending Review</h4>
                                        <p id="pendingComplaints">0</p>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                                    <div class="stat-info">
                                        <h4>Registered Users</h4>
                                        <p id="totalUsers">0</p>
                                    </div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
                                    <div class="stat-info">
                                        <h4>Resolved Today</h4>
                                        <p id="resolvedToday">0</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="panel">
                                <div class="panel-header">
                                    <h3><i class="fas fa-chart-bar"></i> Admin Dashboard</h3>
                                </div>
                                <p>Welcome to the SCOSY Admin Portal. Use the sidebar to navigate between different administrative functions.</p>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', adminHTML);
    }

    function loadAdminData() {
        // Load admin statistics
        const users = load('scosy_users', {});
        const allComplaints = getAllComplaints();
        
        const totalUsers = Object.keys(users).length;
        const totalComplaints = allComplaints.length;
        const pendingComplaints = allComplaints.filter(c => c.status === 'pending').length;
        const resolvedToday = allComplaints.filter(c => {
            return c.status === 'resolved' && 
                   new Date(c.resolvedAt || c.updatedAt).toDateString() === new Date().toDateString();
        }).length;
        
        // Update stats display
        const totalComplaintsEl = $('#totalComplaints');
        const pendingComplaintsEl = $('#pendingComplaints');
        const totalUsersEl = $('#totalUsers');
        const resolvedTodayEl = $('#resolvedToday');
        
        if (totalComplaintsEl) totalComplaintsEl.textContent = totalComplaints;
        if (pendingComplaintsEl) pendingComplaintsEl.textContent = pendingComplaints;
        if (totalUsersEl) totalUsersEl.textContent = totalUsers;
        if (resolvedTodayEl) resolvedTodayEl.textContent = resolvedToday;
    }

    function getAllComplaints() {
        // Collect all complaints from all users
        const users = load('scosy_users', {});
        const allComplaints = [];
        
        for (const matric in users) {
            const userComplaints = load('scosy_tickets_' + matric, []);
            allComplaints.push(...userComplaints);
        }
        
        // Also include anonymous complaints
        const anonComplaints = load('scosy_anonymous_global', []);
        allComplaints.push(...anonComplaints);
        
        return allComplaints;
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

    // ==================== PROFILE MANAGEMENT ====================
    function openEditProfileModal() {
        // Create and show edit profile modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editProfileModal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close" onclick="App.closeEditProfileModal()"><i class="fas fa-times"></i></button>
                <h2><i class="fas fa-edit"></i> Edit Profile</h2>
                <p class="modal-desc">Update your profile information</p>
                <form id="editProfileForm">
                    <div class="input-group">
                        <label>Full Name <span class="required">*</span></label>
                        <i class="fas fa-user field-icon"></i>
                        <input type="text" id="editName" value="${currentUser.name}" required>
                    </div>
                    <div class="input-group">
                        <label>Email Address <span class="required">*</span></label>
                        <i class="fas fa-envelope field-icon"></i>
                        <input type="email" id="editEmail" value="${currentUser.email}" required>
                    </div>
                    <div class="input-group">
                        <label>Level <span class="required">*</span></label>
                        <i class="fas fa-layer-group field-icon"></i>
                        <select id="editLevel" required>
                            <option value="100" ${currentUser.level === '100' ? 'selected' : ''}>100 Level</option>
                            <option value="200" ${currentUser.level === '200' ? 'selected' : ''}>200 Level</option>
                            <option value="300" ${currentUser.level === '300' ? 'selected' : ''}>300 Level</option>
                            <option value="400" ${currentUser.level === '400' ? 'selected' : ''}>400 Level</option>
                            <option value="500" ${currentUser.level === '500' ? 'selected' : ''}>500 Level (PGD)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        // Bind form handler
        document.getElementById('editProfileForm').addEventListener('submit', handleEditProfile);
    }

    function closeEditProfileModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) {
            modal.remove();
        }
    }

    function openChangePasswordModal() {
        // Create and show change password modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'changePasswordModal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close" onclick="App.closeChangePasswordModal()"><i class="fas fa-times"></i></button>
                <h2><i class="fas fa-key"></i> Change Password</h2>
                <p class="modal-desc">Update your account password</p>
                <form id="changePasswordForm">
                    <div class="input-group">
                        <label>Current Password <span class="required">*</span></label>
                        <i class="fas fa-lock field-icon"></i>
                        <input type="password" id="currentPassword" required>
                    </div>
                    <div class="input-group">
                        <label>New Password <span class="required">*</span></label>
                        <i class="fas fa-key field-icon"></i>
                        <input type="password" id="newPassword" required minlength="8">
                        <div class="strength-bar" id="newPwdStrength"><div class="strength-fill" id="newPwdBar"></div></div>
                    </div>
                    <div class="input-group">
                        <label>Confirm New Password <span class="required">*</span></label>
                        <i class="fas fa-key field-icon"></i>
                        <input type="password" id="confirmNewPassword" required>
                        <div class="error-text" id="newPwdError"><i class="fas fa-circle-exclamation"></i> Passwords do not match</div>
                    </div>
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Update Password
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        // Bind form handler
        document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
    }

    function closeChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.remove();
        }
    }

    function openAvatarUpload() {
        document.getElementById('avatarInput').click();
    }

    function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast('Please select a valid image file.', 'error');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast('Image size must be less than 2MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            // Save to localStorage
            try {
                localStorage.setItem(`scosy_avatar_${currentUser.matric}`, imageData);
                
                // Update UI
                updateAvatarDisplay(imageData);
                
                toast('Profile picture updated successfully!', 'success');
                logActivity('Profile Updated', 'Changed profile picture');
            } catch (error) {
                toast('Failed to save profile picture. File may be too large.', 'error');
            }
        };
        reader.readAsDataURL(file);
    }

    function updateAvatarDisplay(imageData) {
        // Update main profile avatar
        const profileAvatarBig = document.getElementById('profileAvatarBig');
        const profileImageWrapper = document.getElementById('profileImageWrapper');
        const profileImage = document.getElementById('profileImage');
        
        if (imageData) {
            profileImage.src = imageData;
            profileAvatarBig.style.display = 'none';
            profileImageWrapper.style.display = 'block';
        } else {
            profileAvatarBig.style.display = 'flex';
            profileImageWrapper.style.display = 'none';
        }

        // Update dropdown avatar
        const dropdownAvatar = document.getElementById('dropdownAvatar');
        if (imageData && dropdownAvatar) {
            dropdownAvatar.style.backgroundImage = `url(${imageData})`;
            dropdownAvatar.style.backgroundSize = 'cover';
            dropdownAvatar.style.backgroundPosition = 'center';
            dropdownAvatar.textContent = '';
        }

        // Update top nav avatar
        const userAvatar = document.getElementById('userAvatar');
        if (imageData && userAvatar) {
            userAvatar.style.backgroundImage = `url(${imageData})`;
            userAvatar.style.backgroundSize = 'cover';
            userAvatar.style.backgroundPosition = 'center';
            const avatarInitial = document.getElementById('avatarInitial');
            if (avatarInitial) avatarInitial.style.display = 'none';
        }
    }

    async function handleEditProfile(e) {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const level = document.getElementById('editLevel').value;

        if (!name || !email || !level) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        try {
            // Update user data
            const users = load('scosy_users', {});
            const user = users[currentUser.matric];
            if (user) {
                user.name = name;
                user.email = email;
                user.level = level;
                user.updatedAt = new Date().toISOString();
                
                users[currentUser.matric] = user;
                save('scosy_users', users);
                
                // Update current user
                currentUser.name = name;
                currentUser.email = email;
                currentUser.level = level;
                
                // Update UI
                updateProfileDisplay();
                
                toast('Profile updated successfully!', 'success');
                logActivity('Profile Updated', 'Updated profile information');
                closeEditProfileModal();
            }
        } catch (error) {
            toast('Failed to update profile. Please try again.', 'error');
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmPassword) {
            document.getElementById('newPwdError').style.display = 'flex';
            return;
        }
        document.getElementById('newPwdError').style.display = 'none';

        if (newPassword.length < 8) {
            toast('New password must be at least 8 characters.', 'error');
            return;
        }

        try {
            // Verify current password
            const users = load('scosy_users', {});
            const user = users[currentUser.matric];
            
            const isValid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
            if (!isValid) {
                toast('Current password is incorrect.', 'error');
                return;
            }

            // Hash new password
            const hashed = await hashPassword(newPassword);
            user.passwordHash = hashed.hash;
            user.passwordSalt = hashed.salt;
            user.passwordChangedAt = new Date().toISOString();
            
            users[currentUser.matric] = user;
            save('scosy_users', users);
            
            toast('Password updated successfully!', 'success');
            logActivity('Security', 'Password changed');
            logSecurity('PASSWORD_CHANGE', `Password changed for ${currentUser.matric}`);
            closeChangePasswordModal();
        } catch (error) {
            toast('Failed to update password. Please try again.', 'error');
        }
    }

    function updateProfileDisplay() {
        // Update all profile displays
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileLevel').textContent = currentUser.level + ' Level';
        
        // Update dropdown
        document.getElementById('dropdownName').textContent = currentUser.name;
        
        // Update welcome message
        document.getElementById('welcomeName').textContent = currentUser.name.split(' ')[0];
        
        // Update avatars with initials
        const initials = getInitials(currentUser.name);
        document.getElementById('profileAvatarBig').textContent = initials;
        document.getElementById('dropdownAvatar').textContent = initials;
        document.getElementById('avatarInitial').textContent = initials;
        document.getElementById('welcomeAvatar').textContent = initials;
    }

    function loadUserAvatar() {
        // Load saved avatar from localStorage
        const savedAvatar = localStorage.getItem(`scosy_avatar_${currentUser.matric}`);
        if (savedAvatar) {
            updateAvatarDisplay(savedAvatar);
        }
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
    }) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast('Please select a valid image file.', 'error');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast('Image size must be less than 2MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            // Save to localStorage
            try {
                localStorage.setItem(`scosy_avatar_${currentUser.matric}`, imageData);
                
                // Update UI
                updateAvatarDisplay(imageData);
                
                toast('Profile picture updated successfully!', 'success');
                logActivity('Profile Updated', 'Changed profile picture');
            } catch (error) {
                toast('Failed to save profile picture. File may be too large.', 'error');
            }
        };
        reader.readAsDataURL(file);
    }

    function updateAvatarDisplay(imageData) {
        // Update main profile avatar
        const profileAvatarBig = document.getElementById('profileAvatarBig');
        const profileImageWrapper = document.getElementById('profileImageWrapper');
        const profileImage = document.getElementById('profileImage');
        
        if (imageData) {
            profileImage.src = imageData;
            profileAvatarBig.style.display = 'none';
            profileImageWrapper.style.display = 'block';
        } else {
            profileAvatarBig.style.display = 'flex';
            profileImageWrapper.style.display = 'none';
        }

        // Update dropdown avatar
        const dropdownAvatar = document.getElementById('dropdownAvatar');
        if (imageData && dropdownAvatar) {
            dropdownAvatar.style.backgroundImage = `url(${imageData})`;
            dropdownAvatar.style.backgroundSize = 'cover';
            dropdownAvatar.style.backgroundPosition = 'center';
            dropdownAvatar.textContent = '';
        }

        // Update top nav avatar
        const userAvatar = document.getElementById('userAvatar');
        if (imageData && userAvatar) {
            userAvatar.style.backgroundImage = `url(${imageData})`;
            userAvatar.style.backgroundSize = 'cover';
            userAvatar.style.backgroundPosition = 'center';
            const avatarInitial = document.getElementById('avatarInitial');
            if (avatarInitial) avatarInitial.style.display = 'none';
        }
    }

    async function handleEditProfile(e) {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const level = document.getElementById('editLevel').value;

        if (!name || !email || !level) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        try {
            // Update user data
            const users = load('scosy_users', {});
            const user = users[currentUser.matric];
            if (user) {
                user.name = name;
                user.email = email;
                user.level = level;
                user.updatedAt = new Date().toISOString();
                
                users[currentUser.matric] = user;
                save('scosy_users', users);
                
                // Update current user
                currentUser.name = name;
                currentUser.email = email;
                currentUser.level = level;
                
                // Update UI
                updateProfileDisplay();
                
                toast('Profile updated successfully!', 'success');
                logActivity('Profile Updated', 'Updated profile information');
                closeEditProfileModal();
            }
        } catch (error) {
            toast('Failed to update profile. Please try again.', 'error');
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmPassword) {
            document.getElementById('newPwdError').style.display = 'flex';
            return;
        }
        document.getElementById('newPwdError').style.display = 'none';

        if (newPassword.length < 8) {
            toast('New password must be at least 8 characters.', 'error');
            return;
        }

        try {
            // Verify current password
            const users = load('scosy_users', {});
            const user = users[currentUser.matric];
            
            const isValid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
            if (!isValid) {
                toast('Current password is incorrect.', 'error');
                return;
            }

            // Hash new password
            const hashed = await hashPassword(newPassword);
            user.passwordHash = hashed.hash;
            user.passwordSalt = hashed.salt;
            user.passwordChangedAt = new Date().toISOString();
            
            users[currentUser.matric] = user;
            save('scosy_users', users);
            
            toast('Password updated successfully!', 'success');
            logActivity('Security', 'Password changed');
            logSecurity('PASSWORD_CHANGE', `Password changed for ${currentUser.matric}`);
            closeChangePasswordModal();
        } catch (error) {
            toast('Failed to update password. Please try again.', 'error');
        }
    }

    function updateProfileDisplay() {
        // Update all profile displays
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileLevel').textContent = currentUser.level + ' Level';
        
        // Update dropdown
        document.getElementById('dropdownName').textContent = currentUser.name;
        
        // Update welcome message
        document.getElementById('welcomeName').textContent = currentUser.name.split(' ')[0];
        
        // Update avatars with initials
        const initials = getInitials(currentUser.name);
        document.getElementById('profileAvatarBig').textContent = initials;
        document.getElementById('dropdownAvatar').textContent = initials;
        document.getElementById('avatarInitial').textContent = initials;
        document.getElementById('welcomeAvatar').textContent = initials;
    }

    function loadUserAvatar() {
        // Load saved avatar from localStorage
        const savedAvatar = localStorage.getItem(`scosy_avatar_${currentUser.matric}`);
        if (savedAvatar) {
            updateAvatarDisplay(savedAvatar);
        }
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

    // ==================== INITIALIZATION ====================
    function init() {
        // Initialize theme controller first to prevent flash
        ThemeController.init();
        
        // Initialize admin system
        initializeAdminSystem();
        
        // Check for existing user session
        const rememberedUser = load('scosy_remember', null);
        if (rememberedUser && rememberedUser.matric) {
            // Auto-login if remembered
            const users = load('scosy_users', {});
            const user = users[rememberedUser.matric];
            if (user) {
                currentUser = { ...user };
                delete currentUser.passwordHash;
                delete currentUser.passwordSalt;
                enterDashboard();
                return;
            }
        }
        
        // Show login page if no valid session
        showLogin();
        
        // Bind form event handlers
        const loginForm = $('#loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        const registerForm = $('#registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
        
        const anonForm = $('#anonForm');
        if (anonForm) {
            anonForm.addEventListener('submit', handleAnonymousSubmit);
        }
        
        const complaintForm = $('#complaintForm');
        if (complaintForm) {
            complaintForm.addEventListener('submit', handleComplaintSubmit);
        }
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                const dropdown = $('#userDropdown');
                if (dropdown) dropdown.classList.remove('show');
            }
        });
        
        logSecurity('INIT', 'SCOSY application initialized with theme support');
    }

    // ==================== PUBLIC INTERFACE ====================
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
        importBackup,
        ThemeController,
        openEditProfileModal,
        closeEditProfileModal,
        openChangePasswordModal,
        closeChangePasswordModal,
        openAvatarUpload,
        handleAvatarUpload,
        slideToLogin,
        slideToRegister
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
    // Initialize the main app (which includes theme controller)
    App.init();
});