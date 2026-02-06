# Customer Service System - Quick Reference Card

## Three Main Features

### 1️⃣ **CONTACT SUPPORT** (Support Tickets)
```
User Submits: Category + Subject + Message
    ↓
Backend stores with status="open"
    ↓
Admin views in dashboard, filters by status
    ↓
Admin adds replies (status: open → in-progress → resolved → closed)
    ↓
User sees conversation timeline with all replies
    ↓
User can track progress in real-time
```

**Status Flow:** 
```
🔴 OPEN → 🟠 IN-PROGRESS → 🟢 RESOLVED → ⚫ CLOSED
```

**Admin Can:**
- View all tickets
- Filter by: Status, Priority, Category
- Add replies
- Change status
- See conversation history

**User Can:**
- Create tickets
- View their tickets
- See all admin replies
- Reply back to admin
- Track status changes

---

### 2️⃣ **FAQS** (Frequently Asked Questions)
```
Admin creates: Question + Answer + Category
    ↓
Stored in database with views=0, helpful=0, notHelpful=0
    ↓
Users browse FAQs by category
    ↓
Users vote: "Helpful" or "Not Helpful"
    ↓
Admin sees statistics and improves FAQs
```

**Admin Can:**
- ✏️ Create new FAQs
- 📝 Edit existing FAQs
- 🗑️ Delete FAQs
- 📊 See views/helpful/notHelpful counts
- 📂 Organize by category
- 🔢 Set display order

**User Can:**
- 🔍 Search FAQs by category
- 👍 Vote helpful
- 👎 Vote not helpful
- 📖 Read answers

---

### 3️⃣ **REPORT ISSUE** (Bug Reports)
```
User Submits: Module + Severity + Title + Description
    ↓
Backend stores with status="new"
    ↓
Admin views in dashboard, filters by severity/module
    ↓
Admin acknowledges and adds responses
    ↓
Status: new → in-review → acknowledged → fixed → closed
    ↓
User sees response timeline with admin notes
    ↓
User knows when bug will be fixed
```

**Severity Levels:**
```
🔴 CRITICAL - System breaking
🟠 HIGH - Major feature broken
🟡 MEDIUM - Feature partially works
🟢 LOW - Minor inconvenience
```

**Status Flow:**
```
🔵 NEW → 🟡 IN-REVIEW → 🟣 ACKNOWLEDGED → 🟢 FIXED → ⚫ CLOSED
```

**Admin Can:**
- View all bug reports
- Filter by: Severity, Module, Status
- Add responses
- Change status
- See statistics
- Track trends

**User Can:**
- Report bugs with details
- See admin responses
- Know when bugs will be fixed
- Track bug status

---

## Real-Time Example: Payment Issue

### **Timeline of Events**

**9:00 AM - User Reports**
```
User Input:
- Category: "Payment"
- Subject: "Payment rejected"
- Message: "My payment was declined even though card is valid"

System Creates:
{
  status: "open",
  priority: "high",
  category: "payment",
  replies: []
}
```

**9:15 AM - Admin Sees It**
```
Admin Dashboard:
✋ 1 new ticket in "Payment" category (High priority)

Admin clicks ticket and sees:
- User: John Doe
- Email: john@apartment.com
- Category: Payment
- Subject: Payment rejected
- Message: Full details

Admin Actions:
1. Changes status: open → in-progress
2. Types reply: "Hi John, looking into this. Your payment appears..."
3. Clicks "Send Reply"
```

**9:20 AM - User Sees Response**
```
Timeline on User's Screen:

┌─────────────────────────────────────────┐
│ 👤 John Doe                      9:00 AM │
│ "My payment was declined even..."       │
├─────────────────────────────────────────┤
│ 👨‍💼 Admin                        9:15 AM │
│ "Hi John, looking into this..."         │
│ [Status changed to: IN-PROGRESS]        │
└─────────────────────────────────────────┘

User sees the issue is being handled!
```

**10:00 AM - Admin Solves It**
```
Admin finds that payment gateway maintenance was happening

Admin Adds Reply:
"Found it! Our payment processor was under maintenance from 9-10 AM.
Try submitting your payment again now. Let me know if it works!"

Changes status: in-progress → resolved
```

