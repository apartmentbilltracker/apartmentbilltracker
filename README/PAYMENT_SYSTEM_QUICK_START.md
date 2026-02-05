# Quick Start Guide - Payment & Settlement System

## 🎯 What Was Added

### Backend

- Payment tracking endpoints
- Settlement calculation and recording
- Database schema updates for payment status

### Mobile

- Payment History screen (view all transactions)
- Settlement screen (manage debts between members)
- Integration with Bills screen

---

## 🚀 Quick Start

### 1. View Payment History

On BillsScreen → Tap **"Payment History"** button

Shows:

- All room payments
- Who paid what, when
- Payment method & reference
- Billing period

### 2. Manage Settlements

On BillsScreen → Tap **"Settlements"** button

Features:

- Filter by status: Pending, Partial, Settled
- See who owes whom
- Mark debts as settled
- Track settlement dates

### 3. Record a Payment (Admin Only)

Endpoint: `POST /api/v2/payments/mark-bill-paid`

```json
{
  "roomId": "room_id",
  "memberId": "member_id",
  "billType": "rent|electricity|water|total",
  "amount": 5000,
  "paymentMethod": "cash|bank_transfer|credit_card|e_wallet|other",
  "reference": "optional-receipt-number"
}
```

### 4. Calculate Who Owes Whom

Endpoint: `POST /api/v2/payments/calculate-settlements`

```json
{
  "roomId": "room_id"
}
```

Returns automatic calculation of debts between members.

### 5. Record a Settlement

Endpoint: `POST /api/v2/payments/record-settlement`

```json
{
  "roomId": "room_id",
  "debtorId": "member_who_owes",
  "creditorId": "member_to_receive",
  "amount": 2000,
  "settlementAmount": 2000,
  "notes": "optional notes"
}
```

---

## 📱 Mobile Screens

### PaymentHistoryScreen

- **Location:** `src/screens/client/PaymentHistoryScreen.js`
- **Features:**
  - List all payments for a room
  - Filter by bill type (using icons)
  - Show payment method and date
  - Pull-to-refresh support
  - Responsive loading states

### SettlementScreen

- **Location:** `src/screens/client/SettlementScreen.js`
- **Features:**
  - Tab-based filtering (Pending/Partial/Settled)
  - Visual status indicators
  - Outstanding amount calculation
  - Quick "Mark as Settled" action
  - Real-time updates

---

## 🔌 API Integration

All endpoints are in `apiService.js`:

```javascript
// Payment endpoints
markBillPaid(roomId, memberId, billType, amount, paymentMethod, reference);
getPaymentHistory(roomId);
getMemberPaymentHistory(roomId, memberId);

// Settlement endpoints
calculateSettlements(roomId);
recordSettlement(roomId, debtorId, creditorId, amount, settlementAmount);
getSettlements(roomId, status);
getMemberDebts(roomId, memberId);
getMemberCredits(roomId, memberId);
```

---

## 🗄️ Database Schema

### Payment Model

```
- room (ref: Room)
- paidBy (ref: User)
- amount (Number)
- billType (rent|electricity|water|total)
- paymentMethod (cash|bank_transfer|etc)
- paymentDate (Date)
- reference (String)
- billingCycleStart, billingCycleEnd (Date)
```

### Settlement Model

```
- room (ref: Room)
- debtor (ref: User)
- creditor (ref: User)
- amount (Number)
- settlementAmount (Number)
- status (pending|partial|settled)
- settlementDate (Date)
```

### Updated Room Model

```
memberPayments: [
  {
    member (ref: User)
    rentStatus (pending|paid|overdue)
    rentPaidDate (Date)
    electricityStatus (pending|paid|overdue)
    electricityPaidDate (Date)
    waterStatus (pending|paid|overdue)
    waterPaidDate (Date)
  }
]
```

---

## ✅ Testing Checklist

- [ ] Can navigate to Payment History from Bills screen
- [ ] Payment History loads and displays payments
- [ ] Can navigate to Settlement screen
- [ ] Settlement tabs work (Pending, Partial, Settled)
- [ ] "Mark as Settled" button functions
- [ ] Pull-to-refresh works on both screens
- [ ] Empty states display correctly
- [ ] Navigation back button works
- [ ] Payment modal/screen transitions smoothly

---

## 🐛 Troubleshooting

### Payments not showing

- Verify `mark-bill-paid` endpoint was called
- Check room ID and member ID are valid
- Ensure billing cycle dates match

### Settlements not calculating

- Verify `calculate-settlements` endpoint returns data
- Check that members have different payer status
- Ensure billing data exists for room

### Navigation errors

- Verify screens are imported in App.js
- Check route names match: "PaymentHistory", "Settlement"
- Ensure parameters (roomId, roomName) are passed

---

## 📞 Support

For issues or questions:

1. Check the implementation document: `PHASE_1_PAYMENT_IMPLEMENTATION.md`
2. Review endpoint documentation in `backend/controller/payment.js`
3. Check mobile screen components for state management
4. Verify database models in `backend/model/`

---

**Phase 1 Complete! Ready for Phase 2: Analytics & Reporting** 🎉
