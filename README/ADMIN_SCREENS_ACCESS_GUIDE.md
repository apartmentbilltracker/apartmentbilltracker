# Admin Screens Access Guide

## Overview

All 5 new admin screens have been integrated into your existing admin navigation structure. They are accessible from the **Billing tab** in your admin dashboard.

## How to Access the New Admin Screens

### **Method 1: Quick Access from Billing Screen (Recommended)**

1. Open the app as an **Admin** user
2. Go to the **Billing** tab (bottom navigation)
3. You'll see an **"Admin Tools"** section with quick access buttons:
   - ✓ **Verify Payments** → Payment Verification Screen
   - 📊 **Financial Dashboard** → Financial Analytics
   - ⚙️ **Adjust Charges** → Manual Adjustments Screen
   - 🔔 **Send Reminders** → Payment Reminders Screen

### **Method 2: Direct Navigation from Other Screens**

Each screen has navigation links to related admin tools:

- **Payment Verification** → Can link to Reminders
- **Financial Dashboard** → Can link to Billing Details
- **Billing Details** → Can link to Adjustments
- **Adjustments** → Can link back to Billing Details
- **Reminders** → Can link to member history

---

## 5 New Admin Screens

### 1. **Payment Verification Screen**

- **Path**: Billing → Verify Payments
- **Features**:
  - View all pending member payments
  - Verify payments with optional notes
  - Reject payments with reasons
  - Refresh control for live updates
  - Color-coded status badges

### 2. **Financial Dashboard**

- **Path**: Billing → Financial Dashboard
- **Features**:
  - KPI cards: Total Billed, Collected, Outstanding, Collection Rate
  - Member breakdown: Payers vs Non-Payers
  - Active cycle payment breakdown
  - Billing trends and history
  - Navigate to collection status

### 3. **Billing Details Screen**

- **Path**: Billing → View Cycles → Select Cycle → Details
- **Features**:
  - Detailed cycle summary with dates and totals
  - Expandable member charge breakdown
  - Per-member payment status grid (Rent/Elec/Water)
  - Collection summary with color coding
  - Export billing data as JSON

### 4. **Charge Adjustments Screen**

- **Path**: Billing → Adjust Charges
- **Features**:
  - View all members for selected cycle
  - Adjust rent/electricity/water charges per member
  - Capture adjustment reason
  - Process refunds with reason tracking
  - Add timestamped notes to member records
  - Track adjustment history

### 5. **Payment Reminders Screen**

- **Path**: Billing → Send Reminders
- **Features**:
  - View all overdue payments
  - Display days overdue and unpaid bill types
  - Send individual reminders with custom messages
  - Send bulk reminders to multiple members
  - View reminder history (count & last sent date)
  - Checkbox selection for bulk operations

---

## Integration Details

### Navigation Stack

```
AdminNavigator (Bottom Tabs)
├── DashboardStack
├── RoomStack
├── BillingStack ⭐ (Contains all new screens)
│   ├── AdminBilling (Main screen with quick access)
│   ├── BillingCycles
│   ├── PaymentVerification
│   ├── FinancialDashboard
│   ├── BillingDetails
│   ├── Adjustments
│   └── Reminders
├── MembersStack
└── ProfileStack
```

### Modified Files

1. **AdminNavigator.js** - Added 5 new screen imports and stack navigation
2. **AdminBillingScreen.js** - Added "Admin Tools" quick access section

### API Integration

All screens use the following backend endpoints:

- **Payment Management**: `/api/v2/payments/admin/*`
- **Financial Analytics**: `/api/v2/admin/financial/*`
- **Billing Reports**: `/api/v2/admin/billing/*`
- **Reminders**: `/api/v2/admin/reminders/*`

---

## User Experience Flow

### Typical Admin Workflow:

1. **Start**: Open app as admin → Billing tab
2. **Quick Access**: Click "Verify Payments" to see pending payments
3. **Verification**: Verify/reject payments, add notes if needed
4. **Analysis**: Click "Financial Dashboard" to see KPIs and trends
5. **Details**: Drill down to specific cycle billing details
6. **Adjustments**: Click "Adjust Charges" to fix any billing issues
7. **Follow-up**: Click "Send Reminders" for overdue members

---

## Feature Availability

| Feature                   | Status   | Location             |
| ------------------------- | -------- | -------------------- |
| View pending payments     | ✅ Ready | Payment Verification |
| Verify/reject payments    | ✅ Ready | Payment Verification |
| Financial KPIs            | ✅ Ready | Financial Dashboard  |
| Billing trends            | ✅ Ready | Financial Dashboard  |
| Member breakdown          | ✅ Ready | Billing Details      |
| Export billing data       | ✅ Ready | Billing Details      |
| Adjust charges            | ✅ Ready | Adjustments          |
| Process refunds           | ✅ Ready | Adjustments          |
| Add notes                 | ✅ Ready | Adjustments          |
| Send individual reminders | ✅ Ready | Reminders            |
| Send bulk reminders       | ✅ Ready | Reminders            |
| Reminder history          | ✅ Ready | Reminders            |

---

## Notes

- All screens require **admin role** to access
- Bearer token authentication is automatically handled
- Refresh controls on all data-fetching screens allow manual updates
- Modal dialogs prevent accidental operations
- Color coding helps identify payment statuses:
  - 🟢 Green = Paid/Success
  - 🟡 Orange = Pending/Warning
  - 🔴 Red = Rejected/Danger
  - 🔵 Blue = Default/Info

---

## Troubleshooting

**Screens not appearing?**

- Ensure you're logged in as an **admin** user (not a regular member)
- Check that the app role is properly set to "admin" in your user profile
- Verify all backend controllers are running

**Quick access buttons not working?**

- Make sure a room is selected in the Billing screen
- Check network connection for API calls
- Verify Bearer token is valid

**Data not loading?**

- Try the refresh control (pull down on any screen)
- Check console for API error messages
- Verify backend endpoints are accessible

---

## Next Steps

1. ✅ Access the screens from the Billing tab
2. ✅ Test each feature with sample data
3. ✅ Verify API integration works correctly
4. ✅ Customize styling/branding as needed
5. ✅ Set up backend database with test data
