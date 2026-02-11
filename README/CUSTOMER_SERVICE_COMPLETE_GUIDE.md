# Customer Service System - Complete Flow Guide

## System Architecture Overview

The customer service system has been built with three layers:

1. **Client Layer** (User-facing screens)
2. **Backend Layer** (API endpoints & database)
3. **Admin Layer** (Management screens)

---

## How It Works - Complete Flow

### **PHASE 1: USER SUBMITS A TICKET/BUG**

**User Action:**
```
User opens Profile → Customer Service section → Selects one of 3 options:
  1. Contact Support
  2. FAQs
  3. Report Issue
```

**For Support Tickets:**
1. User fills form:
   - Category: billing, payment, technical, general, other
   - Subject: "Payment not received"
   - Message: Detailed description
2. Clicks "Submit"
3. **Backend creates SupportTicket:**
   ```javascript
   {
     _id: ObjectId,
     user: userId,
     userName: "John Doe",
     userEmail: "john@email.com",
     subject: "Payment not received",
     message: "I paid $500 yesterday but it hasn't been recorded",
     category: "payment",
     priority: "medium",    // Auto-set by backend based on category
     status: "open",        // Always starts as "open"
     replies: [],           // Empty initially
     createdAt: timestamp,
     room: roomId
   }
   ```

**For Bug Reports:**
1. User fills form:
   - Module: billing, payment, announcements, profile, general
   - Severity: low, medium, high, critical
   - Title: "App crashes when submitting payment"
   - Description: Full details
2. Clicks "Submit"
3. **Backend creates BugReport:**
   ```javascript
   {
     _id: ObjectId,
     user: userId,
     userName: "John Doe",
     userEmail: "john@email.com",
     title: "App crashes when submitting payment",
     description: "Every time I try to submit...",
     severity: "high",
     module: "payment",
     status: "new",         // Always starts as "new"
     responses: [],         // Empty initially
     createdAt: timestamp,
     room: roomId
   }
   ```

### **PHASE 2: USER TRACKS PROGRESS (Client Side)**

**User Can:**

1. **View their tickets:**
   ```
   Client App → Profile → Customer Service → Contact Support → 
   "My Tickets" screen shows all user's tickets
   ```

2. **See ticket status progression:**
   ```
   Status Flow: open → in-progress → resolved → closed
   
   Visual badge shows current status:
   - 🔴 Open (newly created)
   - 🟠 In-Progress (admin is working on it)
   - 🟢 Resolved (admin found solution)
   - ⚫ Closed (ticket finalized)
   ```

3. **See admin replies in real-time:**
   ```
   Timeline shows:
   ┌─────────────────────────────────────────┐
   │ 👤 User                                 │
   │ "My payment isn't showing up"           │
   │ Feb 1, 2026 10:00 AM                   │
   ├─────────────────────────────────────────┤
   │ 👨‍💼 Admin                                │
   │ "Looking into this. Can you provide..."  │
   │ Feb 1, 2026 11:30 AM                   │
   ├─────────────────────────────────────────┤
   │ 👤 User                                 │
   │ "Payment ID is TXN-12345..."            │
   │ Feb 1, 2026 12:15 PM                   │
   ├─────────────────────────────────────────┤
   │ 👨‍💼 Admin                                │
   │ "Found it! Payment was declined..."     │
   │ Feb 1, 2026 01:45 PM                   │
   └─────────────────────────────────────────┘
   ```

### **PHASE 3: ADMIN MANAGES & RESPONDS (Admin Side)**

**Admin Dashboard (3 New Screens):**

#### **Screen 1: AdminSupportTicketsScreen**
```
Header: "Support Tickets" with count badge
       
Filter Tabs: [All] [Open] [In-Progress] [Resolved] [Closed]

For each ticket, Admin sees:
├─ Subject + Submitter Name
├─ Status badge (colored)
├─ Priority badge (High/Medium/Low)
├─ Category (billing, payment, technical, etc)
└─ Reply count

When admin taps a ticket:
├─ Full original message
├─ Submitter email & contact
├─ Complete conversation timeline
├─ Status selector: [New] [In-Progress] [Resolved] [Closed]
└─ Reply input box → Send button
   
When admin adds a reply:
1. Types response message
2. Clicks "Send Reply"
3. Backend adds to replies array with "from: admin"
4. User immediately sees it in their timeline
5. Status can be updated simultaneously
```

