# Backend Integration Design Document

## Overview

This design document outlines the transformation of SCOSY from a client-side localStorage application to a full-stack web application with Node.js backend, real-time WebSocket communication, and persistent database storage. The system will support multi-device synchronization, real-time chat functionality, and comprehensive admin analytics.

## Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/JS)    │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ - Auth Pages    │    │ - REST API      │    │ - Users         │
│ - Dashboards    │    │ - WebSocket     │    │ - Complaints    │
│ - Chat UI       │    │ - File Upload   │    │ - Messages      │
│ - Admin Panel   │    │ - Auth System   │    │ - Files         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│   File Storage  │◄─────────────┘
                        │   (AWS S3/Local)│
                        └─────────────────┘
```

### Technology Stack

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- WebSocket client for real-time communication
- Fetch API for HTTP requests
- Local caching for offline support

**Backend:**
- Node.js with Express.js framework
- Socket.IO for WebSocket communication
- JWT for authentication
- Multer for file uploads
- bcrypt for password hashing

**Database:**
- PostgreSQL for primary data storage
- Redis for session management and caching
- Database migrations and seeders

**Infrastructure:**
- Docker for containerization
- Nginx for reverse proxy
- SSL/TLS certificates
- Environment-based configuration

## Components and Interfaces

### 1. Backend API Structure

#### Core API Endpoints

```javascript
// Authentication
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh
POST   /api/auth/logout

// Users
GET    /api/users/profile
PUT    /api/users/profile
GET    /api/users/list (admin only)

// Complaints
GET    /api/complaints
POST   /api/complaints
GET    /api/complaints/:id
PUT    /api/complaints/:id
DELETE /api/complaints/:id (admin only)

// Messages/Responses
GET    /api/complaints/:id/messages
POST   /api/complaints/:id/messages
PUT    /api/messages/:id
DELETE /api/messages/:id

// Admin
GET    /api/admin/dashboard
GET    /api/admin/users
PUT    /api/admin/users/:id/approve
GET    /api/admin/analytics
GET    /api/admin/reports

// Files
POST   /api/files/upload
GET    /api/files/:id
DELETE /api/files/:id
```

#### WebSocket Events

```javascript
// Connection Management
'connect'
'disconnect'
'authenticate'

// Real-time Updates
'complaint:created'
'complaint:updated'
'message:sent'
'message:received'
'typing:start'
'typing:stop'

// Admin Events
'admin:notification'
'user:status_change'
'system:announcement'
```

### 2. Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    matric_number VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    level VARCHAR(10),
    user_type ENUM('student', 'admin') DEFAULT 'student',
    admin_level INTEGER DEFAULT NULL,
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

#### Complaints Table
```sql
CREATE TABLE complaints (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    category VARCHAR(100) NOT NULL,
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('pending', 'in_progress', 'resolved', 'closed') DEFAULT 'pending',
    is_anonymous BOOLEAN DEFAULT false,
    assigned_admin_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);
```

#### Messages Table
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id),
    sender_id INTEGER REFERENCES users(id),
    message_text TEXT NOT NULL,
    message_type ENUM('private', 'public') DEFAULT 'private',
    is_admin_response BOOLEAN DEFAULT false,
    attachments JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);
```

#### Files Table
```sql
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    complaint_id INTEGER REFERENCES complaints(id),
    message_id INTEGER REFERENCES messages(id),
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Authentication System

#### JWT Token Structure
```javascript
{
  "sub": "user_id",
  "email": "user@example.com",
  "userType": "student|admin",
  "adminLevel": 1|2|null,
  "iat": 1234567890,
  "exp": 1234567890
}
```

#### Authentication Middleware
```javascript
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};
```

### 4. Real-time Communication

#### WebSocket Connection Management
```javascript
io.on('connection', (socket) => {
  socket.on('authenticate', async (token) => {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = user.sub;
      socket.userType = user.userType;
      socket.join(`user_${user.sub}`);
      
      if (user.userType === 'admin') {
        socket.join('admins');
      }
    } catch (error) {
      socket.emit('auth_error', { message: 'Invalid token' });
    }
  });
  
  socket.on('join_complaint', (complaintId) => {
    socket.join(`complaint_${complaintId}`);
  });
  
  socket.on('send_message', async (data) => {
    // Handle message sending and broadcasting
  });
});
```

### 5. File Upload System

#### File Upload Configuration
```javascript
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

