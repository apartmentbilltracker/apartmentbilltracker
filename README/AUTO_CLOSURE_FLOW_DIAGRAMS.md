# Auto Billing Cycle Closure - Visual Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT RECEIVED                              │
│  (Cash / GCash / Bank Transfer)                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│         CREATE PaymentTransaction RECORD                         │
│  - room ID, payer ID, amount, billType                          │
│  - billingCycleStart & billingCycleEnd dates                    │
│  - status: "completed" (for cash) or "pending" (others)         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│         UPDATE Room.memberPayments STATUS                        │
│  - Mark member's payment status as "paid"                       │
│  - Record payment date                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│         SAVE Room to Database                                    │
│  - Persist updated payment statuses                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
            🔄 NEW: AUTO-CLOSE CHECK
┌─────────────────────────────────────────────────────────────────┐
│   checkAndAutoCloseCycle(roomId)                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │ Fetch Room.currentCycleId      │
        └────────┬───────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    NO: │               │ YES:
     null               │ Valid Cycle
         │               │
         ▼               ▼
    ❌ ABORT      🔍 Query PaymentTransaction
                  where room=roomId AND
                  status="completed" AND
                  dates match cycle

                  │
                  ▼
              💰 Sum Total Collected
                  from all matched payments

                  │
                  ▼
            ┌─────────────────────┐
            │ Compare with        │
            │ BillingCycle.       │
            │ totalBilledAmount   │
            └─────────┬───────────┘
                      │
            ┌─────────┴──────────┐
            │                    │
    Collected <    │    Collected ≥
    Billed?       │    Billed?
            │                    │
         NO │                 YES│
            │                    │
            ▼                    ▼
       ⏳ LOG:              ✅ AUTO-CLOSE:
    "Not all paid yet"
    Remaining: X pesos    • Update BillingCycle
                              status="completed"

                          • Set closedAt=now

                          • Clear
                            Room.currentCycleId

                          • LOG: Success

            │                    │
            └─────────┬──────────┘
                      │
                      ▼
         ✅ RESPONSE TO CLIENT
         Success: Payment recorded
```

## Sequence Diagram: Complete Flow with Actors

```
Admin          Mobile/API       Backend           Database
  │               │                │                 │
  │ Click         │                │                 │
  ├──────Record Payment────────────→                 │
  │               │                │                 │
  │               │          Create PaymentTx        │
  │               │          record in DB ──────────→
  │               │                │                 │
  │               │          Query room by ID ───────→
  │               │                │ ←──── Room doc──
  │               │                │                 │
  │               │          Update memberPayments
  │               │          mark payer as "paid"
  │               │          save room ─────────────→
  │               │                │                 │
  │               │                │ ← Room saved ──
  │               │                │                 │
  │               │       🔄 checkAndAutoCloseCycle(roomId)
  │               │                │                 │
  │               │          Query currentCycleId ──→
  │               │                │ ←─ cycle info──
  │               │                │                 │
  │               │       Query PaymentTransaction──→
  │               │       where billingCycle dates  │
  │               │                │ ←─ payments ───
  │               │                │                 │
  │               │          Sum collected amount
  │               │                │                 │
  │               │    ┌─ If collected >= totalBilled
  │               │    │            │                 │
  │               │    └→ Update BillingCycle ──────→
  │               │       status="completed"         │
  │               │       closedAt=now              │
  │               │                │ ← cycle updated
  │               │                │                 │
  │               │    ┌─ Clear Room.currentCycleId
  │               │    │            │                 │
  │               │    └→ Update Room ──────────────→
  │               │       currentCycleId=null        │
  │               │                │ ← room updated─
  │               │                │                 │
  │               │    Success: Cycle auto-closed!  │
  │ ←─────────────────────────────────────────────── │
  │  Payment recorded + Cycle closed automatically!  │
  │               │                │                 │
```

## Real Example Walkthrough

### Setup

- **Room:** Apartment 101
- **Billing Cycle:** Jan 1-31, 2025
- **Total Billed:** ₱1,200
  - Rent: ₱800
  - Electricity: ₱200
  - Water: ₱200

### Scenario: 3 Members, Equal Split (₱400 each)

#### Payment 1: Member A pays ₱400

```
Action: Record Cash Payment
Amount: ₱400
Result:
  ├─ PaymentTransaction created (₱400, completed)
  ├─ Room.memberPayments[0].rentStatus = "paid"
  ├─ checkAndAutoCloseCycle called
  │  └─ totalCollected: ₱400
  │  └─ totalBilledAmount: ₱1,200
  │  └─ 400 < 1200? YES
  │  └─ Remaining: ₱800 ❌ NOT CLOSED
  └─ Response: "Cash payment recorded"

Console Output:
🔄 [AUTO-CLOSE] Checking if billing cycle should be auto-closed...
   💰 Total billed amount: 1200
   💵 Total collected: 400
⏳ [AUTO-CLOSE] Not all paid yet. Remaining: ₱800
```

#### Payment 2: Member B pays ₱400

```
Action: Record Cash Payment
Amount: ₱400
Result:
  ├─ PaymentTransaction created (₱400, completed)
  ├─ Room.memberPayments[1].rentStatus = "paid"
  ├─ checkAndAutoCloseCycle called
  │  └─ totalCollected: ₱800 (400 + 400)
  │  └─ totalBilledAmount: ₱1,200
  │  └─ 800 < 1200? YES
  │  └─ Remaining: ₱400 ❌ NOT CLOSED
  └─ Response: "Cash payment recorded"

