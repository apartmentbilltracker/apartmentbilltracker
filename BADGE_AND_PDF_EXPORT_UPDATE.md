# Badge & PDF Export Update

## Changes Summary

### 1. Non-Payor Badge Added to All Screens

#### RoomDetailsScreen.js

- Added non-payor badge (gray styling) to member list
- Badge displays "Non-Payor" for non-payor members alongside "Payor" badge for payors
- Added matching styles:
  - `nonPayorBadge`: Gray background (#e0e0e0), padding 8px horizontal/4px vertical
  - `nonPayorBadgeText`: Font size 11, color #666, font weight 600

#### BillsScreen.js

- Updated member badge logic to show "Non-Payor" instead of generic "Member"
- Added `nonPayorBadge` style to match RoomDetailsScreen
- Badge styling consistency across app:
  - Payor: Green (#d4edda background, #28a745 text)
  - Non-Payor: Gray (#e0e0e0 background, #666 text)

### 2. PDF Export Functionality

#### Dependencies Added

- `expo-print`: ^12.3.2 - For PDF generation
- `expo-sharing`: ^12.3.2 - For sharing/saving generated PDFs

#### BillsScreen.js Enhancements

**New Function: `generatePDF()`**

- Generates comprehensive billing report as HTML/PDF
- Includes:
  - Room name and billing details header
  - Billing period (start and end dates)
  - Total bills breakdown (Rent, Electricity, Water)
  - Members table showing:
    - Member name
    - Presence days
    - Individual water bill calculation
    - Payor/Non-Payor status badge
  - User's share details (if user is payor):
    - Rent share
    - Electricity share
    - Water share
    - Total amount due
    - Number of payors for reference
  - Generation timestamp

**UI Changes:**

- Added export button to header (file-download icon)
- Button appears when a room is selected
- Button style: Yellow/Gold (#bdb246) background with white icon
- Header layout updated to flex row with header content and export button

**PDF Styling:**

- Professional styling with borders, colors, and formatting
- Table for members list with alternating row colors
- Member status badges with colors matching app theme
- Amounts displayed in peso currency (₱)
- All values properly formatted with 2 decimal places

#### User Experience

- Tap download icon to generate and share/save PDF
- Alert if billing data not available
- Error handling with user notifications
- Generated PDF filename includes timestamp for easy identification

### 3. File Structure

```
BillsScreen.js
├── Imports: expo-print, expo-sharing added
├── generatePDF() function
│   ├── HTML template generation
│   ├── Billing data compilation
│   ├── Member presence calculations
│   ├── Per-payor share calculations
│   └── PDF export via Print.printToFileAsync
├── Header with export button
├── Member list with non-payor badges
└── Styles for exportButton

RoomDetailsScreen.js
├── Non-payor badges in member list
└── Styles for nonPayorBadge and nonPayorBadgeText

package.json
└── Dependencies: expo-print, expo-sharing added
```

## How to Use PDF Export

1. Navigate to BillsScreen
2. Select a room from the room selector
3. Tap the download icon (📥) in the top-right of the header
4. PDF will be generated and open share dialog
5. Choose to save to files, email, or other sharing options

## PDF Content Includes

✅ Complete billing breakdown
✅ Individual member water bills
✅ Payor status indicators
✅ Personal share calculations (for payors)
✅ Presence day counts
✅ Billing period information
✅ Professional formatting
✅ Timestamp of generation

## Technical Implementation

**HTML to PDF Conversion:**

- Uses expo-print's `printToFileAsync()` for HTML to PDF conversion
- expo-sharing handles platform-specific sharing/saving functionality
- Works on both iOS and Android

**Data Accuracy:**

- Uses same calculations as on-screen display
- Includes all water bill computations
- Respects payor/non-payor billing divisions
- Two-decimal rounding for all currency values

## Testing Recommendations

1. Export PDF with multiple payors and non-payors
2. Verify badge styling matches throughout app
3. Test PDF generation with various data scenarios
4. Confirm PDF opens/shares correctly on device
5. Verify calculations in PDF match screen display

## Future Enhancements

- Add email-ready PDF format
- Add date range filtering for reports
- Add signature field for billing admin
- Add notes/comments section to PDF
- Add bill payment status tracking