#### **Screen 2: AdminBugReportsScreen**
```
Header: "Bug Reports" with count badge

Filter Tabs: [All] [Critical] [High] [Medium] [Low]

For each bug, Admin sees:
├─ Title + Reporter Name
├─ Severity badge (color-coded)
├─ Status badge
├─ Affected Module (billing, payment, etc)
└─ Response count

When admin taps a bug:
├─ Full bug description
├─ Reporter info + email
├─ Device info (if provided)
├─ Complete response timeline
├─ Status selector: [New] [In-Review] [Acknowledged] [Fixed] [Closed]
└─ Response input box → Send button

When admin adds a response:
1. Types response message
2. Clicks "Send Response"
3. Backend adds to responses array
4. User sees it in their bug report timeline
5. Status can be updated simultaneously
```

#### **Screen 3: AdminFAQScreen**
```
Header: "FAQ Management" with Create button

Filter Tabs: [All] [Billing] [Payment] [Technical] [General] [Room]

For each FAQ, Admin sees:
├─ Question
├─ Answer (preview)
├─ Category badge
├─ Views count
├─ Helpful count ✅
├─ Not Helpful count ❌
├─ Edit button 🖊️
└─ Delete button 🗑️

Admin Actions:
1. CREATE NEW:
   - Click "+" button
   - Fill: Question, Answer
   - Select: Category, Display Order
   - Click "Create FAQ"

2. EDIT:
   - Click pencil icon
   - Modify Question/Answer
   - Change Category/Order
   - Click "Update FAQ"

3. DELETE:
   - Click trash icon
   - Confirm deletion
   - FAQ removed from system

Users can vote on FAQs:
- Every user who views an FAQ can click:
  ✅ "Helpful" - increases helpful count
  ❌ "Not Helpful" - increases notHelpful count
- Admin sees these statistics to improve FAQs
```

---

## API Endpoints Reference

### **Support Ticket Endpoints**
```
POST   /api/v2/support/create-ticket        ← User creates ticket
GET    /api/v2/support/my-tickets           ← User views their tickets
GET    /api/v2/support/ticket/:id           ← User views ticket details
POST   /api/v2/support/ticket/:id/reply     ← User/Admin adds reply
GET    /api/v2/support/all-tickets          ← Admin gets all tickets
PUT    /api/v2/support/ticket/:id/status    ← Admin changes status
```

### **Bug Report Endpoints**
```
POST   /api/v2/support/create-bug-report    ← User creates bug report
GET    /api/v2/support/my-bug-reports       ← User views their reports
GET    /api/v2/support/bug-report/:id       ← User views report details
POST   /api/v2/support/bug-report/:id/response ← User/Admin adds response
GET    /api/v2/support/all-bug-reports      ← Admin gets all reports
PUT    /api/v2/support/bug-report/:id/status   ← Admin changes status
GET    /api/v2/support/bug-report-stats     ← Admin gets statistics
```

### **FAQ Endpoints**
```
GET    /api/v2/support/faqs                 ← User gets FAQs
GET    /api/v2/support/faq-categories       ← Get available categories
POST   /api/v2/support/faq/:id/helpful      ← User marks as helpful
POST   /api/v2/support/faq/:id/not-helpful  ← User marks not helpful
POST   /api/v2/support/create-faq           ← Admin creates FAQ
PUT    /api/v2/support/faq/:id              ← Admin updates FAQ
DELETE /api/v2/support/faq/:id              ← Admin deletes FAQ
GET    /api/v2/support/admin-faqs           ← Admin gets all FAQs
```

---

## Database Schema Reference

