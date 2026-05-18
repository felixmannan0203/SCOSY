# Design Document

## Overview

The role-based registration system enhances the existing SCOSY authentication flow by introducing dynamic form fields based on user role selection and implementing an admin approval workflow. The design builds upon the current localStorage-based architecture while adding new data structures and UI components for role management.

## Architecture

### Current System Integration
The design integrates with the existing SCOSY authentication system:
- **Frontend**: HTML forms with JavaScript validation and localStorage persistence
- **Authentication**: Existing `auth.js` handles login/registration logic
- **Admin Management**: Current `admin.js` manages admin dashboard functionality
- **Data Storage**: localStorage with structured JSON objects for users and admins

### New Components
1. **Role Selection Component**: Dynamic dropdown that switches form layouts
2. **Admin Request Management**: Pending requests dashboard for main admins
3. **Notification System**: Status updates for admin applicants
4. **Enhanced Form Validation**: Role-specific field validation

## Components and Interfaces

### 1. Registration Form Enhancement

#### Role Selection Interface
```javascript
// Role selection dropdown component
const RoleSelector = {
    roles: ['Student', 'Admin'],
    currentRole: 'Student',
    
    render() {
        return `
            <div class="input-group">
                <label>I am registering as <span class="required">*</span></label>
                <i class="fas fa-user-tag field-icon"></i>
                <select id="userRole" required onchange="handleRoleChange(this.value)">
                    <option value="Student">Student</option>
                    <option value="Admin">Admin (Staff)</option>
                </select>
            </div>
        `;
    }
};
```

#### Dynamic Form Fields
```javascript
// Form field configurations for different roles
const FormConfigs = {
    Student: {
        fields: ['name', 'matric', 'email', 'level', 'password', 'confirmPassword'],
        validation: {
            matric: /^PLASU\/[0-9]{4}\/FNAS\/[0-9]{4}$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        }
    },
    Admin: {
        fields: ['staffId', 'name', 'position', 'email', 'password', 'confirmPassword'],
        validation: {
            staffId: /^[A-Z]{2,4}\/[0-9]{3,5}$/,
            email: /^[^\s@]+@plasu\.edu\.ng$/
        }
    }
};
```

### 2. Admin Request Management System

#### Pending Requests Data Structure
```javascript
// Admin request object structure
const AdminRequest = {
    id: 'REQ-TIMESTAMP-RANDOM',
    staffId: 'CS/001',
    name: 'John Doe',
    position: 'Lecturer II',
    email: 'john.doe@plasu.edu.ng',
    passwordHash: [...],
    passwordSalt: [...],
    status: 'pending', // 'pending', 'approved', 'declined'
    requestedAt: '2024-01-01T00:00:00.000Z',
    processedAt: null,
    processedBy: null,
    assignedLevel: null // 1 or 2, set during approval
};
```

#### Pending Admin Dashboard Component
```javascript
// Admin approval interface
const PendingAdminManager = {
    loadPendingRequests() {
        return load('scosy_pending_admin_requests', []);
    },
    
    renderPendingList() {
        const requests = this.loadPendingRequests();
        return requests.map(request => this.renderRequestCard(request));
    },
    
    approveRequest(requestId, level) {
        // Move from pending to approved admins
        // Assign admin level (1 or 2)
        // Send notification
    },
    
    declineRequest(requestId, reason) {
        // Remove from pending requests
        // Send rejection notification
    }
};
```

### 3. Enhanced Authentication Flow

#### Updated Registration Process
```javascript
// Enhanced registration handler
async function handleRoleBasedRegistration(formData) {
    const { role, ...userData } = formData;
    
    if (role === 'Student') {
        return await createStudentAccount(userData);
    } else if (role === 'Admin') {
        return await createAdminRequest(userData);
    }
}

async function createAdminRequest(adminData) {
    // Validate admin-specific fields
    // Create pending admin request
    // Store in scosy_pending_admin_requests
    // Show pending confirmation message
}
```

## Data Models

### 1. Enhanced User Storage Structure

#### Student Account (Unchanged)
```javascript
// scosy_users[matric]
{
    name: "John Student",
    matric: "PLASU/2024/FNAS/0001",
    email: "john@student.plasu.edu.ng",
    level: "200",
    passwordHash: [...],
    passwordSalt: [...],
    createdAt: "2024-01-01T00:00:00.000Z",
    lastLogin: "2024-01-01T12:00:00.000Z"
}
```

