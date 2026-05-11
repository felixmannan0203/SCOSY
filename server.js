const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for development
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory database (replace with real database in production)
const db = {
    users: new Map(),
    admins: new Map(),
    complaints: new Map(),
    messages: new Map(),
    sessions: new Map()
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Initialize default admin
async function initializeDefaultAdmin() {
    if (!db.admins.has('admin')) {
        const hashedPassword = await bcrypt.hash('123456789', 12);
        db.admins.set('admin', {
            staffId: 'admin',
            name: 'System Administrator',
            email: 'admin@plasu.edu.ng',
            adminLevel: 1,
            approvalStatus: 'approved',
            isPrimary: true,
            passwordHash: hashedPassword,
            createdAt: new Date().toISOString(),
            lastLogin: null
        });
        console.log('✅ Default admin account created');
        console.log('📧 Staff ID: admin');
        console.log('🔑 Password: 123456789');
    }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ==================== AUTH ROUTES ====================

// Register student
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, matric, email, level, password } = req.body;

        // Validation
        if (!name || !matric || !email || !level || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user already exists
        if (db.users.has(matric.toUpperCase()) || 
            Array.from(db.users.values()).some(u => u.email === email)) {
            return res.status(409).json({ error: 'Account already exists with this matric or email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = {
            name,
            matric: matric.toUpperCase(),
            email,
            level,
            passwordHash: hashedPassword,
            userType: 'student',
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        db.users.set(matric.toUpperCase(), user);

        res.status(201).json({ 
            message: 'Account created successfully',
            user: {
                name: user.name,
                matric: user.matric,
                email: user.email,
                level: user.level,
                userType: user.userType
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Identifier and password are required' });
        }

        let user = null;
        let userType = null;

        // Check if it's admin login
        if (identifier === 'admin' || identifier.includes('@plasu.edu.ng')) {
            for (const [staffId, admin] of db.admins) {
                if (admin.staffId === identifier || admin.email === identifier) {
                    user = admin;
                    userType = 'admin';
                    break;
                }
            }
        }

        // Check student login if not admin
        if (!user) {
            const student = db.users.get(identifier.toUpperCase()) || 
                          Array.from(db.users.values()).find(u => u.email === identifier);
            if (student) {
                user = student;
                userType = 'student';
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check admin approval status
        if (userType === 'admin' && user.approvalStatus === 'pending') {
            return res.status(403).json({ error: 'Your admin account is pending approval' });
        }

        // Update last login
        user.lastLogin = new Date().toISOString();

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.staffId || user.matric,
                userType,
                adminLevel: user.adminLevel || null
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Store session
        db.sessions.set(token, {
            userId: user.staffId || user.matric,
            userType,
            createdAt: new Date().toISOString()
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.staffId || user.matric,
                name: user.name,
                email: user.email,
                userType,
                adminLevel: user.adminLevel || null,
                level: user.level || null,
                matric: user.matric || null,
                staffId: user.staffId || null
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    db.sessions.delete(token);
    res.json({ message: 'Logged out successfully' });
});

// ==================== COMPLAINT ROUTES ====================

// Submit complaint
app.post('/api/complaints', authenticateToken, (req, res) => {
    try {
        const { category, priority, subject, message, isAnonymous } = req.body;

        if (!category || !subject || !message) {
            return res.status(400).json({ error: 'Category, subject, and message are required' });
        }

        const complaintId = uuidv4();
        const complaint = {
            id: complaintId,
            category,
            priority: priority || 'medium',
            subject,
            message,
            isAnonymous: isAnonymous || false,
            submitterId: isAnonymous ? null : req.user.id,
            submitterType: isAnonymous ? null : req.user.userType,
            status: 'pending',
            responses: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        db.complaints.set(complaintId, complaint);

        // Notify admins via socket
        io.emit('new-complaint', {
            id: complaintId,
            category,
            subject,
            priority,
            isAnonymous,
            createdAt: complaint.createdAt
        });

        res.status(201).json({
            message: 'Complaint submitted successfully',
            complaintId
        });
    } catch (error) {
        console.error('Complaint submission error:', error);
        res.status(500).json({ error: 'Failed to submit complaint' });
    }
});

// Get complaints (admin only)
app.get('/api/complaints', authenticateToken, (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const complaints = Array.from(db.complaints.values()).map(complaint => ({
            ...complaint,
            submitterName: complaint.submitterId && !complaint.isAnonymous ? 
                (db.users.get(complaint.submitterId)?.name || 'Unknown') : 
                'Anonymous'
        }));

        res.json(complaints);
    } catch (error) {
        console.error('Get complaints error:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// Get user's complaints
app.get('/api/complaints/my', authenticateToken, (req, res) => {
    try {
        const userComplaints = Array.from(db.complaints.values())
            .filter(complaint => complaint.submitterId === req.user.id);

        res.json(userComplaints);
    } catch (error) {
        console.error('Get user complaints error:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// Respond to complaint (admin only)
app.post('/api/complaints/:id/respond', authenticateToken, (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const { message, isPublic } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Response message is required' });
        }

        const complaint = db.complaints.get(id);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const response = {
            id: uuidv4(),
            adminId: req.user.id,
            adminName: db.admins.get(req.user.id)?.name || 'Admin',
            message,
            isPublic: isPublic || false,
            createdAt: new Date().toISOString()
        };

        complaint.responses.push(response);
        complaint.updatedAt = new Date().toISOString();
        complaint.status = 'responded';

        // Notify relevant users via socket
        if (isPublic) {
            io.emit('public-response', {
                complaintId: id,
                response
            });
        } else if (complaint.submitterId) {
            io.to(complaint.submitterId).emit('private-response', {
                complaintId: id,
                response
            });
        }

        res.json({
            message: 'Response sent successfully',
            response
        });
    } catch (error) {
        console.error('Response error:', error);
        res.status(500).json({ error: 'Failed to send response' });
    }
});

// ==================== ADMIN ROUTES ====================

// Get dashboard stats (admin only)
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    try {
        if (req.user.userType !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const complaints = Array.from(db.complaints.values());
        const users = Array.from(db.users.values());
        
        const today = new Date().toDateString();
        
        const stats = {
            totalComplaints: complaints.length,
            pendingComplaints: complaints.filter(c => c.status === 'pending').length,
            totalUsers: users.length,
            resolvedToday: complaints.filter(c => 
                c.status === 'resolved' && 
                new Date(c.updatedAt).toDateString() === today
            ).length
        };

        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined room`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// ==================== SERVE FRONTEND ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
    await initializeDefaultAdmin();
    console.log(`🚀 SCOSY Server running on port ${PORT}`);
    console.log(`🌐 Access your app at: http://localhost:${PORT}`);
});

module.exports = app;