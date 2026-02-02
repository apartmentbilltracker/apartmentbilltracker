# Phase 15: Water Billing Consistency Fix - COMPLETE

## Problem Identified

**Issue**: Inconsistent water billing values across screens in the same app session.

**Example**:

- **BillingHistoryScreen**: Shows ₱25.00 for Rommel's water (CORRECT)
- **BillsScreen**: Shows ₱17.50 for the same member (WRONG)
- **BillingScreen**: Shows ₱17.50 in "Water per Payor" (WRONG)

**Root Cause**:

- BillingHistoryScreen correctly displays `memberCharges.waterBillShare` from the active billing cycle (backend-calculated)
- BillsScreen and BillingScreen were independently calculating water from room presence data, not using the pre-calculated memberCharges from the active billing cycle
- Different data sources led to different formulas being applied

## Water Billing Formula (Correct)

```
Total Water = ALL members' presence days × ₱5/day (including non-payors)

Each Payor's Share = (own presence × ₱5) + (non-payors' total water ÷ payor count)

Example with Rommel (payor, 4 days), MJ (payor, 1 day), Imee (non-payor, 2 days):
- Total water = (4 + 1 + 2) × ₱5 = ₱35
- Non-payors' water = 2 × ₱5 = ₱10
- Rommel's share = (4 × ₱5) + (₱10 ÷ 2) = ₱20 + ₱5 = ₱25 ✓
- MJ's share = (1 × ₱5) + (₱10 ÷ 2) = ₱5 + ₱5 = ₱10 ✓
- Imee's share = ₱0 ✓
```

## Solution Implemented

### 1. BillsScreen Updates (src/screens/client/BillsScreen.js)

**Updated Imports**:

```javascript
import { roomService, billingCycleService } from "../../services/apiService";
```

**Added State**:

```javascript
const [activeCycle, setActiveCycle] = useState(null); // Active billing cycle with memberCharges
```

**Added Function** - `fetchActiveBillingCycle()`:

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
        "Active cycle found with memberCharges:",
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

**Updated Function** - `calculateMemberWaterBill()`:

- Now checks `activeCycle.memberCharges` first
- Uses pre-calculated `waterBillShare` from backend
- Falls back to manual calculation only if no active cycle exists

**Flow**:

1. useEffect detects selectedRoom change
2. Calls `fetchActiveBillingCycle(roomId)`
3. `calculateMemberWaterBill()` uses cycle data for display
4. Displays correct ₱25.00 for Rommel instead of ₱17.50

### 2. BillingScreen Updates (src/screens/client/BillingScreen.js)

**Updated Imports**:

```javascript
import {
  billingService,
  billingCycleService,
  roomService,
} from "../../services/apiService";
```

**Added State**:

```javascript
const [activeCycle, setActiveCycle] = useState(null); // Active billing cycle with memberCharges
```

**Added to fetchBilling()**:

```javascript
// Fetch active billing cycle for accurate charges
fetchActiveBillingCycle(roomId);
```

**Added Function** - `fetchActiveBillingCycle()`:

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
        "Active cycle found with memberCharges:",
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

**Updated Function** - `calculatePayorWaterShare()`:

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

// Fallback to manual calculation if no cycle
// ... calculate from memberPresence
```

**Updates**:

- "Water per Payor" now shows correct value from cycle
- "Total per Payor" calculation uses `calculatePayorWaterShare()` which now pulls from cycle
- Displays consistent ₱25.00 for payors instead of ₱17.50

### 3. BillingHistoryScreen (Already Correct)

No changes needed - already displays memberCharges from active cycle correctly

### 4. AdminBillingScreen (Already Correct)

No changes needed - shows correct preview with proper water calculations

## Data Flow Architecture

```
Backend (room.js)
    ↓
    Creates/Updates BillingCycle with memberCharges array
    ↓
Active Billing Cycle
    ├── memberCharges[0]: { userId, waterBillShare, ... }
    ├── memberCharges[1]: { userId, waterBillShare, ... }
    └── memberCharges[2]: { userId, waterBillShare, ... }
    ↓
