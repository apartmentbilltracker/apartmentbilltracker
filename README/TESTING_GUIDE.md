# Presence & Water Bill - Quick Testing Guide

## What Was Fixed

### ❌ Before:

1. **POST /presence error (400):** Sending `{ date: "2024-01-15" }` instead of `{ presenceDates: [...] }`
2. **GET /presence error (404):** Trying to fetch from non-existent endpoint

### ✅ After:

1. **Correct API format:** Sends entire date array `{ presenceDates: ["2024-01-15", "2024-01-16", ...] }`
2. **Get presence from room data:** Presence is extracted from `roomService.getRoomById()` member records
3. **Water bills display:** Shows per-member and total water bills (₱5/day)

---

## Test Scenario 1: Mark Presence

### Steps:

1. Open mobile app
2. Go to **Presence tab**
3. Select a room (with billing dates set)
4. Click a date within the billing range
   - **Date must be:** Within billing start-end dates AND not in future

### Expected Results:

- ✅ Date cell highlights (green background)
- ✅ Checkmark appears on the cell
- ✅ Success alert: "Presence marked for [date]"
- ✅ "Days Marked" stat updates (shows actual count)
- ✅ "Water Bill" stat updates (count × ₱5)
- ✅ No 400 error in console

### Console Logs to Look For:

```
[API Request] POST http://10.18.100.4:8000/api/v2/rooms/{id}/presence
[API Response] 200 http://10.18.100.4:8000/api/v2/rooms/{id}/presence
Submitting presence dates: ["2024-01-15", "2024-01-16"]
```

---

## Test Scenario 2: Unmark Presence

### Steps:

1. Click an already-marked date
2. Watch for the unmark confirmation

### Expected Results:

- ✅ Date cell returns to normal (white/gray background)
- ✅ Checkmark disappears
- ✅ Success alert: "Presence unmarked for [date]"
- ✅ Stats update correctly
- ✅ No 400 error

---

## Test Scenario 3: View Water Bills

### Steps:

1. Go to **Bills tab**
2. Select a room with members who have marked presence
3. Scroll down to "Room Members & Water Bill" section

### Expected Results:

- ✅ **Total Bills section shows:**
  - Rent amount
  - Electricity amount
  - **Water: ₱X.XX** (NEW)
  - Total (includes water)

- ✅ **Room Members section shows:**
  - Each member's presence count (e.g., "Presence: 5 days")
  - Each member's water bill (e.g., "₱25.00" for 5 days)
  - Payer/Member badge

- ✅ **Your Share section shows:** (if user is payer)
  - Water Share: ₱X.XX
  - Total Due (includes water)

- ✅ No 404 error in console

### Console Logs to Look For:

```
[API Request] GET http://10.18.100.4:8000/api/v2/rooms/{id}
[API Response] 200 http://10.18.100.4:8000/api/v2/rooms/{id}
Loading presence for room: {id}
Room data with members: [{...}, {...}]
Member {name} presence: ["2024-01-15", "2024-01-16", "2024-01-17"]
```

---

## Test Scenario 4: Billing Date Range Validation

### Steps:

1. Go to **Presence tab**
2. Try clicking dates **outside** the billing range (before start or after end)
3. Try clicking **future dates**

### Expected Results:

- ✅ Dates show as disabled (gray, reduced opacity)
- ✅ Clicking does nothing
- ✅ Disabled dates show tooltip:
  - "Out Range" - if before start or after end
  - "Future" - if in the future
- ✅ Only valid dates are clickable

---

## Error Scenarios to Avoid

### ❌ Error 1: 400 "Presence dates must be an array"

- **Cause:** API receives `{ date: "..." }` instead of `{ presenceDates: [...] }`
- **Fixed:** PresenceScreen now sends entire array
- **Verify:** Check `markPresence()` function sends correct format

### ❌ Error 2: 404 /api/v2/rooms/{id}/presence

- **Cause:** Trying to GET from endpoint that doesn't exist
- **Fixed:** Removed `presenceService.getPresence()` call
- **Verify:** BillsScreen uses `roomService.getRoomById()` instead

### ❌ Error 3: Water bills show ₱0.00 for all members

- **Cause:** Member presence array is empty or undefined
- **Fix Verify:** Check console logs show presence array populated

---

## Debugging Checklist

| Symptom                | How to Debug                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| 400 error when marking | Check API payload in console - should be `{ presenceDates: [...] }` |
| 404 error in Bills tab | Check no calls to `presenceService.getPresence()`                   |
| Water bills all zero   | Verify `member.presence` is array with dates                        |
| Dates not marking      | Check `isDateMarkable()` validation                                 |
| Stats not updating     | Check `markedDates` state is being updated                          |

---

## Code Changes Summary

### Files Modified:

1. **PresenceScreen.js**
   - ✅ `loadMarkedDates()` - Fetches from member.presence
   - ✅ `markPresence()` - Sends array of dates
   - ✅ Stats section - Shows actual counts

2. **BillsScreen.js**
   - ✅ `loadMemberPresence()` - Uses roomService instead of presenceService
   - ✅ Water bill display - Added to total bills
   - ✅ Member breakdown - Shows per-member water bills

3. **apiService.js**
   - ✅ Removed `getPresence()` endpoint
   - ✅ Added comment explaining where to get presence data

---

## Success Indicators

When everything is working correctly, you should see:

1. **Presence Tab:**
   - ✅ Can mark/unmark dates without errors
   - ✅ Calendar restricts to billing period and past dates
   - ✅ Stats show actual day count and water bill

2. **Bills Tab:**
   - ✅ Water bill appears in total overview (₱X.XX)
   - ✅ Each member shows their presence count
   - ✅ Each member shows their calculated water bill
   - ✅ Your share includes water component

3. **Console:**
   - ✅ No 400 or 404 errors
   - ✅ API requests show proper payload format
   - ✅ Presence data logs show array of dates

---

## Next Steps if Issues Occur

1. **Clear app cache:** `npm start` and press `c` to clear cache
2. **Reload in Expo:** Press `r` to reload
3. **Check backend:** Verify `/api/v2/rooms/{id}/presence` endpoint exists
4. **Check member data:** Ensure room members have `presence` array property
5. **Review logs:** Look at console output for exact error messages
