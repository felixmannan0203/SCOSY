# Implementation Tasks

## Task Dependency Graph

```
Task 1 (Clickable Student Stat Cards)
Task 2 (Clickable Admin Stat Cards)
Task 3 (Chat CSS Styles)
    └── Task 4 (Student Chat Interface)
    └── Task 5 (Admin Chat Interface)
        └── Task 6 (Broadcast Notification System)
Task 7 (Status Sync & Real-Time Updates)
    └── depends on Task 4, Task 5
Task 8 (Student Complaint Status Indicators)
    └── depends on Task 4, Task 7
```

---

## Task 1: Make Student Dashboard Stat Cards Clickable

**Requirement:** 1

In `student.js`, update the `updateStats()` function and add click handlers to the four stat cards in `student-dashboard.html`.

- Add `style="cursor:pointer"` and `role="button"` + `aria-label` to each `.stat-card` in `student-dashboard.html`
- In `student.js`, after the DOM is ready, attach click listeners to each stat card:
  - "Total Complaints" card → call `showSection('complaints')`
  - "Pending" card → call `showSection('complaints')` then apply a `pending` filter to `#studentTicketList` (filter `complaints` array by `status === 'pending'` and re-render)
  - "Resolved" card → call `showSection('complaints')` then apply a `resolved` filter
  - "Messages" card → call `showSection('chat')`
- Add a `filterComplaints(status)` function in `student.js` that re-renders `#studentTicketList` filtered by the given status (pass `null` or `'all'` to show all)
- Add visual hover feedback via CSS class `stat-card-clickable` (pointer cursor, subtle scale transform on hover)

**Sub-tasks:**
- [ ] Add `stat-card-clickable` class and ARIA attributes to stat cards in `student-dashboard.html`
- [ ] Implement `filterComplaints(status)` in `student.js`
- [ ] Wire click handlers for all 4 student stat cards in `student.js` `init()`
- [ ] Add `.stat-card-clickable` hover styles to `styles.css`

---

## Task 2: Make Admin Dashboard Stat Cards Clickable

**Requirement:** 2

In `admin.js`, attach click handlers to the four stat cards in `admin-dashboard.html`.

- Add `stat-card-clickable` class and ARIA attributes to each `.stat-card` in `admin-dashboard.html`
- In `admin.js`, wire click listeners in `init()`:
  - "Total Complaints" card → `showSection('complaints')`
  - "Pending Review" card → `showSection('pending')`
  - "Registered Users" card → `showSection('users')`
  - "Resolved Today" card → `showSection('complaints')` then set `#complaintFilter` value to `'resolved'` and call `filterComplaints()`

**Sub-tasks:**
- [ ] Add `stat-card-clickable` class and ARIA attributes to stat cards in `admin-dashboard.html`
- [ ] Wire click handlers for all 4 admin stat cards in `admin.js` `init()`
- [ ] Ensure "Resolved Today" click pre-selects the resolved filter and re-renders the list

---

## Task 3: Add Chat Interface CSS Styles

**Requirement:** 3, 4

Add all CSS needed for the chat UI to `styles.css`. No JS changes in this task.

- `.chat-thread` — scrollable message thread container (max-height, overflow-y auto)
- `.chat-bubble` — base bubble style (border-radius, padding, max-width 75%)
- `.chat-bubble.admin` — right-aligned, primary color background
- `.chat-bubble.student` — left-aligned, secondary/muted background
- `.chat-bubble .bubble-meta` — small timestamp + sender name below bubble
- `.chat-bubble.broadcast` — distinct styling (e.g. amber border) with a "📢 Broadcast" label
- `.chat-composer` — input row at bottom of chat (textarea + send buttons)
- `.chat-composer textarea` — auto-resize, full width
- `.chat-composer .btn-broadcast` — secondary button style for "Send to Everyone"
- `.complaint-answered-badge` — green badge/highlight for answered complaints in ticket list
- `.unread-indicator` — pulsing dot for unread responses

