# Client to Admin Payment Flow

## Complete System Flow

### **Phase 1: Billing Setup (Admin)**

```
Admin Dashboard
    ↓
Select Room
    ↓
Edit Billing Details (start date, end date, rent, electricity)
    ↓
Create Billing Cycle (automatically resets all member statuses to "pending")
    ↓
Billing Cycle Created
    └─→ memberPayments: [
          { member: userId, rentStatus: "pending", electricityStatus: "pending", waterStatus: "pending" }
        ]
```

---

### **Phase 2: Member Payment (Client Side)**

```
Member Opens App
    ↓
Views Dashboard/Billing
    ↓
Sees Outstanding Bills:
    • Rent: ₱5,000 (PENDING)
    • Electricity: ₱1,200 (PENDING)
    • Water: ₱300 (PENDING)
    ↓
Clicks "Pay Now"
    ↓
Payment Modal Opens (Choose payment method)
    • Cash, GCash, Bank Transfer, etc.
    ↓
Submits Payment
    ↓
Backend: POST /api/v2/payments/mark-bill-paid
    └─→ Creates Payment record
    └─→ Updates memberPayment status: "paid"
    └─→ Records payment date
    ↓
Member Sees: "Payment Successful ✓"
    ↓
Bill Status Changes to "PAID" (Green badge)
```

---

### **Phase 3: Admin Payment Verification**

```
Admin Opens App → Billing Tab → "Verify Payments"
    ↓
AdminPaymentVerificationScreen
    ↓
Fetches: GET /api/v2/payments/admin/pending/{roomId}
    ↓
API Returns:
{
  success: true,
  pendingPayments: [
    {
      _id: "payment123",
      memberId: "user456",
      memberName: "John Doe",
      billType: "rent",
      amount: 5000,
      status: "pending",
      dueDate: "2025-02-28"
    },
    ...
  ]
}
    ↓
Screen Displays List of Pending Payments
    ↓
Admin Actions:
    ├─ ✓ VERIFY PAYMENT
    │   └─ POST /api/v2/payments/admin/verify/{paymentId}
    │      └─→ Sets billType status to "paid"
    │      └─→ Records verification date
    │      └─→ Updates member record
    │
    ├─ ✗ REJECT PAYMENT
    │   └─ POST /api/v2/payments/admin/reject/{paymentId}
    │      └─→ Resets status back to "pending"
    │      └─→ Records rejection reason
    │      └─→ Member needs to re-pay
    │
    └─ 📝 ADD NOTE
        └─ POST /api/v2/payments/admin/add-note/{roomId}
           └─→ Adds admin comment to payment
           └─→ Useful for tracking issues/disputes
```

---

### **Phase 4: Financial Analytics (Admin)**

```
Admin Opens App → Billing Tab → "Financial Dashboard"
    ↓
AdminFinancialDashboardScreen
    ↓
Fetches:
    • GET /api/v2/admin/financial/dashboard/{roomId}
    • GET /api/v2/admin/financial/trends/{roomId}
    ↓
Dashboard Shows KPIs:
    ┌─────────────────────────────┐
    │ Total Billed:   ₱45,000     │ ← Sum of all billing cycles
    │ Collected:      ₱32,500     │ ← Sum of verified payments
    │ Outstanding:    ₱12,500     │ ← Difference
    │ Collection Rate: 72%         │ ← (Collected / Billed) × 100
    └─────────────────────────────┘

    Member Breakdown:
    • 8 Payers
    • 2 Non-Payers

    Current Cycle Status:
    • Rent:        8/10 paid (80%) ████████░░
    • Electricity: 7/10 paid (70%) ███████░░░
    • Water:       6/10 paid (60%) ██████░░░░
    ↓
Trends Show:
    Cycle #1: ₱40,000 billed, ₱28,000 collected (70%)
    Cycle #2: ₱42,000 billed, ₱30,500 collected (72%)
    Cycle #3: ₱45,000 billed, ₱32,500 collected (72%)
    ↓
Admin Can See:
    ✓ Collection is improving
    ✓ Which bill types are hardest to collect
    ✓ Overall financial health
```

---

### **Phase 5: Billing Details & Review (Admin)**

