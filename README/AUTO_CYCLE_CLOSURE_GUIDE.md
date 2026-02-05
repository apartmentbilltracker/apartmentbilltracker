# Auto Billing Cycle Closure Implementation Guide

## Overview

The billing cycle now **automatically closes** when all bills for a room's current billing cycle are paid. This eliminates the need for manual admin intervention to close cycles after all members have paid their dues.

## How It Works

### 1. **New Auto-Close Function**

A new helper function `checkAndAutoCloseCycle(roomId)` has been added to `paymentProcessing.js` that:

- **Fetches** the room and its active billing cycle (via `currentCycleId`)
- **Queries** all completed `PaymentTransaction` records for the cycle's date range
- **Sums** the total collected amount from all completed payments
- **Compares** collected amount against `BillingCycle.totalBilledAmount`
- **Auto-closes** the cycle if `totalCollected >= totalBilledAmount`

### 2. **Integration Points**

The auto-close function is called automatically in 3 payment endpoints:

| Endpoint                   | Method | Path                                     |
| -------------------------- | ------ | ---------------------------------------- |
| GCash Verification         | POST   | `/api/v2/payments/verify-gcash`          |
| Bank Transfer Confirmation | POST   | `/api/v2/payments/confirm-bank-transfer` |
| Cash Payment Recording     | POST   | `/api/v2/payments/record-cash`           |

**Each time a payment is completed via any method, the system checks if the billing cycle should be auto-closed.**

### 3. **Cycle Closure Process**

When all bills are paid:

1. ✅ `BillingCycle` status changes from `"active"` → `"completed"`
2. ✅ `closedAt` timestamp is recorded
3. ✅ `Room.currentCycleId` is cleared (set to `null`)
4. ✅ Console logs document the auto-closure event

## Data Model Changes Required

### BillingCycle Schema

The `BillingCycle` model already has the required fields:

```javascript
{
  status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
  totalBilledAmount: { type: Number, default: 0 },  // Total billed for the cycle
  closedAt: { type: Date },                          // When cycle was closed
  closedBy: { type: mongoose.Schema.Types.ObjectId } // Who closed it (null for auto-close)
}
```

### PaymentTransaction Schema

Must include billing cycle dates for matching:

```javascript
{
  billingCycleStart: { type: Date },
  billingCycleEnd: { type: Date },
  status: { type: String, enum: ["completed", "pending", "cancelled"] }
}
```

## Testing Steps

### Prerequisites

1. A room with active billing cycle
2. Multiple members in the room
3. Known `totalBilledAmount` in the cycle (e.g., ₱1000)

### Test Scenario: Recording Payments Until Auto-Close

#### Step 1: Create/Setup Billing Cycle

```
Room: Room A (3 members)
Billing Cycle: Jan 1-31, 2025
Total Billed: ₱1200 (₱400 per member)
```

#### Step 2: Record First Payment

**Request:**

```bash
curl -X POST http://localhost:5000/api/v2/payments/record-cash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "roomId": "ROOM_ID",
    "amount": 400,
    "billType": "total",
    "receivedBy": "Admin"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Cash payment recorded",
  "transaction": { "_id": "...", "amount": 400, "status": "completed" }
}
```

**Console Output (Server):**

```
💳 Cash Payment - Processing payment for user: USER_ID_1
   ✅ Member payment found, updating status...
   Updated all statuses to: paid (TOTAL payment)
🔄 [AUTO-CLOSE] Checking if billing cycle should be auto-closed for room: ROOM_ID
   📌 Active cycle: CYCLE_ID
   💰 Total billed amount: 1200
   💵 Total collected via PaymentTransaction: 400
   📊 Collected payments: 1
⏳ [AUTO-CLOSE] Not all paid yet. Remaining: ₱800
```

#### Step 3: Record Second Payment

```bash
curl -X POST http://localhost:5000/api/v2/payments/record-cash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "roomId": "ROOM_ID",
    "amount": 400,
    "billType": "total",
    "receivedBy": "Admin"
  }'
```

**Console Output:**

```
💳 Cash Payment - Processing payment for user: USER_ID_2
   ✅ Member payment found, updating status...
🔄 [AUTO-CLOSE] Checking if billing cycle should be auto-closed for room: ROOM_ID
   📌 Active cycle: CYCLE_ID
   💰 Total billed amount: 1200
   💵 Total collected via PaymentTransaction: 800
   📊 Collected payments: 2
⏳ [AUTO-CLOSE] Not all paid yet. Remaining: ₱400
```

