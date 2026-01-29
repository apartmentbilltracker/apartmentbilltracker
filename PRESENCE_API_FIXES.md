# Presence API & Water Bill Calculation Fixes

## Issues Resolved

### 1. **POST Presence Error (400): "Presence dates must be an array"**

- **Root Cause:** PresenceScreen was sending `{ date: "2024-01-15" }` but backend expects `{ presenceDates: ["2024-01-15"] }`
- **Solution:** Refactored PresenceScreen to collect all marked dates in an array and send the complete array to the backend

### 2. **GET Presence Error (404)**

- **Root Cause:** No `GET /api/v2/rooms/{id}/presence` endpoint exists in the backend
- **Solution:**
  - Removed `presenceService.getPresence()` from apiService
  - Updated both PresenceScreen and BillsScreen to fetch presence data from `roomService.getRoomById()` where it's embedded in members array

## Changes Made

### PresenceScreen.js

**Location:** `mobile/src/screens/client/PresenceScreen.js`

#### Updated `loadMarkedDates()` function:

```javascript
const loadMarkedDates = async () => {
  if (!selectedRoom || !userId) return;

  try {
    // Find current user's member record in the room
    const currentUserMember = selectedRoom.members?.find(
      (m) => String(m.user?._id || m.user) === String(userId),
    );

    if (currentUserMember && Array.isArray(currentUserMember.presence)) {
      setMarkedDates(currentUserMember.presence);
    } else {
      setMarkedDates([]);
    }
  } catch (error) {
    console.error("Error loading marked dates:", error);
  }
};
```

#### Updated `markPresence()` function:

```javascript
const markPresence = async (date) => {
  if (!selectedRoom || !userId) return;

  try {
    setMarking(true);
    const dateStr = date.toISOString().split("T")[0];

    // Toggle the date in markedDates
    let updatedDates = [...markedDates];
    if (updatedDates.includes(dateStr)) {
      updatedDates = updatedDates.filter((d) => d !== dateStr);
    } else {
      updatedDates.push(dateStr);
    }

    // Sort dates for consistency
    updatedDates.sort();

    // Send the entire array of dates to backend
    await presenceService.markPresence(selectedRoom._id, {
      presenceDates: updatedDates,
    });

    // Update local state
    setMarkedDates(updatedDates);

    Alert.alert(
      "Success",
      "Presence " +
        (updatedDates.includes(dateStr) ? "marked" : "unmarked") +
        " for " +
        date.toLocaleDateString(),
    );
  } catch (error) {
    console.error("Error marking presence:", error);
    const errorMsg = error.message || "Failed to update presence";
    Alert.alert("Error", errorMsg);
  } finally {
    setMarking(false);
  }
};
```

#### Updated Attendance Summary Stats:

- Shows actual marked days count: `{markedDates.length}`
- Shows calculated water bill: `₱{(markedDates.length * 5).toFixed(2)}`

### BillsScreen.js

**Location:** `mobile/src/screens/client/BillsScreen.js`

#### Updated `loadMemberPresence()` function:

```javascript
const loadMemberPresence = async (roomId) => {
  try {
    // Fetch the room data directly - presence is already embedded in members
    const roomResponse = await roomService.getRoomById(roomId);
    const roomData = roomResponse.data || roomResponse;
    const room = roomData.room || roomData;

    // Extract presence by member from room members
    if (room?.members) {
      const presenceMap = {};
      room.members.forEach((member) => {
        presenceMap[member._id] = member.presence || [];
      });
      setMemberPresence(presenceMap);
    }
  } catch (error) {
    console.error("Error loading member presence:", error);
  }
};
```

### apiService.js

**Location:** `mobile/src/services/apiService.js`

#### Removed non-existent GET endpoint:

```javascript
// Before:
export const presenceService = {
  markPresence: (roomId, data) => ...,
  getPresence: (roomId) => api.get(`/api/v2/rooms/${roomId}/presence`),  // ❌ 404
};

// After:
export const presenceService = {
  markPresence: (roomId, data) => ...,
  // Note: Presence data is embedded in room members, fetch via roomService.getRoomById()
};
```

## Data Flow

### Marking Presence:

1. User clicks a date in PresenceScreen calendar
2. `markPresence(date)` is called
3. Date is toggled in local `markedDates` array
4. Entire array sent to backend: `POST /api/v2/rooms/{id}/presence { presenceDates: [...] }`
5. Backend validates array format and updates member's presence
6. Success alert shown with marked/unmarked status
7. Stats update immediately

### Loading Presence:

1. User navigates to PresenceScreen or selects a room
2. `loadMarkedDates()` fetches current user's member from selectedRoom
3. Reads `member.presence` array
4. Sets local `markedDates` state
5. Calendar displays marked dates correctly

### Water Bill Calculation:

1. BillsScreen fetches room via `roomService.getRoomById()`
2. `loadMemberPresence()` extracts presence arrays from each member
3. `calculateMemberWaterBill(memberId)` = `presence.length × ₱5`
4. `calculateTotalWaterBill()` = sum of all members' water bills
5. Displays per-member and total water bills in Bills tab

## Backend Requirements

### Expected Request Format:

```json
POST /api/v2/rooms/{roomId}/presence
Content-Type: application/json

{
  "presenceDates": ["2024-01-15", "2024-01-16", "2024-01-17"]
}
```

### Expected Response:

```json
{
  "success": true,
  "message": "Presence saved successfully",
  "room": {
    "name": "...",
    "billing": {...},
    "members": [
      {
        "_id": "...",
        "user": {...},
        "presence": ["2024-01-15", "2024-01-16", "2024-01-17"],
        "isPayer": true
      }
    ]
  }
}
```

## Testing Checklist

- [ ] Reload Expo app
- [ ] Navigate to Presence tab
- [ ] Click a date to mark presence
  - Expected: No 400 error
  - Expected: Success alert appears
  - Expected: Date cell highlights as marked
  - Expected: Stats update with correct day count
- [ ] Click marked date again to unmark
  - Expected: Date cell returns to normal state
  - Expected: Stats update correctly
- [ ] Navigate to Bills tab
  - Expected: No 404 error
  - Expected: Each member shows their presence count
  - Expected: Each member shows their water bill (days × ₱5)
  - Expected: Total water bill calculated correctly
  - Expected: Your share includes water component

## Common Issues & Fixes

| Issue                                 | Solution                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------ |
| 400 "Presence dates must be an array" | Send `{ presenceDates: [...] }` not `{ date: "..." }`                    |
| 404 for GET /presence                 | Don't call presenceService.getPresence() - use roomService.getRoomById() |
| Water bill shows 0                    | Verify member.presence array exists and is populated                     |
| Dates not loading                     | Check that loadMarkedDates() runs after selectedRoom is set              |

## Notes for Future Development

- Water bill calculation is client-side only (can be moved to backend if needed)
- Presence data persists on server automatically when markPresence is called
- All currency displayed in Philippine Peso (₱)
- Dates are stored as ISO strings (YYYY-MM-DD format)
