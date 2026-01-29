# Presence & Water Bill Updates

## Overview

Updated the mobile app to restrict presence marking to billing period dates and future dates, and integrated water bill calculations (₱5 per day) into the Bills tab.

## Changes Made

### 1. PresenceScreen.js - Billing Range Validation

**Location:** `mobile/src/screens/client/PresenceScreen.js`

#### New Date Validation Functions:

- `isFutureDate(date)` - Checks if date is in the future
- `isDateInBillingRange(date)` - Validates date is within room's billing start and end dates
- `isDateMarkable(date)` - Combines all validations (must be in range AND not in future)

#### Features:

- Users can **only mark dates within the billing range**
- **Future dates are disabled** and cannot be marked
- Dates outside billing range show "Out Range" label
- Future dates show "Future" label
- Disabled cells have reduced opacity (0.5)
- Updated calendar legend to show "Unavailable" state

#### Updated JSX:

- Calendar day cells now properly check `isDateMarkable()` before allowing marking
- Disabled cells show visual feedback with gray background and reduced opacity
- Added legend item for unavailable dates

### 2. BillsScreen.js - Water Bill Integration

**Location:** `mobile/src/screens/client/BillsScreen.js`

#### New Constants:

```javascript
const WATER_BILL_PER_DAY = 5; // ₱5 per day
```

#### New State:

```javascript
const [memberPresence, setMemberPresence] = useState({}); // { memberId: presenceArray }
```

#### New Functions:

- `loadMemberPresence(roomId)` - Fetches presence data from room members
- `calculateTotalWaterBill()` - Sums water bills for all members (days × ₱5)
- `calculateMemberWaterBill(memberId)` - Calculates individual water bill based on marked days

#### Updated calculateBillShare():

Now includes water bill per payer:

```javascript
return {
  rent: rentPerPayer,
  electricity: electricityPerPayer,
  water: waterPerPayer,
  total: rentPerPayer + electricityPerPayer + waterPerPayer,
  payerCount,
};
```

#### Total Bills Section:

- Added Water bill card with blue icon
- Updated total calculation to include water bill
- Cards display: Rent, Electricity, Water, and Total

#### Your Share Section:

- Shows water bill split among payers
- Format: "Water Share: ₱X.XX - Split among N payer(s)"
- Updated total due to include water charge

#### Members Breakdown Section:

- Renamed to "Room Members & Water Bill"
- New member presence display: "Presence: X days"
- New water bill column showing individual water charge (₱X.XX)
- Positioned before payer badge for better UX

#### Styling:

Added new styles:

- `memberPresence` - Display presence days in blue
- `memberWaterBill` - Water bill column styling
- `waterBillLabel` - "Water Bill" label
- `waterBillAmount` - Blue colored amount display (₱X.XX)

### 3. Fixed Response Handling

Both screens now properly handle fetch API response structure:

```javascript
const data = response.data || response;
const fetchedRooms = data.rooms || data || [];
```

## Data Flow

### Presence to Water Bill Calculation:

1. Member marks presence in PresenceScreen (constrained to billing period)
2. `markPresence()` calls API: `presenceService.markPresence(roomId, { date })`
3. User navigates to Bills tab
4. BillsScreen loads room data and fetches presence info
5. `loadMemberPresence()` extracts presence from each member's data
6. `calculateMemberWaterBill(memberId)` counts marked days × ₱5
7. Water bills displayed per member and summed for total

## Business Logic

### Water Bill Calculation:

- **Per Member:** `marked_days × ₱5`
- **Total:** Sum of all members' water bills
- **Per Payer:** `total_water_bill ÷ number_of_payers`

### Validation Rules for Presence:

1. Date must be within `billing.start` and `billing.end`
2. Date cannot be in the future (today is acceptable)
3. Both conditions must be true to mark presence

## Testing Checklist

- [ ] Reload Expo app (`r` in terminal)
- [ ] Navigate to Presence tab
- [ ] Select a room with billing dates set
- [ ] Verify calendar only shows dates in billing range
- [ ] Try clicking a future date - should be disabled
- [ ] Try clicking a past date outside range - should be disabled
- [ ] Mark a valid date successfully
- [ ] Navigate to Bills tab
- [ ] Verify "Total Water Bill" shows in bills overview
- [ ] Verify each member shows their water bill amount
- [ ] Verify "Your Share" includes water bill split
- [ ] Check that total due includes all three components (rent, electricity, water)

## Future Enhancements

1. Backend persistence of water bills in database
2. Water bill history and reconciliation
3. Customizable water bill rate per room
4. Water meter reading tracking
5. Billing statement PDF export with water usage details

## Technical Notes

- Water bill calculation is **client-side only** (no backend changes needed yet)
- Presence data is read from room members array
- Water bill calculation is real-time based on marked dates
- All monetary values displayed in **Philippine Peso (₱)**