**Sub-tasks:**
- [ ] Add `.chat-thread`, `.chat-bubble`, `.chat-bubble.admin`, `.chat-bubble.student` styles
- [ ] Add `.chat-bubble.broadcast` styles
- [ ] Add `.chat-composer` and button styles
- [ ] Add `.complaint-answered-badge` and `.unread-indicator` styles

---

## Task 4: Implement Student Chat Interface

**Requirement:** 3, 5

Replace the placeholder `#chatContainer` in `student-dashboard.html` and implement the full chat UI in `student.js`.

- Add a `loadMessages()` function in `student.js` that reads `scosy_messages` from `localStorage` and filters messages where `targetStudentId === currentUser.matric` or `isBroadcast === true`
- Add a `renderChatThread(messages)` function that builds the `.chat-thread` HTML:
  - Each message renders as a `.chat-bubble` with class `admin` or `student` based on `senderType`
  - Broadcast messages get the `.broadcast` class and a "📢 System Announcement" label
  - Each bubble shows `senderName`, `message` text, and formatted `timestamp`
- Add a reply composer below the thread: a `<textarea>` and a "Send Reply" button
- Implement `sendStudentReply(messageText)`:
  - Creates a new message object `{ id, complaintId: null, senderId: currentUser.matric, senderName: currentUser.name, senderType: 'student', message, timestamp, isBroadcast: false }`
  - Saves to `scosy_messages` in `localStorage`
  - Re-renders the chat thread immediately
- Call `loadMessages()` when the chat section is shown (hook into `showSection`)
- Update `updateStats()` to count unread messages (messages where `currentUser.matric` not in `readBy`) and display in `#totalMessages` and `#messageBadge`

**Sub-tasks:**
- [ ] Implement `loadMessages()` and `renderChatThread()` in `student.js`
- [ ] Build chat thread HTML with correct bubble classes and metadata
- [ ] Implement reply composer and `sendStudentReply()` function
- [ ] Mark messages as read when chat section is opened (add `currentUser.matric` to `readBy`)
- [ ] Update `updateStats()` to count unread messages
- [ ] Hook `loadMessages()` into `showSection('chat')`

---

## Task 5: Implement Admin Chat Interface in Response Modal

**Requirement:** 4

Replace the `prompt()`-based `respondToComplaint()` in `admin.js` with a proper chat modal.

- Update `admin-dashboard.html` response modal (`#responseModal`) to include:
  - A `.chat-thread` div (`#complaintChatThread`) showing the conversation history for the selected complaint
  - A `.chat-composer` with a `<textarea id="adminResponseText">` and two buttons:
    - `<button id="btnSendResponse">Send Response</button>`
    - `<button id="btnSendToEveryone">Send Response to Everyone</button>`
  - Remove the old `#responseStatus` / `#responseVisibility` selects (status is now set via the response action)
- Implement `openResponseModal(complaintId)` in `admin.js`:
  - Loads messages for the complaint from `scosy_messages` where `complaintId` matches
  - Renders them in `#complaintChatThread` using the same bubble format as Task 4
  - Shows the modal
- Implement `sendAdminResponse(complaintId, messageText, isBroadcast)`:
  - Creates a message object `{ id, complaintId, senderId: currentUser.staffId, senderName: currentUser.name, senderType: 'admin', message: messageText, timestamp, isBroadcast, readBy: [] }`
  - Saves to `scosy_messages` in `localStorage`
  - Updates the complaint's `status` to `'answered'`, sets `hasUnreadResponse: true`, `lastResponseAt`, increments `responseCount`
  - Saves updated complaint back to `scosy_all_complaints`
  - Re-renders `#complaintChatThread`
  - Calls `loadAllData()` to refresh stats
- Wire `#btnSendResponse` → `sendAdminResponse(complaintId, text, false)`
- Wire `#btnSendToEveryone` → `sendAdminResponse(complaintId, text, true)` (broadcast handled in Task 6)
- Update `respondToComplaint()` to call `openResponseModal()` instead of `prompt()`
- Expose `closeModal` globally: `window.closeModal = (id) => document.getElementById(id).style.display = 'none'`

