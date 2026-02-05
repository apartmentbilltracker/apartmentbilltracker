# Stale Data Fixes - Billing Cycle Closure Cleanup

## Issues Identified & Fixed

### Issue 1: Water amounts still showing from closed cycle in AdminBillingScreen

**Root Cause:**

- Water bill is calculated dynamically from `member.presence` array length
- When a billing cycle closes, the members list was not being cleared locally
- Even though backend might clear presence data, frontend state wasn't being reset

**Fix Applied:**

- Modified `checkAndResetIfCycleClosed()` in AdminBillingScreen.js to clear `members` state when cycle is closed
- Added `setMembers([])` when:
  - No active cycle is found (`!latestRoom.currentCycleId`)
  - Cycle status is "completed"
  - An error occurs
- This ensures water bill calculation returns 0 (no members = no water)

**File Changed:**

- `mobile/src/screens/admin/AdminBillingScreen.js` - Added member clearing logic

**Water Bill Logic:**

```javascript
const calculateTotalWaterBill = () => {
  return members.reduce((total, member) => {
    const presenceDays = member.presence ? member.presence.length : 0;
    return total + calculateWaterBill(presenceDays); // ₱5 per day
  }, 0);
};
```

Since `members` is now cleared when cycle closes, this returns 0.

---

### Issue 2: Old collected amount (1185) still showing in AdminDashboard

**Root Cause:**

- The `/api/v2/admin/billing/payment-stats` endpoint was counting ALL completed payments
- Payments from closed billing cycles were being summed with payments from active cycles
- No filter on `billingCycleId` to only count payments for active cycles

**Fix Applied:**

- Modified payment-stats endpoint in `backend/controller/adminBilling.js` to filter payments
- Now only counts completed payments where `billingCycleId` is in the list of ACTIVE cycles
- Filters applied to both `PaymentTransaction` and `Payment` collections

**File Changed:**

- `backend/controller/adminBilling.js` - Payment-stats endpoint (lines 603-638)

**Before Fix:**

```javascript
// Get ALL completed payments
const completedPaymentsTransaction = await PaymentTransaction.find({
  room: { $in: roomIds },
  status: "completed", // ← NO cycle filter!
});
```

**After Fix:**

```javascript
// Get cycle IDs for ACTIVE cycles only
const activeCycleIds = activeCycles.map((c) => c._id);

// Get completed payments ONLY for ACTIVE cycles
const completedPaymentsTransaction = await PaymentTransaction.find({
  room: { $in: roomIds },
  billingCycleId: { $in: activeCycleIds }, // ← NOW filtered!
  status: "completed",
});
```

---

## Data Flow After Fixes

### When a Billing Cycle Closes (all bills paid):

1. **Backend:** `checkAndAutoCloseCycle()` runs
   - Sets `BillingCycle.status = "completed"`
   - Clears `Room.currentCycleId = null`
   - (Optionally: clears `Room.members[].presence = []` and `Room.billing = {}`)

2. **Frontend AdminBillingScreen:**
   - `checkAndResetIfCycleClosed()` detects `currentCycleId = null`
   - Clears all amount fields: `startDate`, `endDate`, `rent`, `electricity`, `prevReading`, `currReading`
   - Clears members: `setMembers([])`
   - Water calculation now returns 0 (no members = no presence days)

3. **Frontend AdminDashboard:**
   - On screen focus: clears paymentStats cache
   - Refetches from `/api/v2/admin/billing/payment-stats`
   - **Backend now only returns stats for ACTIVE cycles**
   - Collected amount shows 0 (no payments for active cycles)
   - Pending amount shows 0 (no active cycles = no billed amount)

4. **Frontend AdminFinancialDashboard:**
   - Detects `currentCycleId = null`
   - Clears dashboard or shows message that cycle is complete

---

## Testing Checklist

After these changes, test the following scenario:

1. ✅ Create a new billing cycle with:
   - Room rent: ₱1000
   - Electricity: ₱500
   - 3 members with 10 days presence each

2. ✅ Record payments until all bills paid (₱1000 + ₱500 + ₱150 water = ₱1650)

3. ✅ Verify cycle auto-closes:
   - Check backend: `BillingCycle.status` should be "completed"
   - Check backend: `Room.currentCycleId` should be null

4. ✅ Check AdminBillingScreen:
   - Water should show 0 (was ₱150, now cleared)
   - Rent should show empty (was ₱1000)
   - All billing fields empty

5. ✅ Check AdminDashboard:
   - Collected should show 0 (was 1185)
   - Pending should show 0
   - Collection rate should show 0%

6. ✅ Create NEW billing cycle:
   - Verify new amounts show correctly
   - Water calculated from new presence data
   - Dashboard stats update for new active cycle

---

## Key Code Changes

### AdminBillingScreen.js

**Function:** `checkAndResetIfCycleClosed()`
**Key Change:** Added `setMembers([])` when cycle is closed
**Impact:** Water bill calculation depends on members array length

### adminBilling.js

**Endpoint:** `GET /api/v2/admin/billing/payment-stats`
**Key Change:** Added filter `billingCycleId: { $in: activeCycleIds }`
**Impact:** Only counts payments from ACTIVE cycles, excludes completed cycle payments

---

## Why These Fixes Work

### Water Showing 0:

- Water = members.length × presence.length × ₱5
- When members = [], water = 0
- No more stale presence data in calculations

### 1185 Not Showing:

- Old cycle had 1185 collected
- But old cycle's `billingCycleId` is NOT in activeCycleIds list
- Payment query now excludes those payments
- Only active cycle payments counted (0 if no active cycle)

---

## Related Code (No Changes Needed)

These functions/endpoints already working correctly:

1. **checkAndAutoCloseCycle()** in `backend/controller/paymentProcessing.js`
   - ✅ Correctly detects when all bills paid
   - ✅ Sets cycle status to "completed"
   - ✅ Clears `Room.currentCycleId`

2. **AdminDashboardScreen.js** focus listener
   - ✅ Already refetches payment-stats on screen focus
   - ✅ Clears cache before refetch

3. **AdminFinancialDashboardScreen.js** cycle detection
   - ✅ Already checks if cycle is closed
   - ✅ Refetches room data

---

## Future Enhancements

Consider implementing in backend `checkAndAutoCloseCycle()`:

- Clear `Room.members[].presence = []` for each member
- Clear `Room.billing = {}` object
- Create new empty cycle automatically

This would be a more complete cleanup, ensuring both backend and frontend data are reset.

---

## Status

- ✅ AdminBillingScreen: Members cleared when cycle closes → Water shows 0
- ✅ AdminDashboard: Payment-stats filters ACTIVE cycles only → 1185 not counted
- ✅ AdminFinancialDashboard: Already detecting closed cycles
- 🔄 Ready for testing