## Data Models

### Enhanced Frontend Models

```javascript
// User Model
class User {
  constructor(data) {
    this.id = data.id;
    this.matricNumber = data.matric_number;
    this.name = data.name;
    this.email = data.email;
    this.level = data.level;
    this.userType = data.user_type;
    this.adminLevel = data.admin_level;
    this.approvalStatus = data.approval_status;
    this.isActive = data.is_active;
    this.createdAt = new Date(data.created_at);
    this.lastLogin = data.last_login ? new Date(data.last_login) : null;
  }
}

// Complaint Model
class Complaint {
  constructor(data) {
    this.id = data.id;
    this.ticketId = data.ticket_id;
    this.userId = data.user_id;
    this.category = data.category;
    this.priority = data.priority;
    this.subject = data.subject;
    this.description = data.description;
    this.status = data.status;
    this.isAnonymous = data.is_anonymous;
    this.assignedAdminId = data.assigned_admin_id;
    this.createdAt = new Date(data.created_at);
    this.updatedAt = new Date(data.updated_at);
    this.resolvedAt = data.resolved_at ? new Date(data.resolved_at) : null;
    this.messages = [];
  }
}

// Message Model
class Message {
  constructor(data) {
    this.id = data.id;
    this.complaintId = data.complaint_id;
    this.senderId = data.sender_id;
    this.messageText = data.message_text;
    this.messageType = data.message_type;
    this.isAdminResponse = data.is_admin_response;
    this.attachments = data.attachments || [];
    this.createdAt = new Date(data.created_at);
    this.readAt = data.read_at ? new Date(data.read_at) : null;
  }
}
```

## Error Handling

### API Error Responses
```javascript
// Standard error response format
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Frontend Error Handling
```javascript
class ApiClient {
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`,
          ...options.headers
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new ApiError(error.error.message, response.status, error.error.code);
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error occurred', 0, 'NETWORK_ERROR');
    }
  }
}
```

## Testing Strategy

### Backend Testing
1. **Unit Tests**: Individual function and method testing
2. **Integration Tests**: API endpoint testing with database
3. **WebSocket Tests**: Real-time communication testing
4. **Load Tests**: Performance under concurrent users
5. **Security Tests**: Authentication and authorization validation

### Frontend Testing
1. **Component Tests**: UI component functionality
2. **Integration Tests**: API integration and data flow
3. **E2E Tests**: Complete user workflows
4. **Real-time Tests**: WebSocket communication
5. **Cross-browser Tests**: Compatibility across browsers

### Database Testing
1. **Migration Tests**: Schema changes and rollbacks
2. **Performance Tests**: Query optimization
3. **Data Integrity Tests**: Constraint validation
4. **Backup/Restore Tests**: Data recovery procedures

## Security Considerations

### Authentication Security
- JWT tokens with short expiration times
- Refresh token rotation
- Rate limiting on authentication endpoints
- Account lockout after failed attempts

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF token implementation
- File upload security scanning

### Communication Security
- HTTPS enforcement
- WebSocket secure connections (WSS)
- API rate limiting
- Request size limitations

## Deployment Strategy

### Development Environment
```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
  
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
    volumes:
      - ./backend:/app
  
  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=scosy_dev
      - POSTGRES_USER=dev
      - POSTGRES_PASSWORD=dev123
    ports:
      - "5432:5432"
  
  redis:
    image: redis:6
    ports:
      - "6379:6379"
```

### Production Environment
- Docker containers with orchestration
- Load balancer configuration
- SSL certificate management
- Database backup strategies
- Monitoring and logging setup
- CI/CD pipeline integration