**10:05 AM - User Confirms**
```
User sees:
- Admin found the issue
- Status changed to RESOLVED ✅
- Payment now goes through
- User replies: "It worked! Thanks for the quick help!"
```

**System Auto-closes after 3 days of inactivity**
```
Status: resolved → closed ⚫
```

---

## Database Flow Example

### When User Creates Support Ticket:

```
Backend Controller: supportTicket.createSupportTicket()
    ↓
Creates new document in MongoDB:
{
  _id: "507f1f77bcf86cd799439011",
  user: "507f1f77bcf86cd799439999",
  userName: "John Doe",
  userEmail: "john@apartment.com",
  subject: "Payment rejected",
  message: "My payment was declined...",
  category: "payment",
  priority: "medium",
  status: "open",
  replies: [],
  room: "507f1f77bcf86cd799439888",
  createdAt: 2026-02-06T09:00:00Z,
  updatedAt: 2026-02-06T09:00:00Z
}
    ↓
Returns success to user
```

### When Admin Adds Reply:

```
Backend Controller: supportTicket.addReply()
    ↓
Finds ticket by ID
    ↓
Pushes new reply to replies array:
{
  from: "admin",
  message: "Hi John, looking into this...",
  createdAt: 2026-02-06T09:15:00Z
}
    ↓
Updates status: open → in-progress
    ↓
Saves to MongoDB
    ↓
Returns updated ticket to admin
```

### When User Views Ticket:

```
Frontend: GET /api/v2/support/ticket/:id
    ↓
Backend returns complete ticket with all replies:
{
  _id: "507f1f77bcf86cd799439011",
  subject: "Payment rejected",
  replies: [
    {
      from: "admin",
      message: "Hi John...",
      createdAt: "2026-02-06T09:15:00Z"
    }
  ],
  status: "in-progress",
  ...
}
    ↓
Frontend renders timeline with all replies
    ↓
User sees real-time conversation
```

---

## API Endpoints Quick Reference

### **What Endpoints Do What**

```
USER ACTIONS:
POST   /api/v2/support/create-ticket       → Create support ticket
GET    /api/v2/support/my-tickets          → Get my tickets
GET    /api/v2/support/ticket/:id          → View ticket details
POST   /api/v2/support/ticket/:id/reply    → Add reply to ticket
POST   /api/v2/support/create-bug-report   → Report a bug
GET    /api/v2/support/my-bug-reports      → Get my bug reports
GET    /api/v2/support/bug-report/:id      → View bug details
POST   /api/v2/support/bug-report/:id/response → Respond to bug
GET    /api/v2/support/faqs                → Get FAQs
POST   /api/v2/support/faq/:id/helpful     → Mark FAQ helpful
POST   /api/v2/support/faq/:id/not-helpful → Mark FAQ not helpful

ADMIN ACTIONS:
GET    /api/v2/support/all-tickets         → View all tickets
PUT    /api/v2/support/ticket/:id/status   → Change ticket status
GET    /api/v2/support/all-bug-reports     → View all bug reports
PUT    /api/v2/support/bug-report/:id/status → Change bug status
GET    /api/v2/support/bug-report-stats    → Get bug statistics
POST   /api/v2/support/create-faq          → Create new FAQ
PUT    /api/v2/support/faq/:id             → Update FAQ
DELETE /api/v2/support/faq/:id             → Delete FAQ
GET    /api/v2/support/admin-faqs          → View all FAQs
```

---

## Files Created