#### Step 4: Record Final Payment (Triggers Auto-Close)

```bash
curl -X POST http://localhost:5000/api/v2/payments/record-cash \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "roomId": "ROOM_ID",
    "amount": 400,
    "billType": "total",
    "receivedBy": "Admin"
  }'
```

**Console Output (AUTO-CLOSE TRIGGERED):**

```
💳 Cash Payment - Processing payment for user: USER_ID_3
   ✅ Member payment found, updating status...
🔄 [AUTO-CLOSE] Checking if billing cycle should be auto-closed for room: ROOM_ID
   📌 Active cycle: CYCLE_ID
   💰 Total billed amount: 1200
   💵 Total collected via PaymentTransaction: 1200
   📊 Collected payments: 3
✅ [AUTO-CLOSE] All bills paid! Amount collected >= 1200
   🚀 Auto-closing billing cycle...
   ✅ BillingCycle marked as completed
   ✅ Room.currentCycleId cleared
```

#### Step 5: Verify Auto-Closure

Check the database or call this endpoint to confirm the cycle is closed:

```bash
# Get billing cycles for the room
curl -X GET http://localhost:5000/api/v2/payments/billing-cycles/room/ROOM_ID \
  -H "Authorization: Bearer <token>"
```

**Expected Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "CYCLE_ID",
      "startDate": "2025-01-01",
      "endDate": "2025-01-31",
      "status": "completed",
      "closedAt": "2025-02-15T10:30:45.123Z",
      "totalBilledAmount": 1200,
      "membersCount": 3
    }
  ]
}
```

## Console Log Reference

### Auto-Close Success Indicators

Look for these logs in the server console when auto-closure succeeds:

```
✅ [AUTO-CLOSE] All bills paid! Amount collected >= 1200
   🚀 Auto-closing billing cycle...
   ✅ BillingCycle marked as completed
   ✅ Room.currentCycleId cleared
```

### Auto-Close Pending Indicators

When there's still outstanding balance:

```
⏳ [AUTO-CLOSE] Not all paid yet. Remaining: ₱400
```

### Auto-Close Error Indicators

If something goes wrong:

```
⚠️  [AUTO-CLOSE] Room not found or no active cycle
❌ [AUTO-CLOSE] Error checking/closing cycle: [error details]
```

## Troubleshooting

### Issue: Cycle not auto-closing after final payment

**Possible Causes:**

1. **Missing `totalBilledAmount` in BillingCycle**
   - Check if `BillingCycle.totalBilledAmount` is set
   - This should be set when the cycle is created
2. **Payment dates don't match cycle dates**
   - Ensure `PaymentTransaction.billingCycleStart` and `billingCycleEnd` match the cycle's `startDate` and `endDate`
   - Check for timezone issues

3. **Payments not marked as "completed"**
   - Cash payments should have `status: "completed"` immediately
   - GCash/Bank transfer payments must be verified before they're marked `completed`

4. **Room.currentCycleId not set**
   - The room must have an active `currentCycleId` for auto-close to work
   - Check room document: `Room.currentCycleId` should not be null

### Issue: Auto-close happening too early

**Solution:** Check your payment amounts. If the sum of payments exceeds `totalBilledAmount` before all members pay, the cycle will close. This is expected behavior but may indicate:

- Payment amounts are larger than individual shares
- Multiple payments recorded for the same member
- `totalBilledAmount` is set too low

## Integration with Mobile App

The mobile app will automatically detect when a cycle is closed through:

1. **API Response**: When fetching cycle data, closed cycles will have `status: "completed"`
2. **UI Updates**: The admin dashboard will stop showing the cycle as "active"
3. **Financial Reports**: Closed cycles appear in the billing history section

## Future Enhancements

Consider adding:

- 📧 Notification sent to admin when cycle auto-closes
- 📊 Analytics tracking auto-closure events
- ⏰ Scheduled check for cycles that should have closed (failsafe)
- 🔔 Member notification when cycle closes

## Code Location

**Implementation File:**

- [Backend: paymentProcessing.js](backend/controller/paymentProcessing.js)

**Key Function:** `checkAndAutoCloseCycle(roomId)` (lines 272-342)

**Integrated In:**

- `/api/v2/payments/verify-gcash` (line 551)
- `/api/v2/payments/confirm-bank-transfer` (line 761)
- `/api/v2/payments/record-cash` (line 927)

---

**Status:** ✅ Implementation Complete | 🧪 Ready for Testing