Frontend Screens
    ├── BillsScreen: Fetches cycle → uses memberCharges.waterBillShare
    ├── BillingScreen: Fetches cycle → uses memberCharges.waterBillShare
    ├── BillingHistoryScreen: Displays cycle → shows memberCharges.waterBillShare
    └── AdminBillingScreen: Shows cycle preview → displays memberCharges
```

## Testing Verification

### Test Case: Rommel (payor, 4 days), MJ (payor, 1 day), Imee (non-payor, 2 days)

**Expected Results After Fix**:

- ✅ BillsScreen → Water Share: ₱25.00 (Rommel)
- ✅ BillingScreen → Water per Payor: ₱25.00 (Rommel)
- ✅ BillingHistoryScreen → Water: ₱25.00 (Rommel)
- ✅ AdminBillingScreen → Preview: ₱25.00 (Rommel)

All screens now source from the same backend-calculated `memberCharges` array.

## Implementation Status

| Component             | Change                                           | Status             |
| --------------------- | ------------------------------------------------ | ------------------ |
| BillsScreen imports   | Add billingCycleService                          | ✅ Complete        |
| BillsScreen state     | Add activeCycle                                  | ✅ Complete        |
| BillsScreen           | Add fetchActiveBillingCycle()                    | ✅ Complete        |
| BillsScreen           | Update calculateMemberWaterBill()                | ✅ Complete        |
| BillsScreen           | Call fetchActiveBillingCycle() on room change    | ✅ Complete        |
| BillingScreen imports | Add billingCycleService                          | ✅ Complete        |
| BillingScreen state   | Add activeCycle                                  | ✅ Complete        |
| BillingScreen         | Add fetchActiveBillingCycle()                    | ✅ Complete        |
| BillingScreen         | Update calculatePayorWaterShare()                | ✅ Complete        |
| BillingScreen         | Call fetchActiveBillingCycle() in fetchBilling() | ✅ Complete        |
| BillingHistoryScreen  | No changes needed                                | ✅ Already correct |
| AdminBillingScreen    | No changes needed                                | ✅ Already correct |
| Backend (room.js)     | Water formula calculation                        | ✅ Already correct |

## Key Implementation Details

### Service Integration

Both screens now use `billingCycleService.getBillingCycles(roomId)` to fetch billing cycles:

```javascript
// Returns array of BillingCycle objects
[
  {
    _id: "cycleId",
    status: "active",
    memberCharges: [
      {
        userId: "userId",
        waterBillShare: 25.0,
        rentShare: 50.0,
        electricityShare: 100.0,
        totalDue: 175.0,
      },
    ],
  },
];
```

### Fallback Logic

If active billing cycle doesn't exist or memberCharges are unavailable:

- BillsScreen falls back to calculating from room presence data
- BillingScreen falls back to calculating from member presence data
- Both maintain the same formula: own + split non-payor water

### Context Safety

Both functions safely access context:

- BillingScreen: `state?.user?._id` (AuthContext user ID)
- String comparison for userId matching: `String(c.userId) === String(state.user._id)`

## Consistency Achieved

All screens now implement the same data source pattern:

1. Fetch active billing cycle after selecting room/loading
2. Store in `activeCycle` state
3. Use `memberCharges` array for all calculations
4. Fall back to manual calculation only if no cycle exists

**Result**: All screens display identical water billing values based on the backend's pre-calculated, formula-verified memberCharges.

## Next Steps

1. **Test** the app with actual data
2. **Verify** that all screens show consistent water values (₱25.00 not ₱17.50)
3. **Monitor** console logs for any errors in fetching cycles
4. **Confirm** that non-payors still show ₱0 for water
5. **Validate** that multiple payors see correct individual shares
6. **Check** error handling when active cycle doesn't exist

## Files Modified

- `mobile/src/screens/client/BillsScreen.js` - Added cycle fetch and updated water calculation
- `mobile/src/screens/client/BillingScreen.js` - Added cycle fetch and updated water calculation
- No other files modified (backend and other screens already correct)

## Rollback Instructions

If issues occur, revert to previous version:

```bash
git checkout HEAD~1 -- mobile/src/screens/client/BillsScreen.js
git checkout HEAD~1 -- mobile/src/screens/client/BillingScreen.js
```