```
Backend:
✅ /backend/routes/support.js               - All endpoints
✅ /backend/model/supportTicket.js          - Schema
✅ /backend/model/bugReport.js              - Schema
✅ /backend/model/faq.js                    - Schema
✅ /backend/controller/supportTicket.js     - Logic
✅ /backend/controller/bugReport.js         - Logic
✅ /backend/controller/faq.js               - Logic

Mobile:
✅ /mobile/src/screens/client/ProfileScreen.js
    - Enhanced with 3 modals and support service integration

✅ /mobile/src/screens/admin/AdminSupportTicketsScreen.js
    - Dashboard for managing support tickets
    - Filter by status, priority
    - View ticket details and add replies

✅ /mobile/src/screens/admin/AdminBugReportsScreen.js
    - Dashboard for managing bug reports
    - Filter by severity
    - View bug details and add responses

✅ /mobile/src/screens/admin/AdminFAQScreen.js
    - Dashboard for managing FAQs
    - Create/edit/delete FAQs
    - View statistics (views, helpful votes)

API:
✅ /mobile/src/services/apiService.js
    - supportService object with all methods
```

---

## How User Tracks Progress

### **Client Side - User's View**

```
ProfileScreen → Customer Service Section

1. CONTACT SUPPORT
   Click → Support Modal opens
   Fill: Category, Subject, Message
   Click Submit → Ticket created
   
   Later, user clicks "Contact Support" again:
   → Shows list of all their tickets
   → Click on ticket → See full conversation
   → Status shows: Open/In-Progress/Resolved/Closed
   → All admin replies visible with timestamps
   → Can add user replies back

2. REPORT ISSUE
   Click → Bug Modal opens
   Fill: Severity, Module, Title, Description
   Click Submit → Bug report created
   
   Later, user clicks "Report Issue" again:
   → Shows all their bug reports
   → Click on bug → See full timeline
   → Status shows progression
   → Admin responses visible
   → User knows when bug will be fixed

3. FAQS
   Click → FAQ Modal opens
   Shows all FAQs
   Can select category
   User can vote: 👍 Helpful / 👎 Not Helpful
   Helpful FAQs shown first
```

### **Admin Side - Admin's View**

```
AdminDashboard → Support Management

1. SUPPORT TICKETS SCREEN
   See all tickets in one place
   Tabs: All / Open / In-Progress / Resolved / Closed
   
   For each ticket:
   - Subject + User name
   - Status badge (colored)
   - Priority badge
   - Category
   - Reply count
   
   Click a ticket → Modal opens:
   - Full conversation visible
   - Status selector: [open] [in-progress] [resolved] [closed]
   - Reply input box
   - Send reply button
   - Reply timeline

2. BUG REPORTS SCREEN
   See all bugs in one place
   Tabs: All / Critical / High / Medium / Low
   
   For each bug:
   - Title + Reporter name
   - Severity badge (colored)
   - Status badge
   - Module (billing, payment, etc)
   - Response count
   
   Click a bug → Modal opens:
   - Full description
   - Response timeline
   - Status selector: [new] [in-review] [acknowledged] [fixed] [closed]
   - Response input box
   - Send response button

3. FAQ SCREEN
   See all FAQs
   Category filter: Billing / Payment / Technical / General / Room
   
   For each FAQ:
   - Question preview
   - Answer preview
   - Category badge
   - Views count 👁️
   - Helpful count 👍
   - Not helpful count 👎
   - Edit button ✏️
   - Delete button 🗑️
   
   Click edit → Edit modal:
   - Edit question
   - Edit answer
   - Change category
   - Change display order
   - Save button
```

---

## Status Progression Rules

### **Support Tickets:**
```
open
  ↓ (admin starts helping)
in-progress
  ↓ (admin found solution)
resolved
  ↓ (auto-close after 3 days or manual)
closed
```

### **Bug Reports:**
```
new
  ↓ (admin starts investigating)
in-review
  ↓ (admin confirmed issue)
acknowledged
  ↓ (admin is fixing)
fixed
  ↓ (mark as finished)
closed
```

### **FAQ Metrics:**
```
Views: Increments each time user opens FAQ
Helpful: Increments when user clicks 👍
Not Helpful: Increments when user clicks 👎
Admin uses this to improve FAQs
```

---

## Key Takeaway

```
Users can always know:
  - What issues they've reported
  - What status their issue is in
  - Why their issue exists
  - When it will be fixed
  - What admins are doing to help

Admins can always:
  - See all user issues centrally
  - Respond to users quickly
  - Mark progress
  - Manage knowledge base (FAQs)
  - Track what issues are most common
```