**Sub-tasks:**
- [ ] Update `#responseModal` HTML in `admin-dashboard.html` with chat thread and dual-button composer
- [ ] Implement `openResponseModal(complaintId)` in `admin.js`
- [ ] Implement `sendAdminResponse(complaintId, messageText, isBroadcast)` in `admin.js`
- [ ] Wire both send buttons and update `respondToComplaint()` to use the new modal
- [ ] Expose `closeModal` as a global function

---

## Task 6: Implement Broadcast Notification System

**Requirement:** 6

Extend `sendAdminResponse()` from Task 5 to handle broadcast delivery to all users.

- When `isBroadcast === true` in `sendAdminResponse()`:
  - Load all registered users from `scosy_users` in `localStorage`
  - For each user, append the broadcast message to their personal message store: read `scosy_messages_${user.matric}`, push the message, save back
  - Also save the message to the global `scosy_messages` store
  - Set `targetStudentId: null` and `isBroadcast: true` on the message object
- In `student.js` `loadMessages()`, include messages from both `scosy_messages` (global) and filter for `isBroadcast === true` entries
- Broadcast messages must render with the `.broadcast` CSS class and "📢 System Announcement" label (from Task 3/4)
- Update `updateStats()` in `student.js` to count broadcast messages as part of the unread message count

**Sub-tasks:**
- [ ] Extend `sendAdminResponse()` to fan out broadcast messages to all user stores
- [ ] Update `student.js` `loadMessages()` to include broadcast messages from global store
- [ ] Ensure broadcast messages render with distinct styling in student chat

---

## Task 7: Real-Time Status Synchronization

**Requirement:** 7

Implement a polling-based synchronization mechanism so both dashboards reflect changes without a full page refresh.

- In `student.js`, add a `startSyncPolling()` function that runs every 10 seconds:
  - Re-reads `scosy_complaints_${currentUser.matric}` from `localStorage`
  - Compares complaint statuses with the current in-memory `complaints` array
  - If any status has changed (e.g. to `'answered'`), updates the in-memory array, calls `renderComplaints()` and `updateStats()`
  - Re-reads messages and updates `#messageBadge` if unread count changed
- In `admin.js`, add a `startSyncPolling()` function that runs every 10 seconds:
  - Re-reads `scosy_all_complaints` and compares with in-memory `allComplaints`
  - If changed, calls `updateStats()` and re-renders the active complaints list
- Call `startSyncPolling()` from `init()` in both `student.js` and `admin.js`
- Clear the polling interval on `logout()` in both files

**Sub-tasks:**
- [ ] Implement `startSyncPolling()` in `student.js` with complaint and message sync
- [ ] Implement `startSyncPolling()` in `admin.js` with complaint sync
- [ ] Clear polling intervals in `logout()` for both files
- [ ] Ensure stats and badges update without full page reload

---

## Task 8: Student Complaint Status Indicators for Answered Complaints

**Requirement:** 5

Update the student complaint list to visually indicate answered/unread complaints and allow viewing the chat thread inline.

- In `student.js` `renderComplaints()`, update the ticket item template:
  - If `complaint.status === 'answered'` or `complaint.hasUnreadResponse === true`, add the `.complaint-answered-badge` class to the ticket item and show a "New Response" badge
  - Add a "View Response" button to each ticket that has `responseCount > 0`:
    - Clicking it calls `showComplaintChat(complaint.id)` which navigates to the chat section and scrolls to/filters messages for that complaint
- Implement `showComplaintChat(complaintId)` in `student.js`:
  - Calls `showSection('chat')`
  - Filters `loadMessages()` to show only messages for that `complaintId` (plus broadcasts)
  - Marks `hasUnreadResponse` as `false` and saves back to `localStorage`
  - Calls `updateStats()` to refresh the unread count
- Update `filterComplaints()` from Task 1 to also re-render with answered status indicators

**Sub-tasks:**
- [ ] Update `renderComplaints()` to show answered badge and "View Response" button
- [ ] Implement `showComplaintChat(complaintId)` in `student.js`
- [ ] Mark `hasUnreadResponse: false` when student views the response
- [ ] Ensure `updateStats()` reflects cleared unread state after viewing