```
Admin Opens App → Billing Tab → Select Cycle → "View Details"
    ↓
AdminBillingDetailsScreen
    ↓
Fetches:
    • GET /api/v2/admin/billing/breakdown/{cycleId}
    • GET /api/v2/admin/billing/collection-status/{cycleId}
    ↓
Shows Cycle Summary:
    ┌─────────────────────────────┐
    │ Billing Cycle #3            │
    │ Jan 1 - Jan 31, 2025        │
    │                             │
    │ Room: Unit 101              │
    │ Total Members: 10           │
    │ Total Billed: ₱45,000       │
    └─────────────────────────────┘
    ↓
Expandable Member Cards:

    👤 John Doe
       ├─ Days Present: 20
       ├─ Rent Share:        ₱5,000 (PAID ✓)
       ├─ Electricity Share: ₱1,200 (PENDING ✗)
       └─ Water Share:       ₱300   (PAID ✓)

    👤 Jane Smith
       ├─ Days Present: 30
       ├─ Rent Share:        ₱5,000 (PAID ✓)
       ├─ Electricity Share: ₱1,200 (PAID ✓)
       └─ Water Share:       ₱300   (PAID ✓)

    [More members...]
    ↓
Payment Status Grid:
    ┌──────────────┬──────┬──────┬──────┐
    │ Member       │ Rent │ Elec │Water │
    ├──────────────┼──────┼──────┼──────┤
    │ John Doe     │ ✓    │ ✗    │ ✓    │
    │ Jane Smith   │ ✓    │ ✓    │ ✓    │
    │ ...          │      │      │      │
    └──────────────┴──────┴──────┴──────┘
    ↓
Export Button:
    └─→ Share as JSON file
        (For records, reports, etc.)
```

---

### **Phase 6: Manual Adjustments (Admin)**

```
Admin Opens App → Billing Tab → "Adjust Charges"
    ↓
AdminAdjustmentsScreen
    ↓
Fetches: GET /api/v2/admin/billing/breakdown/{cycleId}
    ↓
Shows All Members with Their Charges
    ↓
Admin Actions on Each Member:

    1️⃣ ADJUST CHARGE
        └─ Modal Opens
            ├─ Select Bill Type: [Rent] [Electricity] [Water]
            ├─ Enter Adjustment Amount: ₱-500
            ├─ Reason: "Electricity outage"
            └─ Submit
        └─ PUT /api/v2/admin/billing/adjust-charge/{cycleId}/{chargeId}
            └─→ Updates memberCharge.rentShare/electricityShare/waterBillShare
            └─→ Records adjustment in history
            └─→ Recalculates totalBilledAmount
        └─ Success: "Charge adjusted successfully!"

    2️⃣ PROCESS REFUND
        └─ Modal Opens
            ├─ Select Bill Type: [Rent] [Electricity] [Water]
            ├─ Refund Amount: ₱500
            ├─ Reason: "Overpayment from last cycle"
            └─ Submit
        └─ POST /api/v2/admin/billing/refund/{cycleId}
            └─→ Creates refund transaction
            └─→ Reduces totalBilledAmount
            └─→ Records reason and admin who processed it
        └─ Success: "Refund processed successfully!"

    3️⃣ ADD NOTE
        └─ Modal Opens
            ├─ Bill Type (optional): [General] [Rent] [Electricity] [Water]
            ├─ Note: "Water meter malfunction, adjust next cycle"
            └─ Submit
        └─ POST /api/v2/admin/billing/add-note/{cycleId}/{memberId}
            └─→ Appends timestamped note
            └─→ Visible to all admins
        └─ Success: "Note added successfully!"
```

---

### **Phase 7: Payment Reminders (Admin)**

