/**
 * SCOSY — Authentication Module (Supabase)
 * Handles login, registration, anonymous complaints.
 * Depends on: supabase-client.js
 */
(function () {
    'use strict';

    // ---- DOM helpers ----
    const $ = (sel) => document.querySelector(sel);
    const show = (el) => el && el.classList.remove('hidden');
    const hide = (el) => el && el.classList.add('hidden');

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
        }, 4500);
    }

    // ---- Spinner helpers ----
    function setLoading(btnId, spinnerId, textId, loading, loadingText, defaultText) {
        const btn = $(btnId);
        const spinner = $(spinnerId);
        const text = $(textId);
        if (btn) btn.disabled = loading;
        if (spinner) spinner.classList.toggle('hidden', !loading);
        if (text) text.textContent = loading ? loadingText : defaultText;
    }

    // ---- Slide animations ----
    window.slideToRegister = function () {
        const container = $('#authPage .auth-container');
        if (container) container.classList.add('register-mode');
    };

    window.slideToLogin = function () {
        const container = $('#authPage .auth-container');
        if (container) container.classList.remove('register-mode');
    };

    window.showAnonymousForm = function () {
        hide($('#authPage'));
        show($('#anonymousPage'));
    };

    window.showLogin = function () {
        hide($('#anonymousPage'));
        show($('#authPage'));
        slideToLogin();
    };

    window.showForgotPassword = function () {
        toast('Contact the CS department admin to reset your password.', 'info');
    };

    // ---- Role toggle ----
    window.handleRoleChange = function (role) {
        const studentFields = $('#studentFields');
        const adminFields = $('#adminFields');
        const confirmField = $('#confirmPasswordField');

        if (role === 'Admin') {
            hide(studentFields);
            show(adminFields);
            hide(confirmField);
        } else {
            show(studentFields);
            hide(adminFields);
            show(confirmField);
        }
    };

    // ---- Password strength ----
    function checkPasswordStrength(password, barId) {
        const bar = $(barId);
        if (!bar) return;
        const parent = bar.parentElement;
        if (parent) parent.classList.add('show');

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
        const widths = ['25%', '50%', '75%', '100%'];
        bar.style.width = widths[strength - 1] || '0%';
        bar.style.background = colors[strength - 1] || '#ef4444';
    }

    // ---- LOGIN ----
    async function handleLogin(e) {
        e.preventDefault();

        const identifier = $('#loginEmail').value.trim();
        const password = $('#loginPassword').value;
        const remember = $('#rememberMe').checked;

        if (!identifier || !password) {
            toast('Please enter your credentials.', 'error');
            return;
        }

        setLoading('#loginBtn', '#loginSpinner', '#loginText', true, 'Authenticating…', 'Sign In Securely');

        try {
            // Determine email — if they typed a matric or staff ID, look up the email
            let email = identifier;

            if (!identifier.includes('@')) {
                // Look up by matric or staff_id
                const { data: profiles } = await db
                    .from('profiles')
                    .select('email')
                    .or(`matric.eq.${identifier.toUpperCase()},staff_id.eq.${identifier}`)
                    .limit(1);

                if (!profiles || profiles.length === 0) {
                    toast('Account not found. Check your matric number or staff ID.', 'error');
                    return;
                }
                email = profiles[0].email;
            }

            const { session } = await Auth.login(email, password);
            if (!session) throw new Error('Login failed');

            const profile = await Auth.getProfile(session.user.id);
            await Auth.updateLastLogin(session.user.id);

            // Check admin approval
            if (profile.user_type === 'admin' && profile.approval_status !== 'approved') {
                await Auth.logout();
                toast('Your admin account is pending approval by a Level 1 administrator.', 'error');
                return;
            }

            // Request notification permission
            await PushNotify.requestPermission();

            toast(`Welcome back, ${profile.name.split(' ')[0]}!`, 'success');

            setTimeout(() => {
                if (profile.user_type === 'admin') {
                    window.location.href = '../pages/admin-dashboard.html';
                } else {
                    window.location.href = '../pages/student-dashboard.html';
                }
            }, 800);

        } catch (err) {
            console.error('Login error:', err);
            toast(err.message === 'Invalid login credentials'
                ? 'Invalid credentials. Please try again.'
                : err.message || 'Login failed.', 'error');
        } finally {
            setLoading('#loginBtn', '#loginSpinner', '#loginText', false, '', 'Sign In Securely');
        }
    }

    // ---- REGISTER ----
    async function handleRegister(e) {
        e.preventDefault();

        const role = $('#userRole').value;
        setLoading('#regBtn', '#regSpinner', '#regText', true, 'Creating Account…', 'Create Secure Account');

        try {
            if (role === 'Admin') {
                const staffId   = $('#regStaffId').value.trim();
                const name      = $('#regAdminName').value.trim();
                const position  = $('#regPosition').value;
                const email     = $('#regAdminEmail').value.trim();
                const password  = $('#regAdminPassword').value;
                const confirm   = $('#regAdminConfirm').value;

                if (!staffId || !name || !position || !email || !password) {
                    toast('Please fill all required fields.', 'error');
                    return;
                }
                if (password !== confirm) {
                    toast('Passwords do not match.', 'error');
                    return;
                }
                if (password.length < 8) {
                    toast('Password must be at least 8 characters.', 'error');
                    return;
                }

                await Auth.registerAdmin({ name, staffId, email, position, password });
                toast('Admin account created! Awaiting Level 1 admin approval.', 'success');
                setTimeout(slideToLogin, 2000);

            } else {
                const name     = $('#regName').value.trim();
                const matric   = $('#regMatric').value.trim();
                const email    = $('#regEmail').value.trim();
                const level    = $('#regLevel').value;
                const password = $('#regPassword').value;
                const confirm  = $('#regConfirm').value;

                if (!name || !matric || !email || !level || !password) {
                    toast('Please fill all required fields.', 'error');
                    return;
                }
                if (password !== confirm) {
                    const err = $('#pwdError');
                    if (err) err.classList.add('show');
                    return;
                }
                const err = $('#pwdError');
                if (err) err.classList.remove('show');

                if (password.length < 8) {
                    toast('Password must be at least 8 characters.', 'error');
                    return;
                }

                await Auth.registerStudent({ name, matric, email, level, password });
                toast('Account created! Please check your email to confirm, then sign in.', 'success');
                setTimeout(slideToLogin, 2500);
            }

        } catch (err) {
            console.error('Registration error:', err);
            if (err.message?.includes('already registered') || err.message?.includes('duplicate')) {
                toast('An account with this email or matric already exists.', 'error');
            } else {
                toast(err.message || 'Registration failed. Please try again.', 'error');
            }
        } finally {
            setLoading('#regBtn', '#regSpinner', '#regText', false, '', 'Create Secure Account');
        }
    }

    // ---- ANONYMOUS COMPLAINT ----
    async function handleAnonymous(e) {
        e.preventDefault();

        const category = $('#anonCategory').value;
        const urgency  = $('#anonUrgency').value;
        const subject  = $('#anonSubject').value.trim();
        const message  = $('#anonMessage').value.trim();

        if (!category || !subject || !message) {
            toast('Please fill all required fields.', 'error');
            return;
        }

        setLoading('#anonBtn', '#anonSpinner', '#anonText', true, 'Submitting…', 'Submit Anonymously');

        try {
            await Complaints.submit({
                studentId: null,
                studentName: 'Anonymous',
                studentMatric: null,
                category,
                priority: urgency,
                subject,
                message,
                isAnonymous: true
            });

            toast('Anonymous complaint submitted successfully!', 'success');
            $('#anonForm').reset();
            setTimeout(showLogin, 2000);

        } catch (err) {
            console.error('Anonymous complaint error:', err);
            toast('Failed to submit complaint. Please try again.', 'error');
        } finally {
            setLoading('#anonBtn', '#anonSpinner', '#anonText', false, '', 'Submit Anonymously');
        }
    }

    // ---- INIT ----
    function init() {
        // Check if already logged in — redirect away from login page
        Auth.getSession().then(session => {
            if (session) {
                Auth.getProfile(session.user.id).then(profile => {
                    if (profile.user_type === 'admin' && profile.approval_status === 'approved') {
                        window.location.href = '../pages/admin-dashboard.html';
                    } else if (profile.user_type === 'student') {
                        window.location.href = '../pages/student-dashboard.html';
                    }
                }).catch(() => {});
            }
        });

        const loginForm = $('#loginForm');
        if (loginForm) loginForm.addEventListener('submit', handleLogin);

        const registerForm = $('#registerForm');
        if (registerForm) registerForm.addEventListener('submit', handleRegister);

        const anonForm = $('#anonForm');
        if (anonForm) anonForm.addEventListener('submit', handleAnonymous);

        // Password strength meters
        const regPassword = $('#regPassword');
        if (regPassword) {
            regPassword.addEventListener('input', () => checkPasswordStrength(regPassword.value, '#pwdBar'));
        }
        const adminPassword = $('#regAdminPassword');
        if (adminPassword) {
            adminPassword.addEventListener('input', () => checkPasswordStrength(adminPassword.value, '#adminPwdBar'));
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
