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
    sessions: new Map(),
    devices: new Map() // New: Device registration storage
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
        const { identifier, password, deviceInfo } = req.body;

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

        // Register device if deviceInfo provided
        let deviceId = null;
        if (deviceInfo) {
            deviceId = uuidv4();
            const device = {
                id: deviceId,
                userId: user.staffId || user.matric,
                userType,
                type: deviceInfo.type || 'unknown',
                userAgent: deviceInfo.userAgent || '',
                platform: deviceInfo.platform || 'unknown',
                screenSize: deviceInfo.screenSize || { width: 0, height: 0 },
                hasTouch: deviceInfo.hasTouch || false,
                pixelRatio: deviceInfo.pixelRatio || 1,
                lastActive: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                syncEnabled: true,
                pushToken: deviceInfo.pushToken || null
            };

            db.devices.set(deviceId, device);

            // Update user's device list
            if (!user.devices) user.devices = [];
            if (!user.devices.includes(deviceId)) {
                user.devices.push(deviceId);
            }
            user.lastSyncTime = new Date().toISOString();
        }

        // Generate JWT token with device information
        const token = jwt.sign(
            { 
                id: user.staffId || user.matric,
                userType,
                adminLevel: user.adminLevel || null,
                deviceId: deviceId
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Store session with device information
        db.sessions.set(token, {
            userId: user.staffId || user.matric,
            userType,
            deviceId: deviceId,
            createdAt: new Date().toISOString()
        });

        res.json({
            message: 'Login successful',
            token,
            deviceId,
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

// ==================== DEVICE MANAGEMENT ROUTES ====================

// Register device
app.post('/api/devices/register', authenticateToken, (req, res) => {
    try {
        const { deviceInfo } = req.body;
        
        if (!deviceInfo || !deviceInfo.type || !deviceInfo.userAgent) {
            return res.status(400).json({ error: 'Device information is required' });
        }

        const deviceId = uuidv4();
        const device = {
            id: deviceId,
            userId: req.user.id,
            userType: req.user.userType,
            type: deviceInfo.type, // mobile, tablet, desktop
            userAgent: deviceInfo.userAgent,
            platform: deviceInfo.platform || 'unknown',
            screenSize: deviceInfo.screenSize || { width: 0, height: 0 },
            hasTouch: deviceInfo.hasTouch || false,
            pixelRatio: deviceInfo.pixelRatio || 1,
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            syncEnabled: true,
            pushToken: deviceInfo.pushToken || null
        };

        db.devices.set(deviceId, device);

        // Update user's device list
        const userKey = req.user.userType === 'admin' ? 'admins' : 'users';
        const user = db[userKey].get(req.user.id);
        if (user) {
            if (!user.devices) user.devices = [];
            user.devices.push(deviceId);
            user.lastSyncTime = new Date().toISOString();
        }

        res.status(201).json({
            message: 'Device registered successfully',
            deviceId,
            device: {
                id: deviceId,
                type: device.type,
                platform: device.platform,
                lastActive: device.lastActive
            }
        });
    } catch (error) {
        console.error('Device registration error:', error);
        res.status(500).json({ error: 'Failed to register device' });
    }
});

// Get user devices
app.get('/api/devices', authenticateToken, (req, res) => {
    try {
        const userDevices = Array.from(db.devices.values())
            .filter(device => device.userId === req.user.id)
            .map(device => ({
                id: device.id,
                type: device.type,
                platform: device.platform,
                lastActive: device.lastActive,
                syncEnabled: device.syncEnabled,
                hasTouch: device.hasTouch
            }));

        res.json(userDevices);
    } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Update device activity
app.put('/api/devices/:deviceId/activity', authenticateToken, (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = db.devices.get(deviceId);

        if (!device || device.userId !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        device.lastActive = new Date().toISOString();
        
        res.json({ message: 'Device activity updated' });
    } catch (error) {
        console.error('Update device activity error:', error);
        res.status(500).json({ error: 'Failed to update device activity' });
    }
});

// Remove device
app.delete('/api/devices/:deviceId', authenticateToken, (req, res) => {
    try {
        const { deviceId } = req.params;
        const device = db.devices.get(deviceId);

        if (!device || device.userId !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        db.devices.delete(deviceId);

        // Remove from user's device list
        const userKey = req.user.userType === 'admin' ? 'admins' : 'users';
        const user = db[userKey].get(req.user.id);
        if (user && user.devices) {
            user.devices = user.devices.filter(id => id !== deviceId);
        }

        res.json({ message: 'Device removed successfully' });
    } catch (error) {
        console.error('Remove device error:', error);
        res.status(500).json({ error: 'Failed to remove device' });
    }
});

// Toggle device sync
app.put('/api/devices/:deviceId/sync', authenticateToken, (req, res) => {
    try {
        const { deviceId } = req.params;
        const { syncEnabled } = req.body;
        const device = db.devices.get(deviceId);

        if (!device || device.userId !== req.user.id) {
            return res.status(404).json({ error: 'Device not found' });
        }

        device.syncEnabled = syncEnabled;
        device.lastActive = new Date().toISOString();

        res.json({ 
            message: 'Device sync settings updated',
            syncEnabled: device.syncEnabled
        });
    } catch (error) {
        console.error('Toggle device sync error:', error);
        res.status(500).json({ error: 'Failed to update sync settings' });
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

    // Join user-specific room for cross-device sync
    socket.on('join-room', (data) => {
        const { userId, deviceId } = data;
        socket.join(userId);
        socket.join(`device-${deviceId}`);
        
        // Update device activity
        const device = db.devices.get(deviceId);
        if (device) {
            device.lastActive = new Date().toISOString();
            device.socketId = socket.id;
        }
        
        console.log(`User ${userId} joined room with device ${deviceId}`);
        
        // Notify other devices of new connection
        socket.to(userId).emit('device-connected', {
            deviceId,
            timestamp: new Date().toISOString()
        });
    });

    // Handle cross-device data sync
    socket.on('sync-data', (data) => {
        const { userId, deviceId, syncType, payload, timestamp } = data;
        
        // Broadcast to all other devices of the same user
        socket.to(userId).emit('data-synced', {
            syncType,
            payload,
            sourceDevice: deviceId,
            timestamp
        });
        
        console.log(`Data synced for user ${userId}: ${syncType}`);
    });

    // Handle user preferences sync
    socket.on('sync-preferences', (data) => {
        const { userId, preferences, deviceId } = data;
        
        // Update user preferences in database
        const userKey = data.userType === 'admin' ? 'admins' : 'users';
        const user = db[userKey].get(userId);
        if (user) {
            user.preferences = { ...user.preferences, ...preferences };
            user.lastSyncTime = new Date().toISOString();
        }
        
        // Sync to all other devices
        socket.to(userId).emit('preferences-synced', {
            preferences,
            sourceDevice: deviceId,
            timestamp: new Date().toISOString()
        });
    });

    // Handle complaint sync
    socket.on('sync-complaint', (data) => {
        const { userId, complaint, action } = data;
        
        // Broadcast complaint updates to all user devices
        socket.to(userId).emit('complaint-synced', {
            complaint,
            action, // 'created', 'updated', 'deleted'
            timestamp: new Date().toISOString()
        });
        
        // If it's a new complaint, notify admins
        if (action === 'created') {
            io.emit('new-complaint', {
                id: complaint.id,
                category: complaint.category,
                subject: complaint.subject,
                priority: complaint.priority,
                isAnonymous: complaint.isAnonymous,
                createdAt: complaint.createdAt
            });
        }
    });

    // Handle admin response sync
    socket.on('sync-admin-response', (data) => {
        const { complaintId, response, isPublic } = data;
        
        if (isPublic) {
            // Broadcast public responses to all users
            io.emit('public-response', {
                complaintId,
                response
            });
        } else {
            // Send private response to specific user's devices
            const complaint = db.complaints.get(complaintId);
            if (complaint && complaint.submitterId) {
                io.to(complaint.submitterId).emit('private-response', {
                    complaintId,
                    response
                });
            }
        }
    });

    // Handle device status updates
    socket.on('device-status', (data) => {
        const { deviceId, status } = data;
        const device = db.devices.get(deviceId);
        
        if (device) {
            device.status = status;
            device.lastActive = new Date().toISOString();
            
            // Notify other devices of status change
            socket.to(device.userId).emit('device-status-changed', {
                deviceId,
                status,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Handle typing indicators for real-time features
    socket.on('typing-start', (data) => {
        const { userId, deviceId, context } = data;
        socket.to(userId).emit('user-typing', {
            deviceId,
            context,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('typing-stop', (data) => {
        const { userId, deviceId, context } = data;
        socket.to(userId).emit('user-stopped-typing', {
            deviceId,
            context
        });
    });

    // Handle offline queue sync
    socket.on('sync-offline-queue', (data) => {
        const { userId, queuedActions } = data;
        
        // Process queued actions
        queuedActions.forEach(action => {
            switch (action.type) {
                case 'complaint':
                    // Process queued complaint
                    const complaintId = uuidv4();
                    const complaint = {
                        id: complaintId,
                        ...action.data,
                        createdAt: action.timestamp,
                        updatedAt: new Date().toISOString()
                    };
                    db.complaints.set(complaintId, complaint);
                    
                    // Sync to other devices
                    socket.to(userId).emit('complaint-synced', {
                        complaint,
                        action: 'created',
                        timestamp: new Date().toISOString()
                    });
                    break;
                    
                case 'preferences':
                    // Process queued preferences
                    const userKey = action.userType === 'admin' ? 'admins' : 'users';
                    const user = db[userKey].get(userId);
                    if (user) {
                        user.preferences = { ...user.preferences, ...action.data };
                    }
                    
                    // Sync to other devices
                    socket.to(userId).emit('preferences-synced', {
                        preferences: action.data,
                        sourceDevice: action.deviceId,
                        timestamp: new Date().toISOString()
                    });
                    break;
            }
        });
        
        // Confirm sync completion
        socket.emit('offline-queue-synced', {
            processedCount: queuedActions.length,
            timestamp: new Date().toISOString()
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find and update device status
        for (const [deviceId, device] of db.devices) {
            if (device.socketId === socket.id) {
                device.lastActive = new Date().toISOString();
                delete device.socketId;
                
                // Notify other devices of disconnection
                socket.to(device.userId).emit('device-disconnected', {
                    deviceId,
                    timestamp: new Date().toISOString()
                });
                break;
            }
        }
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