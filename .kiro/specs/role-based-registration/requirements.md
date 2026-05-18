# Requirements Document

## Introduction

This feature enhances the SCOSY registration system with role-based registration forms and an admin approval workflow. Users can select their role during registration, which dynamically changes the form fields. Admin requests go through a pending approval process where main admins can accept or decline requests and assign appropriate access levels.

## Requirements

### Requirement 1: Role Selection in Registration Form

**User Story:** As a user, I want to select my role during registration, so that I can access the appropriate form fields for my user type.

#### Acceptance Criteria

1. WHEN a user accesses the registration form THEN the system SHALL display a role dropdown with options "Student" and "Admin"
2. WHEN a user selects "Student" THEN the system SHALL display the standard student registration fields (name, student ID, email, password)
3. WHEN a user selects "Admin" THEN the system SHALL display admin-specific registration fields (staff ID, name, position, email, password)
4. WHEN the role selection changes THEN the system SHALL smoothly transition between form layouts without losing entered data

### Requirement 2: Student Registration Form

**User Story:** As a student, I want to register with my student credentials, so that I can access the complaint system.

#### Acceptance Criteria

1. WHEN a student registers THEN the system SHALL require name, student ID, email, and password
2. WHEN student registration is submitted THEN the system SHALL validate all required fields
3. WHEN student registration is successful THEN the system SHALL create an active student account immediately
4. WHEN student registration is complete THEN the system SHALL redirect to the student dashboard

### Requirement 3: Admin Request Form

**User Story:** As a staff member, I want to request admin access with my staff credentials, so that I can apply for administrative privileges.

#### Acceptance Criteria

1. WHEN a staff member selects "Admin" role THEN the system SHALL display fields for staff ID, name, position, email, and password
2. WHEN admin registration is submitted THEN the system SHALL validate all required fields including staff ID format
3. WHEN admin registration is successful THEN the system SHALL create a pending admin request
4. WHEN admin request is submitted THEN the system SHALL display a confirmation message about pending approval

### Requirement 4: Pending Admin Dashboard

**User Story:** As a main admin, I want to view and manage pending admin requests, so that I can control who gets administrative access.

#### Acceptance Criteria

1. WHEN a main admin accesses the pending requests section THEN the system SHALL display all pending admin applications
2. WHEN viewing pending requests THEN the system SHALL show staff ID, name, position, email, and submission date
3. WHEN a main admin reviews a request THEN the system SHALL provide "Accept" and "Decline" options
4. WHEN a request is processed THEN the system SHALL remove it from the pending list

### Requirement 5: Admin Request Approval Process

**User Story:** As a main admin, I want to approve or decline admin requests and assign access levels, so that I can maintain proper system security.

#### Acceptance Criteria

1. WHEN a main admin accepts a request THEN the system SHALL prompt for level assignment (Level 1 or Level 2)
2. WHEN a level is assigned THEN the system SHALL create an active admin account with the specified permissions
3. WHEN a main admin declines a request THEN the system SHALL permanently reject the application
4. WHEN an admin request is approved THEN the system SHALL send a notification to the applicant
5. WHEN an admin request is declined THEN the system SHALL send a rejection notification to the applicant

### Requirement 6: Admin Level Management

**User Story:** As a main admin, I want to assign different admin levels during approval, so that I can control the scope of administrative privileges.

#### Acceptance Criteria

1. WHEN approving an admin request THEN the system SHALL offer Level 1 (full admin) and Level 2 (limited admin) options
2. WHEN Level 1 is assigned THEN the system SHALL grant full administrative privileges including user management
3. WHEN Level 2 is assigned THEN the system SHALL grant limited privileges excluding sensitive administrative functions
4. WHEN admin levels are assigned THEN the system SHALL enforce appropriate access controls in the dashboard

### Requirement 7: Notification System for Admin Requests

**User Story:** As an admin applicant, I want to receive notifications about my request status, so that I know when my application is processed.

#### Acceptance Criteria

1. WHEN an admin request is submitted THEN the system SHALL display a pending status message
2. WHEN an admin request is approved THEN the system SHALL notify the applicant via email and in-app notification
3. WHEN an admin request is declined THEN the system SHALL notify the applicant with the rejection reason
4. WHEN notifications are sent THEN the system SHALL log the communication for audit purposes

### Requirement 8: Form Validation and Security

**User Story:** As a system administrator, I want robust form validation and security measures, so that only legitimate users can register.

#### Acceptance Criteria

1. WHEN any registration form is submitted THEN the system SHALL validate all required fields and formats
2. WHEN staff ID is entered THEN the system SHALL validate against a predefined format or database
3. WHEN passwords are created THEN the system SHALL enforce minimum security requirements
4. WHEN duplicate registrations are attempted THEN the system SHALL prevent duplicate accounts and show appropriate messages