```
Admin Opens App → Billing Tab → "Send Reminders"
    ↓
AdminRemindersScreen
    ↓
Fetches: GET /api/v2/admin/reminders/overdue/{roomId}
    ↓
Shows Overdue Payments List:

    📋 3 Members with Overdue Payments

    👤 John Doe
       ├─ Email: john@example.com
       ├─ Overdue For: 5 days
       ├─ Unpaid Bills: [Electricity] [Water]
       ├─ Total Due: ₱1,500
       └─ Last Reminder: 2 days ago (sent 3 times)

    👤 Mike Johnson
       ├─ Email: mike@example.com
       ├─ Overdue For: 12 days
       ├─ Unpaid Bills: [Rent] [Electricity] [Water]
       ├─ Total Due: ₱6,500
       └─ Last Reminder: Never sent

    [More overdue members...]
    ↓
Admin Actions:

    📧 SEND INDIVIDUAL REMINDER
        └─ Click on member
        └─ Modal Opens
            ├─ Custom Message (optional): "Please pay your electricity bill"
            └─ Send
        └─ POST /api/v2/admin/reminders/send-reminder/{roomId}/{memberId}
            └─→ Sends email to member
            └─→ Increments reminderCount
            └─→ Records lastReminderDate
        └─ Success: "Reminder sent to John Doe!"

    ☑️ BULK SEND REMINDERS
        └─ Select Multiple Members: [☑ John] [☑ Mike] [☐ Others]
        └─ Modal Opens
            ├─ Custom Message (optional)
            └─ Send to 2 Members
        └─ POST /api/v2/admin/reminders/send-bulk-reminders/{roomId}
            └─→ Sends emails to all selected
            └─→ Updates reminder tracking for each
        └─ Success: "Reminders sent to 2 members!"

    📊 VIEW REMINDER HISTORY
        └─ Click History Button
        └─ GET /api/v2/admin/reminders/history/{roomId}/{memberId}
        └─ Shows:
            ├─ Total Reminders Sent: 4
            ├─ Last Reminder: 2 days ago
            └─ Can help decide if more follow-up needed
```

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                             │
│                      (Member/Resident)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Views Billing                  2. Makes Payment             │
│     • Rent: ₱5,000                    • Chooses method         │
│     • Electricity: ₱1,200             • Pays amount            │
│     • Water: ₱300                     • Gets confirmation      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         └────────────────────┬───────────────┘
                              ▼
         ┌─────────────────────────────────┐
         │      BACKEND DATABASE           │
         ├─────────────────────────────────┤
         │  Room                           │
         │  ├─ members                     │
         │  ├─ billingCycles              │
         │  ├─ memberPayments  ◄──────────┤─── Status Updated
         │  │  └─ rentStatus: "paid"      │     to "paid"
         │  │  └─ rentPaidDate            │
         │  └─ memberCharges              │
         │     └─ totalBilledAmount       │
         │                                 │
         │  Payment (transaction record)   │
         │  ├─ amount                      │
         │  ├─ paymentDate                 │
         │  └─ paymentMethod              │
         └─────────────────────────────────┘
                      │
                      │ Admin Queries Data
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN SIDE                              │
│                    (Room Administrator)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │ Payment          │     │ Financial        │                 │
│  │ Verification     │     │ Dashboard        │                 │
│  │                  │     │                  │                 │
│  │ • View pending   │     │ • KPI summary    │                 │
│  │ • Verify/Reject  │     │ • Trends         │                 │
│  │ • Add notes      │     │ • Collection %   │                 │
│  └──────────────────┘     └──────────────────┘                 │
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │ Billing Details  │     │ Adjustments &    │                 │
│  │                  │     │ Refunds          │                 │
│  │ • Cycle summary  │     │                  │                 │
│  │ • Member breakdown│    │ • Adjust charges │                 │
│  │ • Payment status │     │ • Process refund │                 │
│  │ • Export data    │     │ • Add notes      │                 │
│  └──────────────────┘     └──────────────────┘                 │
│                                                                  │
│  ┌──────────────────┐                                          │
│  │ Payment          │                                          │
│  │ Reminders        │                                          │
│  │                  │                                          │
│  │ • View overdue   │                                          │
│  │ • Send reminders │                                          │
│  │ • Track history  │                                          │
│  └──────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Data Flows Summary

### **1. Member Payment → Admin Verification**

```
Member pays ₱5,000 rent
    ↓
Backend: memberPayment.rentStatus = "paid"
    ↓
Admin views: Payment shows as "PENDING VERIFICATION"
    ↓
Admin clicks "Verify"
    ↓
Backend: Confirms status = "verified"
    ↓
Dashboard updated: Collection rate increases
```

### **2. Cycle Creation → Admin Analytics**

```
Admin creates billing cycle for Jan
    ↓
Backend: Calculates member shares (rent, elec, water per person)
    ↓
Backend: Creates memberCharges records
    ↓
Backend: Sets all memberPayment statuses to "pending"
    ↓
Admin views Financial Dashboard
    ↓
Shows: "Total Billed: ₱45,000"
```

### **3. Collection Tracking Flow**

```
10 members in room
    ↓
Admin creates billing cycle: ₱45,000
    ↓
Day 1: 3 members pay → Dashboard shows ₱13,500 collected (30%)
    ↓
Day 5: 5 more members pay → Dashboard shows ₱31,500 collected (70%)
    ↓
Day 15: Admin checks and finds 2 unpaid → Sends reminders
    ↓
Day 18: Those 2 members pay → 100% collection achieved ✓
```

### **4. Issue Resolution Flow**

```
Admin notices: "Jane's electricity too high"
    ↓
Opens Adjustments screen
    ↓
Adjusts Jane's electricity share: ₱1,200 → ₱800
    ↓
Adds note: "Meter malfunction, will adjust next cycle"
    ↓
Member's total due decreases
    ↓
Dashboard automatically recalculates
```

---

## Summary

**Client → Server Flow:**

- Member makes payment → System records it → Status: "pending"

**Server → Admin Flow:**

- Admin verifies/reviews → System updates status → Reflects in dashboard

**Admin Actions → Database → Client:**

- Admin adjusts charges → System updates → Member sees new balance (next login)
- Admin sends reminder → System sends email → Member receives notification
- Admin creates cycle → System resets statuses → Member sees new billing

This creates a complete cycle of **Payment → Verification → Analytics → Adjustments → Follow-up**.
