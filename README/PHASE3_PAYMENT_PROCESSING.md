# Phase 3 - Payment Processing Implementation Guide

## Overview

Phase 3 implements direct payment processing with three payment methods: **GCash, Bank Transfer, and Cash**. This feature allows users to pay their bills through multiple channels with transaction tracking and verification.

## Architecture

### Backend Components

#### 1. **PaymentTransaction Model** (`backend/model/paymentTransaction.js`)

Tracks all payment transactions with method-specific data:

```javascript
{
  room: ObjectId,                    // Reference to room
  payer: ObjectId,                   // User paying
  amount: Number,                    // Payment amount
  billType: "rent|electricity|water|total",
  paymentMethod: "gcash|bank_transfer|cash",
  status: "pending|completed|failed|cancelled",

  // GCash specific
  gcash: {
    referenceNumber,                 // Unique payment reference
    mobileNumber,                    // GCash account number
    merchantId,                      // Merchant ID
    transactionId                    // GCash transaction ID
  },

  // Bank Transfer specific
  bankTransfer: {
    bankName,                        // BDO, BPI, Metrobank, PNB
    accountName,                     // Receiving account name
    accountNumber,                   // Receiving account number
    referenceNumber,                 // Bank reference
    depositDate,                     // Date of transfer
    depositProof                     // File path/URL of proof
  },

  // Cash specific
  cash: {
    receiptNumber,                   // Receipt/reference number
    receivedBy,                      // Name of person receiving cash
    witnessName,                     // Witness to transaction
    notes                           // Additional notes
  },

  // Common fields
  transactionDate,                  // When transaction occurred
  completionDate,                   // When verified/completed
  billingCycleStart,                // Cycle start date
  billingCycleEnd,                  // Cycle end date
  createdAt,                        // Record creation time
  updatedAt                         // Last update time
}
```

#### 2. **PaymentProcessing Controller** (`backend/controller/paymentProcessing.js`)

Handles all payment processing logic with 8 endpoints:

**GCash Endpoints:**

- `POST /api/v2/payment-processing/initiate-gcash` - Start GCash payment, generate QR
- `POST /api/v2/payment-processing/verify-gcash` - Verify payment sent

**Bank Transfer Endpoints:**

- `POST /api/v2/payment-processing/initiate-bank-transfer` - Provide bank details
- `POST /api/v2/payment-processing/confirm-bank-transfer` - Confirm with proof upload

**Cash Endpoints:**

- `POST /api/v2/payment-processing/record-cash` - Record immediate cash payment

**Query Endpoints:**

- `GET /api/v2/payment-processing/transactions/:roomId` - Get transaction history
- `GET /api/v2/payment-processing/transaction/:transactionId` - Get single transaction
- `GET /api/v2/payment-processing/analytics/:roomId` - Get spending analytics

### Frontend Components

#### 1. **PaymentMethodScreen** (`mobile/src/screens/client/PaymentMethodScreen.js`)

Entry point for payment - users select their preferred payment method:

- Displays room name and amount
- Shows 3 payment options with descriptions
- Confirmation modal before proceeding

**Features:**

- Amount pre-filled from bills screen
- Clear instructions for each method
- Smooth navigation to selected payment screen

#### 2. **GCashPaymentScreen** (`mobile/src/screens/client/GCashPaymentScreen.js`)

GCash-specific payment flow:

**Step 1: QR Code Display**

- Shows QR code for easy scanning
- Displays reference number with copy-to-clipboard function
- Shows amount to send

**Step 2: Verification**

- Input field for GCash mobile number
- Verifies payment was sent
- Transitions to success screen upon verification

**Features:**

- Auto-generates unique reference number
- QR code data provided by backend
- Copy-to-clipboard for reference number
- Clear 4-step instructions
- Success screen with transaction details

#### 3. **BankTransferPaymentScreen** (`mobile/src/screens/client/BankTransferPaymentScreen.js`)

Bank transfer payment flow with proof upload:

**Step 1: Bank Selection**

- Modal selector for banks (BDO, BPI, Metrobank, PNB)
- Displays account details for selected bank
- Copy-to-clipboard for account number and reference

**Step 2: Transfer Instructions**

- Clear numbered instructions
- Reference number to include in transfer
- Account details displayed

**Step 3: Upload Proof**

- Date field for deposit date
- Document picker for proof file (JPG, PNG, PDF)
- File preview after selection
- Support for up to 5MB files

**Features:**

- Bank selector modal
- Account details with copy functionality
- Document upload with preview
- File size validation
- Success screen with all details

#### 4. **CashPaymentScreen** (`mobile/src/screens/client/CashPaymentScreen.js`)

Immediate cash payment recording:

**Form Fields:**

- Receipt number (required)
- Received by (required)
- Witness name (required)
- Notes (optional)

**Features:**

- Immediate transaction recording
- Confirmation modal before submission
- Success screen with all captured details
- Full audit trail with witness

#### 5. **API Service Integration** (`mobile/src/services/apiService.js`)

