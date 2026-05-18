/**
 * SCOSY — Supabase Client
 * Single module for all database and auth operations.
 * Loaded before auth.js, student.js, admin.js.
 *
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values.
 * Get them from: Supabase Dashboard → Settings → API
 */

// ---- Config ----
const SUPABASE_URL  = 'https://fsxylpuqsvggoqyyrpdz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeHlscHVxc3ZnZ29xeXlycGR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDA2NjQsImV4cCI6MjA5NDY3NjY2NH0.Zhi4J_kwURxnoT-rJNHu9k9k2tyFLm6WfKl_RdorgCg';

// ---- Init ----
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// AUTH
// ============================================================
const Auth = {
    /** Sign up a new student */
    async registerStudent({ name, matric, email, level, password }) {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
                data: { name, matric, level, user_type: 'student' }
            }
        });
        if (error) throw error;

        // Insert profile row
        const { error: profileError } = await db.from('profiles').insert({
            id: data.user.id,
            user_type: 'student',
            name,
            email,
            matric: matric.toUpperCase(),
            level
        });
        if (profileError) throw profileError;

        return data.user;
    },

    /** Sign up a new admin (pending approval) */
    async registerAdmin({ name, staffId, email, position, password }) {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
                data: { name, staff_id: staffId, user_type: 'admin' }
            }
        });
        if (error) throw error;

        const { error: profileError } = await db.from('profiles').insert({
            id: data.user.id,
            user_type: 'admin',
            name,
            email,
            staff_id: staffId,
            position,
            admin_level: 2,
            approval_status: 'pending'
        });
        if (profileError) throw profileError;

        return data.user;
    },

    /** Sign in with email + password */
    async login(email, password) {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    /** Sign out */
    async logout() {
        const { error } = await db.auth.signOut();
        if (error) throw error;
    },

    /** Get current session */
    async getSession() {
        const { data } = await db.auth.getSession();
        return data.session;
    },

    /** Get current user profile — uses session token to bypass RLS timing issue */
    async getProfile(userId) {
        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) {
            // If RLS blocks it, try with service role workaround via maybeSingle
            const { data: d2, error: e2 } = await db
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (e2) throw e2;
            if (!d2) throw new Error('Profile not found. Please contact support.');
            return d2;
        }
        return data;
    },

    /** Update last login timestamp */
    async updateLastLogin(userId) {
        await db.from('profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', userId);
    },

    /** Listen for auth state changes */
    onAuthChange(callback) {
        return db.auth.onAuthStateChange(callback);
    }
};

// ============================================================
// COMPLAINTS
// ============================================================
const Complaints = {
    /** Submit a new complaint */
    async submit({ studentId, studentName, studentMatric, category, priority, subject, message, isAnonymous }) {
        const { data, error } = await db.from('complaints').insert({
            student_id: isAnonymous ? null : studentId,
            student_name: isAnonymous ? 'Anonymous' : studentName,
            student_matric: isAnonymous ? null : studentMatric,
            category,
            priority,
            subject,
            message,
            is_anonymous: isAnonymous
        }).select().single();
        if (error) throw error;
        return data;
    },

    /** Get complaints for a student */
    async getForStudent(studentId) {
        const { data, error } = await db
            .from('complaints')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /** Get all complaints (admin) */
    async getAll() {
        const { data, error } = await db
            .from('complaints')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /** Update complaint status */
    async updateStatus(complaintId, updates) {
        const { data, error } = await db
            .from('complaints')
            .update(updates)
            .eq('id', complaintId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    /** Subscribe to complaint changes for a student */
    subscribeStudent(studentId, callback) {
        return db
            .channel(`complaints:student:${studentId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'complaints',
                filter: `student_id=eq.${studentId}`
            }, callback)
            .subscribe();
    },

    /** Subscribe to all complaint changes (admin) */
    subscribeAdmin(callback) {
        return db
            .channel('complaints:admin')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'complaints'
            }, callback)
            .subscribe();
    }
};

// ============================================================
// MESSAGES
// ============================================================
const Messages = {
    /** Send a message */
    async send({ complaintId, senderId, senderName, senderType, targetStudentId, message, isBroadcast }) {
        const { data, error } = await db.from('messages').insert({
            complaint_id: complaintId || null,
            sender_id: senderId,
            sender_name: senderName,
            sender_type: senderType,
            target_student_id: targetStudentId || null,
            message,
            is_broadcast: isBroadcast || false,
            read_by: [senderId]
        }).select().single();
        if (error) throw error;
        return data;
    },

    /** Get messages for a student (their messages + broadcasts) */
    async getForStudent(studentId) {
        const { data, error } = await db
            .from('messages')
            .select('*')
            .or(`target_student_id.eq.${studentId},is_broadcast.eq.true,sender_id.eq.${studentId}`)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    /** Get messages for a specific complaint */
    async getForComplaint(complaintId) {
        const { data, error } = await db
            .from('messages')
            .select('*')
            .eq('complaint_id', complaintId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    /** Mark messages as read */
    async markRead(messageIds, userId) {
        for (const id of messageIds) {
            await db.rpc('array_append_unique', { row_id: id, user_id: userId })
                .catch(() => {
                    // Fallback: direct update
                    db.from('messages')
                        .update({ read_by: db.raw(`array_append(read_by, '${userId}')`) })
                        .eq('id', id);
                });
        }
    },

    /** Subscribe to new messages for a student */
    subscribeStudent(studentId, callback) {
        return db
            .channel(`messages:student:${studentId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `target_student_id=eq.${studentId}`
            }, callback)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `is_broadcast=eq.true`
            }, callback)
            .subscribe();
    },

    /** Subscribe to all messages (admin) */
    subscribeAdmin(callback) {
        return db
            .channel('messages:admin')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, callback)
            .subscribe();
    }
};

// ============================================================
// NOTIFICATIONS
// ============================================================
const Notifications = {
    /** Get unread notifications for a user */
    async getUnread(userId) {
        const { data, error } = await db
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /** Mark notification as read */
    async markRead(notificationId) {
        await db.from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
    },

    /** Mark all as read for a user */
    async markAllRead(userId) {
        await db.from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId);
    },

    /** Subscribe to new notifications for a user */
    subscribe(userId, callback) {
        return db
            .channel(`notifications:${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, callback)
            .subscribe();
    }
};

// ============================================================
// BROWSER PUSH NOTIFICATIONS
// ============================================================
const PushNotify = {
    async requestPermission() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        const result = await Notification.requestPermission();
        return result === 'granted';
    },

    show(title, body, options = {}) {
        if (Notification.permission !== 'granted') return;
        const n = new Notification(title, {
            body,
            icon: '/pwa/icons/icon-192x192.png',
            badge: '/pwa/icons/badge-72x72.png',
            tag: options.tag || 'scosy',
            ...options
        });
        n.onclick = () => { window.focus(); n.close(); };
        setTimeout(() => n.close(), 6000);
    }
};

// ============================================================
// ADMIN MANAGEMENT
// ============================================================
const AdminMgmt = {
    /** Get all admins */
    async getAll() {
        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('user_type', 'admin')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    /** Approve an admin */
    async approve(profileId) {
        const { error } = await db
            .from('profiles')
            .update({ approval_status: 'approved' })
            .eq('id', profileId);
        if (error) throw error;
    },

    /** Get all students */
    async getStudents() {
        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('user_type', 'student')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }
};

// Expose globally
window.db          = db;
window.Auth        = Auth;
window.Complaints  = Complaints;
window.Messages    = Messages;
window.Notifications = Notifications;
window.PushNotify  = PushNotify;
window.AdminMgmt   = AdminMgmt;
