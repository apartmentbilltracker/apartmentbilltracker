# Billing Cycle Smart Update Fix

## Problem
When creating a billing cycle through the admin billing screen, the cycle history screen would show empty results. Additionally, editing billing amounts would reset water consumption data unnecessarily.

## Root Cause
The previous implementation only saved billing data to the room object (`room.billing`), but:
1. **Never created a BillingCycle document** on initial save → cycle history shows empty
2. **Incorrectly cleared presence data** when billing amounts were edited

## Solution Implemented

### Smart Create-or-Update Logic
The new flow implements a smart billing save mechanism:

#### Flow 1: First Time (No Active Cycle)
1. Admin enters billing amounts (rent, electricity, internet, meters)
2. Clicks "Save Billing"
3. **Creates a new BillingCycle document** with current member presence
4. Calculates member charges based on existing presence + new amounts
5. Cycle is now visible in AdminBillingCycleScreen

#### Flow 2: Subsequent Edits (Has Active Cycle)
1. Admin modifies billing amounts
2. Clicks "Save Billing"
3. **Updates the existing BillingCycle** (no new document created)
4. **Recalculates member charges** using existing presence data
5. **Preserves water consumption** - members don't need to re-mark

#### Flow 3: Close Cycle
1. Admin verifies all payments collected
2. Clicks "Archive & Close Cycle"
3. Closes current cycle
4. **Clears presence data** for fresh billing period
5. Ready for next cycle

---

## Code Changes

### Mobile App: AdminBillingScreen.js

**Location**: `handleSaveBilling` function

**Key Changes**:
- Check if `selectedRoom.currentCycleId` exists
- **If NOT**: Create new billing cycle (first save)
- **If YES**: Update existing cycle while preserving presence data
- Show appropriate success messages for each scenario

```javascript
if (!selectedRoom.currentCycleId) {
  // NEW CYCLE: Create the billing cycle document
  const createResponse = await apiService.post(
    "/api/v2/billing-cycles/create",
    cyclePayload,
  );
} else {
  // EXISTING CYCLE: Update the active cycle (preserve presence)
  const updateResponse = await apiService.put(
    `/api/v2/billing-cycles/${selectedRoom.currentCycleId}`,
    {
      rent: cyclePayload.rent,
      electricity: cyclePayload.electricity,
      waterBillAmount: cyclePayload.waterBillAmount,
      internet: cyclePayload.internet,
    },
  );
}
```

### Backend: billingCycle.js Controller

**Location**: `updateBillingCycle` function

**Key Changes**:
- Accept billing amount parameters (rent, electricity, waterBillAmount, internet)
- When amounts are updated, call `recomputeCycleSnapshot`
- `recomputeCycleSnapshot` recalculates member charges using **existing presence data**
- Preserves all member presence records - only amounts change

```javascript
if (
  rent !== undefined ||
  electricity !== undefined ||
  waterBillAmount !== undefined ||
  internet !== undefined
) {
  // Recalculate member charges from existing presence
  await recomputeCycleSnapshot(cycle);
}
```

---

## Behavior Summary

| Action | Cycle Created | Presence Clear | Charges Recalc | Result |
|--------|---------------|----------------|-----------------|--------|
| Save (new) | ✅ Yes | ❌ No | ✅ Yes | Cycle created, history shows data |
| Save (edit) | ❌ No | ❌ No | ✅ Yes | Amounts updated, members keep data |
| Archive | ✅ Yes | ✅ Yes | ✅ Yes | Cycle closed, ready for new one |

---

## User Experience

### Admin Benefits
- ✅ Billing cycle history is populated correctly
- ✅ Can edit billing amounts without affecting member presence
- ✅ Clear two-step process: Edit → Archive
- ✅ No duplicate billing cycles created

### Member Benefits
- ✅ Don't need to re-mark presence when admin adjusts amounts
- ✅ Water consumption is preserved and calculated correctly
- ✅ Only lose presence data when explicitly closing billing period

---

## Testing Checklist

- [ ] Test creating billing (should create cycle, visible in history)
- [ ] Test editing amounts (should preserve presence, update charges)
- [ ] Test water bill calculation (should use preserved presence)
- [ ] Test archive (should close cycle, clear presence for new period)
- [ ] Verify cycle shows correct totals in history screen
- [ ] Verify member payments reflect recalculated charges

---

## Technical Details

### recomputeCycleSnapshot Function
Located in `backend/controller/billingCycle.js` (line 398+)

This function:
1. Gets room and current members with their **actual presence data**
2. Filters presence dates to only count days within cycle date range
3. Recalculates member charges using current billing amounts
4. Updates cycle with new charges while keeping presence intact
5. Returns updated cycle

### Keys to This Working
1. **Presence data stored in room members** - survives across updates
2. **Cycle stores references** - `recomputeCycleSnapshot` reads from room
3. **Smart backend logic** - only clears presence when explicitly requested
4. **No presence reset** on createBillingCycle - changes from original

---

## Git Log
- **File Modified**: `mobile/src/screens/admin/AdminBillingScreen.js`
- **File Modified**: `backend/controller/billingCycle.js`
- **Date**: February 6, 2026
- **Effect**: Fixes cycle history visibility and water consumption preservation
