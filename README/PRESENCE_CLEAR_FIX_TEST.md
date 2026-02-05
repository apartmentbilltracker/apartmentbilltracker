# Presence Screen Individual Payment Clear - Test Plan

## Issue

After first payor pays, PresenceScreen still shows calendar. Only clears when ALL payors pay.
**Expected**: Each payor's presence should clear immediately after THEIR individual payment.

## Root Cause Analysis

1. PresenceScreen depends on `userPaidStatus` useMemo with deps `[selectedRoom, userId]`
2. When payment happens on BillsScreen, PresenceScreen not on focus
3. Navigation back to PresenceScreen triggers `isFocused` useEffect (500ms -> 1500ms delay)
4. Delay ensures backend has processed and saved payment
5. But fresh room data fetch may be using stale cache

## Fixes Applied (Feb 1, 2026)

### Fix 1: Increased Refresh Delay

- Changed from 500ms to 1500ms in isFocused useEffect
- Ensures backend has fully processed and committed payment to database

### Fix 2: Added Explicit Room Refresh

- Added `roomService.getRoomById()` call in selectedRoom useEffect
- Fetches fresh room data whenever selectedRoom is set
- Logs fresh memberPayments for debugging

### Fix 3: Corrected Dependency

- Changed from `[selectedRoom, currentMonth]` to `[selectedRoom._id]`
- Only re-runs when different room selected, not when room data updates

## Test Scenario

### Setup

- Create room with 2 payors: PAYOR_A and PAYOR_B
- Admin: Set Rent=1000, Electricity=160, Water=100
- Each payor's share: (1000+160+100)/2 = 630

### Test Steps

**Step 1: PAYOR_A Makes Payment**

```
1. PAYOR_A on PresenceScreen
   - Should see calendar (active billing cycle)
   - Should NOT see "paid all bills" message

2. PAYOR_A navigates to Bills
   - Should show rent: 1000, electricity: 160, water: 100
   - Should show all as "pending"

3. PAYOR_A pays full amount (630) via GCash
   - Payment succeeds (200 response)
   - memberPayment.rentStatus = "paid"
   - memberPayment.electricityStatus = "paid"
   - memberPayment.waterStatus = "paid"
   - Billing amounts PRESERVED (not cleared yet)

4. PAYOR_A returns to PresenceScreen
   - ✅ VERIFY: SHOULD see "Already paid all bills" message
   - ✅ VERIFY: Calendar HIDDEN
   - ✅ VERIFY: No mark presence buttons available
```

**Step 2: PAYOR_B Makes Payment**

```
1. PAYOR_B on PresenceScreen
   - Should see calendar (PAYOR_A's payment doesn't affect PAYOR_B's view)
   - Should NOT see "paid all bills" message

2. PAYOR_B navigates to Bills
   - Should STILL show rent: 1000, electricity: 160, water: 100
   - Should show PAYOR_B's share as "pending" (PAYOR_A's doesn't show for privacy)

3. PAYOR_B pays full amount (630) via Bank Transfer
   - Payment succeeds (200 response)
   - memberPayment.rentStatus = "paid"
   - memberPayment.electricityStatus = "paid"
   - memberPayment.waterStatus = "paid"
   - **NOW** checkAndClearBillingIfComplete() runs because all members paid
   - Billing cleared: rent=0, electricity=0, water=0
   - memberPayments reset to "pending" for next cycle
   - Cycle archived to billingHistory

4. BOTH payors return to PresenceScreen
   - ✅ VERIFY: Both see "paid all bills" message (billing now 0)
   - ✅ VERIFY: Calendar HIDDEN for both
```

**Step 3: Check Billing History**

```
1. Navigate to BillingHistoryScreen
   - ✅ VERIFY: Completed cycle visible
   - ✅ VERIFY: Shows rent: 1000, electricity: 160, water: 100
   - ✅ VERIFY: Shows both payors with "paid" status

2. Admin checks AdminBillingCycleScreen
   - ✅ VERIFY: Completed cycle visible in history
   - ✅ VERIFY: No active cycle (cleared)
```

## Logs to Monitor

### Success Indicators

**In BillsScreen after payment**:

```
[API Response] 200 http://.../verify-gcash
[API Response] 200 http://.../confirm-bank-transfer
🔍 BillsScreen - Checking payment status
   userPayment: {...rentStatus: "paid", electricityStatus: "paid", waterStatus: "paid"}
   allPaid: true  ← This user paid everything
```

**In PresenceScreen after returning**:

```
🔄 PresenceScreen - Fresh rooms fetched after focus  (1500ms delay)
✅ PresenceScreen - Refreshed room data from backend
   Fresh memberPayments: [{...rentStatus: "paid"...}, {...rentStatus: "pending"...}]

(or after 2nd payment):
   Fresh memberPayments: [{...rentStatus: "pending"...}, {...rentStatus: "pending"...}]  ← Reset for new cycle
```

**useMemo triggers**:

```
🔍 PresenceScreen - Checking payment status for user: [USER_ID]
   userPayment: {...rentStatus: "paid", electricityStatus: "paid", waterStatus: "paid"}
   rentStatus: paid electricityStatus: paid waterStatus: paid allPaid: true  ✅
```

**Admin clears billing**:

```
✅ All members have paid! Closing billing cycle...
📋 Billing cycle archived to history
🔄 Billing cycle cleared and member statuses reset
```

## Expected Result

- ✅ PAYOR_A sees "paid all bills" immediately after their payment
- ✅ PAYOR_B sees calendar until they pay, then sees "paid all bills"
- ✅ Water field persists and clears (schema fix)
- ✅ Billing history shows completed cycles (endpoints working)
- ✅ No 500 errors or database issues

## Rollback Plan

If PresenceScreen still not clearing after first payor:

1. Increase delay to 2000ms or 3000ms
2. Check backend logs for room.save() errors
3. Verify memberPayments array is updating in database
4. Check for duplicate memberPayment records or ID corruption

If water not clearing:

1. Verify room schema has water field in both billing and billingHistory
2. Check backend logs for water value in completed cycle
3. Manually verify in MongoDB: db.rooms.findOne().billing.water === 0

If billing history empty:

1. Verify billingHistory array has items
2. Test GET /billing-cycles/room/:roomId endpoint directly
3. Check if new endpoint parameters correct in mobile app
