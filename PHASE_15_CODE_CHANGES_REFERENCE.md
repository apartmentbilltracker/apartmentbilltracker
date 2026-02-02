# Phase 15: Code Changes Reference

## Summary of All Changes

This document provides exact line references and change descriptions for Phase 15 implementation.

---

## File 1: mobile/src/screens/client/BillsScreen.js

### Change 1: Import billingCycleService

**Location**: Line 16  
**Type**: Import addition  
**Before**:

```javascript
import { roomService } from "../../services/apiService";
```

**After**:

```javascript
import { roomService, billingCycleService } from "../../services/apiService";
```

---

### Change 2: Add activeCycle State

**Location**: Line 35  
**Type**: State addition  
**Code**:

```javascript
const [activeCycle, setActiveCycle] = useState(null); // Active billing cycle with memberCharges
```

---

### Change 3: Call fetchActiveBillingCycle on Room Change

**Location**: Line 66 (in useEffect for selectedRoom)  
**Type**: Function call addition  
**Code**:

```javascript
useEffect(() => {
  if (selectedRoom) {
    loadMemberPresence(selectedRoom._id);
    fetchActiveBillingCycle(selectedRoom._id); // ← NEW
    console.log("📍 BillsScreen - selectedRoom changed");
    // ... rest of useEffect
  }
}, [selectedRoom]);
```

---

### Change 4: Add fetchActiveBillingCycle Function

**Location**: Lines 106-127  
**Type**: New function  
**Code**:

```javascript
const fetchActiveBillingCycle = async (roomId) => {
  try {
    console.log("Fetching active billing cycle for room:", roomId);
    const response = await billingCycleService.getBillingCycles(roomId);
    const cycles = response?.data || response || [];

    // Find active cycle
    const active = cycles.find((c) => c.status === "active");
    if (active) {
      setActiveCycle(active);
      console.log(
        "Active cycle found:",
        active._id,
        "with memberCharges:",
        active.memberCharges,
      );
    } else {
      setActiveCycle(null);
    }
  } catch (error) {
    console.error("Error fetching active billing cycle:", error);
    setActiveCycle(null);
  }
};
```

---

### Change 5: Update calculateMemberWaterBill Function

**Location**: Lines 259-296  
**Type**: Function logic update  
**Before**:

```javascript
const calculateMemberWaterBill = (memberId) => {
  // Water share for payor: own water + share of non-payors' water
  // Water share for non-payor: 0 (covered by payors)
  if (!selectedRoom?.members) return 0;

  const member = selectedRoom.members.find((m) => m._id === memberId);
  if (!member) return 0;

  // Non-payors pay 0 for water
  if (!member.isPayer) return 0;

  // For payors: calculate their share
  const payorCount = selectedRoom.members.filter((m) => m.isPayer).length || 1;
  const presence = memberPresence[memberId] || [];
  const memberOwnWater = presence.length * WATER_BILL_PER_DAY;

  // Non-payors' total water (split among payors)
  let nonPayorWater = 0;
  selectedRoom.members.forEach((member) => {
    if (!member.isPayer) {
      const presenceDays = (memberPresence[member._id] || []).length;
      nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
    }
  });

  // Each payor's water = own + (non-payors' water / payor count)
  return memberOwnWater + (payorCount > 0 ? nonPayorWater / payorCount : 0);
};
```

**After**:

