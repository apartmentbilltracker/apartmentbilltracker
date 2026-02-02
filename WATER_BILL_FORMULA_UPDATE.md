# Water Bill Formula Update - Complete Implementation

## Overview

Updated water bill calculation to properly include non-payors' presence in total water cost, while ensuring payors bear all water expenses through a fair distribution model.

## New Water Bill Formula

### Total Water Bill (Billing Details)

```
Total Water = ALL members' presence days × ₱5/day
```

Includes presence from **both payors AND non-payors**.

**Example:**

- Payor 1 (Rommel): 4 days
- Payor 2 (MJ): 3 days
- Non-Payor (Imee): 3 days
- **Total Water = (4 + 3 + 3) × ₱5 = ₱50** ✅

---

## Individual Member Water Share (Member Charges)

### For Payors:

```
Payor's Water Share = (Own presence days × ₱5) + (Non-Payors' total water ÷ Payor count)
```

### For Non-Payors:

```
Non-Payor's Water Share = ₱0 (Payors cover their water)
```

**Example Breakdown (with same members):**

**Payors' own water:**

- Rommel: 4 × ₱5 = ₱20
- MJ: 3 × ₱5 = ₱15
- **Total payors' own = ₱35**

**Non-payors' water (to be shared by payors):**

- Imee: 3 × ₱5 = ₱15

**Payor shares:**

- Rommel: ₱20 (own) + ₱7.50 (half of ₱15 non-payor) = **₱27.50** ✅
- MJ: ₱15 (own) + ₱7.50 (half of ₱15 non-payor) = **₱22.50** ✅
- Imee: **₱0** (non-payor, covered by payors) ✅

**Verification:**

- Total: ₱27.50 + ₱22.50 + ₱0 = ₱50 ✓

---

## Changed Screens

### Backend

**File:** `backend/controller/room.js` (Lines 470-545)

- ✅ Calculate `totalPresenceDays` from ALL members
- ✅ Calculate `totalNonPayorWater` separately
- ✅ Generate `memberCharges` array with correct water shares
- ✅ Update BillingCycle with calculated memberCharges

### Frontend - Mobile App

#### 1. **BillsScreen.js**

- ✅ `calculateTotalWaterBill()` - Now sums ALL members' presence
- ✅ `calculateMemberWaterBill(memberId)` - Implements new payor formula
  - Returns 0 for non-payors
  - Returns own + shared for payors

#### 2. **BillingScreen.js**

- ✅ `calculateTotalWaterBill()` - Sums ALL members' presence
- ✅ `calculatePayorWaterShare()` - New function for payor formula
- ✅ Updated "Water per Payor" display using new function
- ✅ Updated "Total per Payor" calculation

#### 3. **BillingHistoryScreen.js**

- ✅ Uses `memberCharges` array from backend (already correct)
- ✅ Displays waterBillShare from memberCharges

#### 4. **AdminBillingScreen.js**

- ✅ `calculatePayorWaterShare()` - Shows expected payor share
- ✅ Added display showing "Water per Payor" calculation

---

## Testing Checklist

- [ ] Mark presence for all members (payors + non-payors)
- [ ] Verify BillingHistoryScreen shows:
  - [ ] Total water = (all presence days) × ₱5
  - [ ] Each payor's water = own + split of non-payors'
  - [ ] Non-payers water = ₱0
- [ ] Verify BillsScreen shows correct calculations
- [ ] Verify AdminBillingScreen shows correct per-payor water
- [ ] Verify BillingScreen shows correct per-payor totals

---

## Data Flow

```
User marks presence
  ↓
presenceService.markPresence()
  ↓
Backend: POST /api/v2/presence/:roomId
  ↓
room.js saveMemberPresence() → Present endpoint
  ↓
Recalculates active cycle:
  - totalPresenceDays (all members)
  - recalculatedWaterAmount (total × ₱5)
  - memberCharges[] (each member with water share)
  ↓
Returns updated cycle with memberCharges
  ↓
Frontend displays member charges with new water formula
```

---

## Formula Validation

**Requirements Met:**

- ✅ Total water includes non-payors' presence
- ✅ Each payor keeps their own water
- ✅ Non-payors' water split equally among payors
- ✅ Non-payors show ₱0 water share
- ✅ Total stays consistent (no duplication/loss)

**Math Verification:**

- Sum of all water shares = Total water bill ✓
- Non-payors always = 0 ✓
- Payors > 0 ✓
