# Payment Processing Testing Checklist

## Quick Test Flow (5-10 minutes)

### 1. GCash Payment Flow

- [ ] Navigate to BillsScreen
- [ ] Click any bill → PaymentMethodScreen shows
- [ ] Select **GCash** option
- [ ] Verify:
  - [ ] Custom GCash icon displays
  - [ ] QR code image shows (gcash-qr.png)
  - [ ] No duplicate headers
  - [ ] Reference number displays below QR
- [ ] Enter mobile number verification
- [ ] Confirm payment
- [ ] Verify success screen shows

### 2. Bank Transfer Payment Flow

- [ ] Navigate back to BillsScreen
- [ ] Click different bill → PaymentMethodScreen shows
- [ ] Select **Bank Transfer** option
- [ ] Verify:
  - [ ] BPI only shows (no BDO/Metrobank/PNB)
  - [ ] No duplicate headers
- [ ] Select BPI bank
- [ ] Verify:
  - [ ] BPI QR code displays
  - [ ] No deposit date field required
- [ ] Click "Confirm Payment"
- [ ] Verify success screen shows

### 3. Cash Payment Flow

- [ ] Navigate back to BillsScreen
- [ ] Click another bill → PaymentMethodScreen shows
- [ ] Select **Cash** option
- [ ] Verify:
  - [ ] Form displays (receipt #, receiver name, witness name)
  - [ ] No duplicate headers
- [ ] Fill in form details
- [ ] Submit payment
- [ ] Verify success screen shows

### 4. Bill Amounts Clear on Return

- [ ] From any payment success screen, click **View Payment History**
- [ ] Verify payment displays in history with:
  - [ ] Correct bill type and amount
  - [ ] Correct payment method
  - [ ] Payment date shows
  - [ ] Reference/receipt number displays
- [ ] Click **Back to Bills**
- [ ] Verify:
  - [ ] Amount is still there (payment is recorded separately)
  - [ ] OR if amount should clear (check business logic)

### 5. Payment History Display

- [ ] View PaymentHistoryScreen for a room with multiple payments
- [ ] Verify each payment card shows:
  - [ ] Bill type with colored icon
  - [ ] Amount in ₱ format
  - [ ] Payment method (GCash, Bank Transfer, or Cash)
  - [ ] Transaction date formatted correctly
  - [ ] Reference/receipt number based on method:
    - GCash: Reference number from `gcash.referenceNumber`
    - Bank: Reference + Bank name
    - Cash: Receipt number from `cash.receiptNumber`
  - [ ] Status (Pending/Verified/Completed)

## Expected Issues to Monitor

⚠️ **If payment history is still empty:**

- Check backend logs for getTransactions endpoint errors
- Verify PaymentTransaction records are being created in MongoDB
- Confirm roomId is being passed correctly from payment screens

⚠️ **If reference numbers don't show:**

- Verify they were stored in the nested objects during payment creation
- Check GCashPaymentScreen stores transactionId correctly
- Verify BankTransferPaymentScreen generates reference number

⚠️ **If duplicate headers appear:**

- Ensure ClientNavigator.js has `headerShown: false` for all payment screens
- Check that payment screens don't have custom header JSX components

## Data to Verify

### Sample GCash Transaction:

```json
{
  "_id": "...",
  "roomId": "...",
  "amount": 500,
  "billType": "electricity",
  "paymentMethod": "gcash",
  "status": "verified",
  "gcash": {
    "referenceNumber": "GCASH-1769916965278-O6DHSNQ6L",
    "mobileNumber": "09123456789"
  },
  "transactionDate": "2024-02-01T10:30:00Z"
}
```

### Sample Bank Transaction:

```json
{
  "_id": "...",
  "roomId": "...",
  "amount": 2000,
  "billType": "rent",
  "paymentMethod": "bank_transfer",
  "status": "pending",
  "bankTransfer": {
    "bankName": "BPI",
    "referenceNumber": "BPI-2024020110",
    "accountNumber": "xxxxxxxxxxxx"
  },
  "transactionDate": "2024-02-01T10:30:00Z"
}
```

### Sample Cash Transaction:

```json
{
  "_id": "...",
  "roomId": "...",
  "amount": 300,
  "billType": "water",
  "paymentMethod": "cash",
  "status": "completed",
  "cash": {
    "receiptNumber": "CASH-001",
    "receiverName": "John Doe",
    "witnessName": "Jane Smith"
  },
  "transactionDate": "2024-02-01T10:30:00Z"
}
```

## Notes

- All amounts should display in ₱ format with 2 decimal places
- Dates should be human-readable (e.g., "Feb 1, 2024 10:30 AM")
- Payment method names should be title-cased (GCash, Bank Transfer, Cash)
- Status should show capitalized (Pending, Verified, Completed)