```javascript
const calculateMemberWaterBill = (memberId) => {
  // If active billing cycle exists, use its pre-calculated memberCharges
  if (activeCycle?.memberCharges) {
    const charge = activeCycle.memberCharges.find(
      (c) => String(c.userId) === String(memberId),
    );
    if (charge) return charge.waterBillShare;
  }

  // Fallback: calculate from room data if no active cycle
  // Water share for payor: own water + share of non-payors' water
  // Water share for non-payor: 0 (covered by payors)
  if (!selectedRoom?.members) return 0;

  const member = selectedRoom.members.find((m) => m._id === memberId);
  if (!member) return 0;

  // Non-payors pay 0 for water
  if (!member.isPayer) return 0;

  // For payors: calculate their share
  const payorCount = selectedRoom.members.filter((m) => m.isPayer).length || 1;
  const presence = memberPresence[memberId] || [];
  const memberOwnWater = presence.length * WATER_BILL_PER_DAY;

  // Non-payors' total water (split among payors)
  let nonPayorWater = 0;
  selectedRoom.members.forEach((member) => {
    if (!member.isPayer) {
      const presenceDays = (memberPresence[member._id] || []).length;
      nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
    }
  });

  // Each payor's water = own + (non-payors' water / payor count)
  return memberOwnWater + (payorCount > 0 ? nonPayorWater / payorCount : 0);
};
```

**Key Addition**: Lines 261-266

```javascript
// If active billing cycle exists, use its pre-calculated memberCharges
if (activeCycle?.memberCharges) {
  const charge = activeCycle.memberCharges.find(
    (c) => String(c.userId) === String(memberId),
  );
  if (charge) return charge.waterBillShare;
}
```

---

## File 2: mobile/src/screens/client/BillingScreen.js

### Change 1: Update Import Statement

**Location**: Lines 17-18  
**Type**: Import modification  
**Before**:

```javascript
import { billingService, roomService } from "../../services/apiService";
```

**After**:

```javascript
import {
  billingService,
  billingCycleService,
  roomService,
} from "../../services/apiService";
```

---

### Change 2: Add activeCycle State

**Location**: Line 37  
**Type**: State addition  
**Code**:

```javascript
const [activeCycle, setActiveCycle] = useState(null); // Active billing cycle with memberCharges
```

---

### Change 3: Add fetchActiveBillingCycle Call to fetchBilling

**Location**: Lines 89-97  
**Type**: Function call addition  
**Code**:

```javascript
const fetchBilling = async () => {
  try {
    setLoading(true);
    console.log("Fetching billing for room:", roomId);
    // Get room data which includes billing
    const response = await roomService.getRoomById(roomId);
    console.log("BillingScreen - Room response:", response);
    const data = response.data || response;
    const room = data.room || data;
    console.log("BillingScreen - room members:", room?.members);

    setBilling({
      billing: room.billing,
      members: room.members,
    });
    console.log("BillingScreen - billing set to:", {
      billing: room.billing,
      members: room.members,
    });

    // Fetch active billing cycle for accurate charges  ← NEW LINE
    fetchActiveBillingCycle(roomId);             ← NEW LINE
```

---

### Change 4: Add fetchActiveBillingCycle Function

**Location**: Lines 104-127  
**Type**: New function  
**Code**:

```javascript
const fetchActiveBillingCycle = async (roomId) => {
  try {
    console.log("Fetching active billing cycle for room:", roomId);
    const response = await billingCycleService.getBillingCycles(roomId);
    const cycles = response?.data || response || [];

    // Find active cycle
    const active = cycles.find((c) => c.status === "active");
    if (active) {
      setActiveCycle(active);
      console.log(
        "Active cycle found:",
        active._id,
        "with memberCharges:",
        active.memberCharges,
      );
    } else {
      setActiveCycle(null);
    }
  } catch (error) {
    console.error("Error fetching active billing cycle:", error);
    setActiveCycle(null);
  }
};
```

---

### Change 5: Update calculatePayorWaterShare Function

**Location**: Lines 156-189  
**Type**: Function logic update  
**Before**:

```javascript
const calculatePayorWaterShare = () => {
  // Each payor's water = their own presence × ₱5 + (non-payors' water / payor count)
  if (!billing?.members) return 0;

  const payorCount = getPayorCount();
  let payorOwnWater = 0;
  let nonPayorWater = 0;

  billing.members.forEach((member) => {
    const presenceDays = member.presence ? member.presence.length : 0;
    if (member.isPayer) {
      payorOwnWater += presenceDays * WATER_BILL_PER_DAY;
    } else {
      nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
    }
  });

  // Average across payors
  const avgPayorOwnWater = payorCount > 0 ? payorOwnWater / payorCount : 0;
  const sharedNonPayorWater = payorCount > 0 ? nonPayorWater / payorCount : 0;
  return avgPayorOwnWater + sharedNonPayorWater;
};
```