#### Admin Account (Enhanced)
```javascript
// scosy_admins[staffId]
{
    staffId: "CS/001",
    name: "Dr. Jane Admin",
    position: "Senior Lecturer",
    email: "jane.admin@plasu.edu.ng",
    adminLevel: 1, // 1 = Full Admin, 2 = Limited Admin
    approvalStatus: "approved", // "pending", "approved", "declined"
    passwordHash: [...],
    passwordSalt: [...],
    createdAt: "2024-01-01T00:00:00.000Z",
    approvedAt: "2024-01-01T06:00:00.000Z",
    approvedBy: "admin", // Staff ID of approving admin
    lastLogin: "2024-01-01T12:00:00.000Z",
    isPrimary: false // Only the default admin has this as true
}
```

#### Pending Admin Requests
```javascript
// scosy_pending_admin_requests[]
[
    {
        id: "REQ-ABC123",
        staffId: "CS/002",
        name: "Prof. New Admin",
        position: "Professor",
        email: "new.admin@plasu.edu.ng",
        passwordHash: [...],
        passwordSalt: [...],
        requestedAt: "2024-01-01T00:00:00.000Z",
        status: "pending"
    }
]
```

### 2. Notification System Data
```javascript
// scosy_notifications[userId]
{
    userId: "CS/002",
    notifications: [
        {
            id: "NOTIF-XYZ789",
            type: "admin_request_approved",
            title: "Admin Account Approved",
            message: "Your admin account has been approved with Level 2 access.",
            createdAt: "2024-01-01T12:00:00.000Z",
            read: false
        }
    ]
}
```

## Error Handling

### 1. Form Validation Errors
- **Invalid Staff ID Format**: Show format requirements (e.g., "CS/001")
- **Duplicate Registration**: Check existing users and pending requests
- **Email Domain Validation**: Ensure admin emails use @plasu.edu.ng domain
- **Password Strength**: Enforce minimum security requirements

### 2. Admin Approval Errors
- **Unauthorized Access**: Only Level 1 admins can approve requests
- **Invalid Request ID**: Handle missing or corrupted request data
- **Duplicate Approval**: Prevent double-processing of requests

### 3. Session Management
- **Pending Status Handling**: Redirect pending admins to appropriate waiting page
- **Level-based Access Control**: Restrict features based on admin level
- **Session Timeout**: Maintain existing session management for all user types

## Responsive Design Strategy

### 1. Mobile-First Approach
The role-based registration system follows a mobile-first responsive design strategy:

#### Mobile (320px - 767px)
- **Single Column Layout**: Role dropdown and form fields stack vertically
- **Touch-Optimized Controls**: Minimum 44px touch targets for dropdowns and buttons
- **Simplified Form Transitions**: Reduced animation complexity for better performance
- **Compact Admin Cards**: Condensed pending request cards with essential information only

#### Tablet (768px - 1023px)
- **Two-Column Form Layout**: Role selection and primary fields in left column, secondary fields in right
- **Enhanced Touch Targets**: 48px minimum touch targets for comfortable tablet interaction
- **Expanded Admin Cards**: More detailed pending request information with better spacing
- **Optimized Modal Dialogs**: Level selection modals sized appropriately for tablet screens

#### Desktop (1024px+)
- **Full Multi-Column Layout**: Maintains existing desktop layout with enhanced role selection
- **Hover States**: Rich hover interactions for admin approval buttons and form elements
- **Advanced Animations**: Full form transition animations and micro-interactions
- **Detailed Admin Dashboard**: Complete pending requests interface with all features visible

### 2. Responsive Form Components

#### Role Selection Dropdown
```css
/* Mobile-first role selector */
.role-selector {
    width: 100%;
    min-height: 44px;
}

@media (min-width: 768px) {
    .role-selector {
        min-height: 48px;
        max-width: 300px;
    }
}

@media (min-width: 1024px) {
    .role-selector {
        min-height: 40px;
    }
}
```