New service methods for payment processing:

```javascript
// GCash
initiateGCash(data); // Start GCash payment
verifyGCash(data); // Verify GCash payment

// Bank Transfer
initiateBankTransfer(data); // Get bank details
confirmBankTransfer(formData); // Upload proof

// Cash
recordCash(data); // Record cash payment

// Query
getTransactions(roomId); // Get transaction history
getTransaction(transactionId); // Get single transaction
getAnalytics(roomId); // Get analytics

// Integration
getPaymentHistory(roomId); // Phase 1 compatibility
getSettlements(roomId, status); // Phase 1 compatibility
```

### Navigation Integration

#### App.js Routes

New payment screens registered as modals:

```javascript
<Stack.Group screenOptions={{ presentation: "modal" }}>
  <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} />
  <Stack.Screen name="GCashPayment" component={GCashPaymentScreen} />
  <Stack.Screen
    name="BankTransferPayment"
    component={BankTransferPaymentScreen}
  />
  <Stack.Screen name="CashPayment" component={CashPaymentScreen} />
</Stack.Group>
```

#### BillsScreen Integration

"Pay Now" button added to Your Share section:

```javascript
<TouchableOpacity
  style={styles.payNowButton}
  onPress={() => {
    navigation.navigate("PaymentMethod", {
      roomId: selectedRoom._id,
      roomName: selectedRoom.name,
      amount: billShare.total,
      billType: "total",
    });
  }}
>
  <Text>Pay Now</Text>
</TouchableOpacity>
```

## Payment Flow Diagrams

### GCash Flow

```
BillsScreen
    ↓
[Pay Now] → PaymentMethodScreen
              ↓ [Select GCash]
              → GCashPaymentScreen (Step 1: QR)
                ↓
                Input mobile number
                ↓
                [Verify Payment] → Backend verification
                ↓ Success
                Success Screen → Back to Bills
```

### Bank Transfer Flow

```
BillsScreen
    ↓
[Pay Now] → PaymentMethodScreen
              ↓ [Select Bank Transfer]
              → BankTransferPaymentScreen (Step 1: Bank Details)
                ↓
                [Proceed to Upload]
                ↓ (Step 2: Upload Proof)
                Input deposit date
                ↓
                [Select File] → Document picker
                ↓
                [Confirm Transfer] → Backend upload
                ↓ Success
                Success Screen → Back to Bills
```

### Cash Flow

```
BillsScreen
    ↓
[Pay Now] → PaymentMethodScreen
              ↓ [Select Cash]
              → CashPaymentScreen (Form)
                ↓
                Fill receipt number
                Fill received by
                Fill witness name
                Optional notes
                ↓
                [Record Payment] → Confirmation modal
                ↓ Confirmed
                [Record] → Backend recording
                ↓ Success
                Success Screen → Back to Bills
```

## API Endpoint Specifications

### GCash Endpoints

**Initiate GCash Payment**

```
POST /api/v2/payment-processing/initiate-gcash

Request:
{
  roomId,
  amount,
  billType
}

Response:
{
  success: true,
  transaction: {
    _id,
    referenceNumber,
    amount,
    status: "pending"
  },
  qrData: "base64-encoded-png",
  instructions: "Send ₱X with reference"
}
```

**Verify GCash Payment**

```
POST /api/v2/payment-processing/verify-gcash

Request:
{
  transactionId,
  mobileNumber
}

Response:
{
  success: true,
  transaction: {
    _id,
    status: "completed",
    referenceNumber,
    amount
  },
  message: "Payment verified successfully"
}
```

### Bank Transfer Endpoints

**Initiate Bank Transfer**

```
POST /api/v2/payment-processing/initiate-bank-transfer

Request:
{
  roomId,
  amount,
  billType,
  bankName
}

Response:
{
  success: true,
  transaction: { ... },
  bankDetails: {
    bankName,
    accountName,
    accountNumber
  }
}
```

**Confirm Bank Transfer**

```
POST /api/v2/payment-processing/confirm-bank-transfer

Request (FormData):
{
  transactionId,
  depositDate,
  referenceNumber,
  proof: file
}

Response:
{
  success: true,
  transaction: {
    _id,
    status: "completed",
    depositDate,
    depositProof: "file-path"
  }
}
```

### Cash Endpoint

**Record Cash Payment**

```
POST /api/v2/payment-processing/record-cash

Request:
{
  roomId,
  amount,
  billType,
  receiptNumber,
  receivedBy,
  witnessName,
  notes
}

Response:
{
  success: true,
  transaction: {
    _id,
    status: "completed",
    receiptNumber,
    receivedBy,
    witnessName
  }
}
```

### Query Endpoints

**Get Transaction History**

```
GET /api/v2/payment-processing/transactions/:roomId

Response:
{
  success: true,
  transactions: [
    {
      _id,
      payer: { name, email },
      amount,
      paymentMethod,
      status,
      transactionDate,
      billType
    }
  ]
}
```

**Get Analytics**