**After**:

```javascript
const calculatePayorWaterShare = () => {
  // Each payor's water = their own presence × ₱5 + (non-payors' water / payor count)
  if (!billing?.members) return 0;

  // Use active billing cycle data if available (most accurate)
  if (activeCycle?.memberCharges && state?.user?._id) {
    const currentUserCharge = activeCycle.memberCharges.find(
      (c) => String(c.userId) === String(state.user._id),
    );
    if (currentUserCharge && currentUserCharge.isPayer) {
      return currentUserCharge.waterBillShare || 0;
    }
  }

  // Fallback to manual calculation from room data
  const payorCount = getPayorCount();
  let payorOwnWater = 0;
  let nonPayorWater = 0;

  billing.members.forEach((member) => {
    const presenceDays = member.presence ? member.presence.length : 0;
    if (member.isPayer) {
      payorOwnWater += presenceDays * WATER_BILL_PER_DAY;
    } else {
      nonPayorWater += presenceDays * WATER_BILL_PER_DAY;
    }
  });

  // Calculate share: own water + split non-payor water
  const myPresenceDays =
    billing.members.find((m) => String(m._id) === String(state?.user?._id))
      ?.presence?.length || 0;
  const myOwnWater = myPresenceDays * WATER_BILL_PER_DAY;
  const sharedNonPayorWater = payorCount > 0 ? nonPayorWater / payorCount : 0;
  return myOwnWater + sharedNonPayorWater;
};
```

**Key Addition**: Lines 161-168

```javascript
// Use active billing cycle data if available (most accurate)
if (activeCycle?.memberCharges && state?.user?._id) {
  const currentUserCharge = activeCycle.memberCharges.find(
    (c) => String(c.userId) === String(state.user._id),
  );
  if (currentUserCharge && currentUserCharge.isPayer) {
    return currentUserCharge.waterBillShare || 0;
  }
}
```

---

## Summary Statistics

| Metric                      | Value                       |
| --------------------------- | --------------------------- |
| Files Modified              | 2                           |
| Lines Added (BillsScreen)   | ~35                         |
| Lines Added (BillingScreen) | ~35                         |
| Total New Code              | ~70                         |
| Functions Added             | 2 (fetchActiveBillingCycle) |
| Functions Updated           | 2 (calculate functions)     |
| Imports Updated             | 2                           |
| States Added                | 2 (activeCycle)             |
| Breaking Changes            | 0                           |

---

## Verification Commands

### Check imports

```bash
grep -n "billingCycleService" mobile/src/screens/client/BillsScreen.js
grep -n "billingCycleService" mobile/src/screens/client/BillingScreen.js
```

### Check state declarations

```bash
grep -n "activeCycle" mobile/src/screens/client/BillsScreen.js
grep -n "activeCycle" mobile/src/screens/client/BillingScreen.js
```

### Check function usage

```bash
grep -n "fetchActiveBillingCycle" mobile/src/screens/client/BillsScreen.js
grep -n "fetchActiveBillingCycle" mobile/src/screens/client/BillingScreen.js
```

---

## No Changes Required In

- ✅ BillingHistoryScreen.js (already correct)
- ✅ AdminBillingScreen.js (already correct)
- ✅ Backend room.js (already correct)
- ✅ Backend billingCycle model (already correct)
- ✅ apiService.js (methods already exist)

---

## Related Documentation

- [PHASE_15_WATER_BILLING_CONSISTENCY_FIX.md](PHASE_15_WATER_BILLING_CONSISTENCY_FIX.md)
- [PHASE_15_COMPLETION_REPORT.md](PHASE_15_COMPLETION_REPORT.md)
- [WATER_BILL_FORMULA_UPDATE.md](WATER_BILL_FORMULA_UPDATE.md)