Console Output:
🔄 [AUTO-CLOSE] Checking if billing cycle should be auto-closed...
   💰 Total billed amount: 1200
   💵 Total collected: 800
⏳ [AUTO-CLOSE] Not all paid yet. Remaining: ₱400
```

#### Payment 3: Member C pays ₱400 (FINAL PAYMENT)

```
Action: Record Cash Payment
Amount: ₱400
Result:
  ├─ PaymentTransaction created (₱400, completed)
  ├─ Room.memberPayments[2].rentStatus = "paid"
  ├─ checkAndAutoCloseCycle called
  │  └─ totalCollected: ₱1,200 (400 + 400 + 400)
  │  └─ totalBilledAmount: ₱1,200
  │  └─ 1200 >= 1200? YES ✅
  │  └─ AUTO-CLOSE TRIGGERED!
  │     ├─ BillingCycle.status = "completed"
  │     ├─ BillingCycle.closedAt = 2025-02-15T10:30:45Z
  │     ├─ Room.currentCycleId = null
  │     └─ Logging success
  └─ Response: "Cash payment recorded"

Console Output:
🔄 [AUTO-CLOSE] Checking if billing cycle should be auto-closed...
   💰 Total billed amount: 1200
   💵 Total collected: 1200
✅ [AUTO-CLOSE] All bills paid! Amount collected >= 1200
   🚀 Auto-closing billing cycle...
   ✅ BillingCycle marked as completed
   ✅ Room.currentCycleId cleared
```

#### After Auto-Close

- **BillingCycle Status:** "completed" ✅
- **Room.currentCycleId:** null ✅
- **Admin Dashboard:** Shows cycle as closed
- **Mobile App:** Displays cycle in billing history

---

## Decision Tree: When Does Auto-Close Trigger?

```
                    Payment Recorded
                           │
                           ▼
                    Is Room valid?
                      /  \
                    NO    YES
                    │      │
                    ▼      ▼
                  ABORT  Is there an
                         active cycle?
                           /  \
                         NO    YES
                         │      │
                         ▼      ▼
                       ABORT  Query completed
                              payments for cycle
                                     │
                                     ▼
                              totalCollected
                              >= totalBilled?
                                 /  \
                               NO    YES
                               │      │
                               ▼      ▼
                             ✋ABORT  🚀 AUTO-CLOSE
                             WAIT    ├─ Update status
                             FOR     ├─ Set closedAt
                             MORE    └─ Clear cycleId
                             PMTS
```

---

## Data State After Auto-Close

### BillingCycle Document

```javascript
{
  _id: ObjectId("..."),
  room: ObjectId("..."),
  cycleNumber: 1,
  startDate: ISODate("2025-01-01"),
  endDate: ISODate("2025-01-31"),
  status: "completed",  // ← Changed from "active"
  totalBilledAmount: 1200,
  closedAt: ISODate("2025-02-15T10:30:45.123Z"),  // ← Set to now
  closedBy: null,  // ← System auto-closed (not admin)
  ...
}
```

### Room Document

```javascript
{
  _id: ObjectId("..."),
  currentCycleId: null,  // ← Cleared
  billing: {
    rent: 0,
    electricity: 0,
    water: 0,
    // ... reset for next cycle
  },
  ...
}
```

### PaymentTransaction Documents (All)

```javascript
[
  {
    _id: ObjectId("..."),
    room: ObjectId("..."),
    payer: ObjectId("member-a"),
    amount: 400,
    status: "completed",
    billingCycleStart: ISODate("2025-01-01"),
    billingCycleEnd: ISODate("2025-01-31"),
    ...
  },
  {
    _id: ObjectId("..."),
    room: ObjectId("..."),
    payer: ObjectId("member-b"),
    amount: 400,
    status: "completed",
    billingCycleStart: ISODate("2025-01-01"),
    billingCycleEnd: ISODate("2025-01-31"),
    ...
  },
  {
    _id: ObjectId("..."),
    room: ObjectId("..."),
    payer: ObjectId("member-c"),
    amount: 400,
    status: "completed",
    billingCycleStart: ISODate("2025-01-01"),
    billingCycleEnd: ISODate("2025-01-31"),
    ...
  }
]
// Total: 1200 ✅ Matches totalBilledAmount
```

---

## Error Scenarios

### Scenario 1: Overpayment

```
Total Billed: ₱1,000
Payments: ₱450 + ₱450 + ₱200 = ₱1,100

Result: Cycle auto-closes when totalCollected (1100) >= totalBilled (1000)
Excess: ₱100 (can be carried forward to next cycle or refunded)
```

### Scenario 2: Missing currentCycleId

```
Room has no active cycle
checkAndAutoCloseCycle is called
└─ Checks: if (!room.currentCycleId) return;
└─ Result: ❌ Function exits gracefully, no error
└─ Reason: No cycle to close
```

### Scenario 3: Database Error

```
Update BillingCycle fails (e.g., connection lost)
catch(error) block executes
└─ Logs: "❌ [AUTO-CLOSE] Error checking/closing cycle: [error]"
└─ Returns: { success: false, error: "..." }
└─ Payment: ✅ Still recorded successfully
└─ Cycle: ❌ Not closed (admin can manually close later)
```

---

**Diagram Version:** 1.0  
**Last Updated:** February 2025