#### Dynamic Form Fields
```css
/* Responsive form field transitions */
.form-field-container {
    transition: all 0.3s ease;
}

@media (max-width: 767px) {
    .form-field-container {
        margin-bottom: 16px;
    }
    
    .form-row {
        flex-direction: column;
        gap: 16px;
    }
}

@media (min-width: 768px) {
    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }
}
```

#### Admin Request Cards
```css
/* Responsive admin request cards */
.pending-request-card {
    padding: 16px;
    margin-bottom: 16px;
}

@media (max-width: 767px) {
    .pending-request-card {
        padding: 12px;
    }
    
    .request-actions {
        flex-direction: column;
        gap: 8px;
    }
    
    .request-details {
        font-size: 14px;
    }
}

@media (min-width: 768px) {
    .pending-request-card {
        padding: 20px;
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
    }
    
    .request-actions {
        flex-direction: row;
        gap: 12px;
    }
}
```

### 3. Responsive Breakpoint Strategy

#### Critical Breakpoints
- **320px**: Minimum mobile width support
- **375px**: Modern mobile devices (iPhone SE, etc.)
- **768px**: Tablet portrait mode transition
- **1024px**: Desktop/laptop transition
- **1200px**: Large desktop optimization

#### Responsive Form Behavior
```javascript
// Responsive form field management
const ResponsiveFormManager = {
    breakpoints: {
        mobile: 767,
        tablet: 1023
    },
    
    getCurrentBreakpoint() {
        const width = window.innerWidth;
        if (width <= this.breakpoints.mobile) return 'mobile';
        if (width <= this.breakpoints.tablet) return 'tablet';
        return 'desktop';
    },
    
    adaptFormLayout(role) {
        const breakpoint = this.getCurrentBreakpoint();
        const formConfig = this.getFormConfig(role, breakpoint);
        this.applyFormLayout(formConfig);
    }
};
```

## Testing Strategy

### 1. Unit Tests
- **Role Selection Logic**: Test form field switching across all breakpoints
- **Form Validation**: Test role-specific validation rules on mobile and desktop
- **Data Storage**: Test localStorage operations for new data structures
- **Admin Approval Flow**: Test request processing logic with responsive UI

### 2. Integration Tests
- **End-to-End Registration**: Test complete student and admin registration flows on all devices
- **Admin Dashboard Integration**: Test pending requests display and management across breakpoints
- **Authentication Flow**: Test login with different user types and statuses on mobile/tablet/desktop
- **Cross-browser Compatibility**: Test localStorage and form functionality on all major browsers

### 3. Responsive Design Tests
- **Mobile Form Switching**: Test role selection and form transitions on mobile devices (320px-767px)
- **Tablet Optimization**: Test enhanced layouts and touch targets on tablet devices (768px-1023px)
- **Desktop Enhancement**: Test full-featured interface on desktop devices (1024px+)
- **Orientation Changes**: Test landscape/portrait mode transitions on mobile devices
- **Touch vs Mouse Interaction**: Test different interaction patterns across device types

### 4. User Experience Tests
- **Form Transitions**: Test smooth switching between student/admin forms across all breakpoints
- **Touch Accessibility**: Test minimum touch target sizes and gesture support
- **Keyboard Navigation**: Test keyboard navigation and screen reader compatibility
- **Performance**: Test with large numbers of pending requests on slower mobile devices

### 4. Security Tests
- **Input Validation**: Test XSS prevention and data sanitization
- **Access Control**: Test admin level restrictions
- **Session Security**: Test session hijacking prevention
- **Data Integrity**: Test localStorage data corruption handling

## Implementation Phases

### Phase 1: Core Role Selection
1. Add role dropdown to registration form
2. Implement dynamic form field switching
3. Update form validation for role-specific rules
4. Test basic role selection functionality

### Phase 2: Admin Request System
1. Create admin request data structures
2. Implement admin request submission
3. Add pending status handling to login flow
4. Create basic pending requests storage

### Phase 3: Admin Approval Dashboard
1. Add pending requests section to admin dashboard
2. Implement approval/decline functionality
3. Add level assignment during approval
4. Test complete admin approval workflow

### Phase 4: Notifications and Polish
1. Implement notification system for status updates
2. Add email validation and enhanced security
3. Improve UI/UX with animations and feedback
4. Comprehensive testing and bug fixes