```
GET /api/v2/payment-processing/analytics/:roomId

Response:
{
  success: true,
  analytics: {
    totalTransactions: 10,
    totalAmount: 45000,
    byMethod: {
      gcash: { count: 5, amount: 20000 },
      bank_transfer: { count: 3, amount: 15000 },
      cash: { count: 2, amount: 10000 }
    },
    byBillType: {
      rent: 30000,
      electricity: 10000,
      water: 5000
    },
    byStatus: {
      completed: 9,
      pending: 1
    }
  }
}
```

## User Experience Flow

### For GCash Users

1. Opens Bills tab, views their share
2. Taps "Pay Now" button
3. Selects GCash from payment methods
4. Confirms payment details
5. Sees QR code and reference number
6. Scans QR code in GCash app
7. Sends payment
8. Returns to app, enters mobile number
9. Clicks "Verify Payment"
10. Sees success screen
11. Navigates back to Bills or views Payment History

### For Bank Transfer Users

1. Opens Bills tab, views their share
2. Taps "Pay Now" button
3. Selects Bank Transfer from payment methods
4. Confirms payment details
5. Sees bank details (account number, name)
6. Copies account number to clipboard
7. Goes to banking app
8. Sends transfer with reference number
9. Returns to app
10. Enters deposit date
11. Selects proof document
12. Taps "Confirm Transfer"
13. Sees success screen
14. Navigates back

### For Cash Users

1. Opens Bills tab, views their share
2. Taps "Pay Now" button
3. Selects Cash from payment methods
4. Confirms payment details
5. Meets with bill collector/manager
6. Pays cash in person
7. Gets receipt number
8. Returns to app
9. Fills in receipt number, receiver name, witness name
10. Optionally adds notes
11. Taps "Record Payment"
12. Confirms in modal
13. Sees success screen with full details

## Data Storage and Reconciliation

### Transaction Recording

- All transactions stored in PaymentTransaction model
- Immediate recording for cash
- Pending state for GCash/Bank until verified
- Completion date recorded upon verification

### Settlement Impact

- Payment confirms bill payment in Settlement model
- Automatically updates member payment status
- Reduces debts in debt tracking
- Available for analytics and reporting

### Audit Trail

- Complete transaction history maintained
- Who paid, when, and how
- Proof files stored for bank transfers
- Witness signatures for cash

## Security Considerations

1. **Authentication**: All endpoints require isAuthenticated middleware
2. **Authorization**: Users can only pay from their room
3. **Data Validation**: All inputs validated server-side
4. **File Upload**: Virus scanning, file type verification, size limits
5. **Reference Numbers**: Unique, non-sequential for privacy
6. **Sensitive Data**: Account numbers, mobile numbers encrypted

## Testing Checklist

### GCash

- [ ] QR code generation and display
- [ ] Reference number generation
- [ ] Payment verification logic
- [ ] Mobile number validation
- [ ] Success/failure handling

### Bank Transfer

- [ ] Bank selector modal works
- [ ] Account details display correctly
- [ ] Document picker functionality
- [ ] File upload handling
- [ ] Deposit date validation
- [ ] Success/failure handling

### Cash

- [ ] Form validation
- [ ] Confirmation modal displays correctly
- [ ] Immediate recording
- [ ] Receipt number formatting
- [ ] Witness tracking

### Integration

- [ ] "Pay Now" button appears on BillsScreen
- [ ] Amount pre-fills correctly
- [ ] Navigation works smoothly
- [ ] Back buttons work
- [ ] Success screens navigate properly
- [ ] Payment history updates

## Future Enhancements

1. **Phase 2 - Analytics**
   - Payment breakdown charts
   - Monthly trends
   - PDF/CSV export reports
   - Spending analytics

2. **Notifications**
   - Payment reminders
   - Overdue notifications
   - Payment confirmation alerts
   - Admin notifications for cash collection

3. **Advanced Features**
   - Recurring payments
   - Payment plans
   - Partial payments
   - Payment disputes/cancellations
   - Refund processing

4. **Integration**
   - GCash API integration for auto-verification
   - Bank API integration
   - Email receipts
   - SMS notifications

## Troubleshooting

### GCash Issues

- **QR code not displaying**: Check image generation in backend
- **Verification fails**: Verify mobile number format
- **Reference number invalid**: Check uniqueness generation

### Bank Transfer Issues

- **File upload fails**: Check file size and format
- **Account details incorrect**: Verify bank configuration
- **Deposit date validation**: Check date format

### Cash Issues

- **Receipt number required**: Validate form before submit
- **Witness tracking failing**: Check input validation

### General Issues

- **Navigation errors**: Check route names in App.js
- **API errors**: Check network connectivity and backend status
- **Data not updating**: Check Redux state or context updates

## Support & Documentation

- Backend API docs: See backend/controller/paymentProcessing.js
- Frontend component docs: See individual screen files
- Testing guide: See TESTING_GUIDE.md
- Admin guide: See MOBILE_ADMIN_DEVELOPER_GUIDE.md
