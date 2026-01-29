# Billing Cycle Management Guide

## Overview

The Billing Cycle system allows admins to create billing periods and users to view their billing history.

---

## For Admins

### Where to Access

1. Go to **Billing** tab in the bottom navigation
2. Click on any room card to open **AdminBillingCycleScreen**

### Creating a New Billing Cycle

1. Tap **"New Billing Cycle"** button
2. Set **Start Date** and **End Date** (use date picker)
3. Enter:
   - **Rent Amount** (e.g., 5000)
   - **Electricity Amount** (e.g., 800)
   - **Water Bill Amount** (e.g., 500)
   - Optional: Previous and Current Meter Readings

4. Tap **"Create Cycle"**
5. The cycle will appear in the list with status: **ACTIVE**

### Example: December Billing

- **Start Date:** 12/01/2025
- **End Date:** 12/31/2025
- **Rent:** 5000
- **Electricity:** 800
- **Water:** 500

### Closing a Billing Cycle

1. Find the **ACTIVE** cycle in the list
2. Tap the **"Close Cycle"** button (orange button at bottom)
3. Confirm the action
4. Status changes to **COMPLETED**

⚠️ **Important:** The cycle doesn't auto-close based on the end date. You must manually click "Close Cycle" when the billing period is over.

### What Happens When You Close a Cycle?

- The cycle status changes to **COMPLETED**
- The system saves a snapshot of all billing data
- You can create a new cycle for the next period
- Users can view this cycle in their **Billing History**

---

## For Users/Members

### Where to Access

1. Go to **Bills** tab in the bottom navigation
2. Tap **"View History"** or navigate to the billing history screen
3. You'll see all past billing cycles

### Viewing Billing History

1. See list of all billing cycles with:
   - Cycle number (Cycle #1, Cycle #2, etc.)
   - Date range (e.g., "Dec 01, 2025 to Dec 31, 2025")
   - Status badge (ACTIVE, COMPLETED)
   - Total amount billed for that cycle

2. **Tap any cycle** to see detailed breakdown:
   - **Billing Period:** Start and end dates
   - **Bills Breakdown:**
     - Individual rent, electricity, water amounts
     - Total bills for that month
   - **Member Charges:** How much each member owes
     - Shows presence days
     - Shows individual share of each bill
     - Highlights if user is a payer
   - **Meter Readings:** Previous/current water meter readings and usage

---

## Workflow Example

### Your Scenario (12/27/2025 to 01/27/2026)

You created a cycle from 12/27/2025 to 01/27/2026. Today is 01/28/2026, so the end date has passed.

**Status:** Still showing as **ACTIVE** ✓ (This is correct!)

**Why?** The cycle only closes when an admin manually clicks "Close Cycle". The end date passing doesn't auto-close it.

**Next Step:**

1. Go to AdminBillingCycleScreen
2. Find your cycle (Cycle #1, 12/27/2025 - 01/27/2026)
3. Click **"Close Cycle"**
4. Status changes to **COMPLETED** ✓
5. Users can then view it in Billing History

### Complete Timeline

```
12/27/2025 → Create Cycle #1 (Status: ACTIVE)
12/27 - 01/27 → Billing period ongoing
01/27/2026 → End date passes (still ACTIVE - waiting for admin action)
01/28/2026 → Admin clicks "Close Cycle" (Status changes to COMPLETED) ✓
01/28/2026 → Create Cycle #2 for next billing period (01/28 - 02/27)
```

---

## API Endpoints (Backend)

### Create Cycle

```
POST /api/v2/billing-cycles/create
{
  "roomId": "...",
  "startDate": "2025-12-27T00:00:00Z",
  "endDate": "2026-01-27T00:00:00Z",
  "rent": 5000,
  "electricity": 800,
  "waterBillAmount": 500,
  "previousMeterReading": 123,
  "currentMeterReading": 156
}
```

### Get All Cycles for Room

```
GET /api/v2/billing-cycles/room/:roomId
```

### Get Single Cycle

```
GET /api/v2/billing-cycles/:cycleId
```

### Get Active Cycle

```
GET /api/v2/billing-cycles/active/:roomId
```

### Close Cycle

```
PUT /api/v2/billing-cycles/:cycleId/close
{
  "notes": "Optional notes"
}
```

---

## Features Checklist

✅ Admin can create billing cycles with custom dates
✅ Admin can view all cycles (active, completed, archived)
✅ Admin can manually close billing cycles
✅ Cycles show clear status badges
✅ Users can view billing history
✅ Users can see detailed breakdown of any past cycle
✅ Member charges tracked per cycle
✅ Meter readings recorded
✅ Immutable history (past cycles can't be edited)

---

## Common Questions

**Q: Why doesn't the cycle auto-close?**
A: Because you might need time to collect final payments, and bills might come in late. Admin decides when to officially close it.

**Q: Can I edit a closed cycle?**
A: No, closed cycles are immutable for audit trail purposes.

**Q: What if I make a mistake when creating a cycle?**
A: You can delete it if no bills have been added yet. Just tap delete (admin only).

**Q: Can users see the cycle creation/closing?**
A: Yes! Users see the status (ACTIVE/COMPLETED) and can see when the cycle was closed.

**Q: How many cycles can I have?**
A: Unlimited! The system tracks all historical cycles.