### **SupportTicket Schema**
```javascript
{
  user: ObjectId (reference to User),
  userName: String,
  userEmail: String,
  subject: String,
  message: String,
  status: String (enum: "open", "in-progress", "resolved", "closed"),
  priority: String (enum: "low", "medium", "high"),
  category: String (enum: "billing", "payment", "technical", "general", "other"),
  room: ObjectId (reference to Room),
  replies: [
    {
      from: String ("user" or "admin"),
      message: String,
      createdAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### **BugReport Schema**
```javascript
{
  user: ObjectId (reference to User),
  userName: String,
  userEmail: String,
  title: String,
  description: String,
  severity: String (enum: "low", "medium", "high", "critical"),
  status: String (enum: "new", "in-review", "acknowledged", "fixed", "closed"),
  module: String (enum: "billing", "payment", "announcements", "profile", "general"),
  room: ObjectId (reference to Room),
  responses: [
    {
      from: String ("user" or "admin"),
      message: String,
      createdAt: Date
    }
  ],
  deviceInfo: String (optional),
  screenshots: [String] (optional),
  createdAt: Date,
  updatedAt: Date
}
```

### **FAQ Schema**
```javascript
{
  question: String,
  answer: String,
  category: String (enum: "billing", "payment", "technical", "general", "room"),
  isActive: Boolean (default: true),
  views: Number (default: 0),
  helpful: Number (default: 0),
  notHelpful: Number (default: 0),
  order: Number (for display ordering),
  createdAt: Date,
  updatedAt: Date
}
```

---

## User Journey Example

### **Scenario: User Reports Payment Issue**

**Step 1 - User Submits Ticket (Morning)**
```
9:00 AM → User opens Profile → Customer Service → Contact Support
         → Fills form: Category="Payment", Subject="Payment rejected"
         → Submits ticket
         → Gets confirmation: "Ticket #1234 created"
         → Status: 🔴 OPEN
```

**Step 2 - Admin Receives Notification**
```
9:15 AM → Admin opens Support Tickets dashboard
         → Sees new ticket from John Doe
         → Clicks to view details
         → Reads: "My payment was rejected by the system"
         → Changes status to: 🟠 IN-PROGRESS
         → Adds reply: "Hi John, looking into this now. Can you check your card details?"
```

**Step 3 - User Sees Admin Response**
```
9:20 AM → User checks their ticket
         → Sees admin reply with timestamp
         → Sees status now shows: 🟠 IN-PROGRESS
         → Responds: "Payment method is valid and up to date"
```

**Step 4 - Admin Resolves Issue**
```
10:00 AM → Admin sees user's response
          → Adds reply: "Found the issue! Your payment gateway was temporarily offline. Please try again now."
          → Changes status to: 🟢 RESOLVED
```

**Step 5 - Ticket Closed**
```
10:15 AM → User sees resolution
          → Confirms issue is fixed
          → Ticket automatically closes after 3 days: ⚫ CLOSED
          → Complete conversation saved in history
```

---

## Key Features Summary

### **For Users:**
✅ Create support tickets with category selection  
✅ Submit bug reports with severity levels  
✅ Browse FAQs by category  
✅ Vote on FAQ helpfulness  
✅ Track ticket status in real-time  
✅ See admin replies immediately  
✅ Full conversation history  

### **For Admins:**
✅ View all support tickets in one dashboard  
✅ Filter by status, priority, category  
✅ Add replies to tickets  
✅ Change ticket status  
✅ View and respond to bug reports  
✅ Track bug severity and affected modules  
✅ View bug statistics and trends  
✅ Create, edit, delete FAQs  
✅ Monitor FAQ performance (views, helpful votes)  
✅ Organize FAQs by category and display order  

---

## Integration Checklist

- ✅ Backend routes created (`/backend/routes/support.js`)
- ✅ Backend models created (SupportTicket, BugReport, FAQ)
- ✅ Backend controllers created with full CRUD operations
- ✅ Backend mounted in app.js
- ✅ Mobile API service updated with supportService
- ✅ Client profile screens with modals
- ✅ Admin management screens created:
  - ✅ AdminSupportTicketsScreen
  - ✅ AdminBugReportsScreen
  - ✅ AdminFAQScreen

**Next Steps:**
1. Add these screens to Admin Navigation
2. Test the complete flow end-to-end
3. Add email notifications (optional)
4. Add SMS alerts for critical bugs (optional)
5. Build reporting/analytics dashboard (optional)
