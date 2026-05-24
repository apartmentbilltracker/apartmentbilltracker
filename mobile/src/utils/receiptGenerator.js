import { Alert } from "react-native";
import * as MediaLibrary from "expo-media-library";

/**
 * Generate and show payment receipt modal with line items
 * Call this after successful payment submission
 * @param {Object} params - Receipt data
 * @param {string} params.paymentMethod - 'cash' | 'bank_transfer' | 'gcash'
 * @param {number} params.amountPaid - Payment amount in pesos
 * @param {string} params.tenantName - Tenant/client name
 * @param {string} params.roomName - Room name
 * @param {string} params.roomAddress - Room address
 * @param {string} params.managerInfo - Manager/receiver name
 * @param {Array} params.lineItems - Array of {description, amount} for itemized receipt
 * @param {Function} params.setPaymentReceiptData - State setter for receipt data
 * @param {Function} params.setShowPaymentReceipt - State setter for modal visibility
 * @param {Function} params.convertNumberToWords - Function to convert numbers to words
 */
export const generatePaymentReceipt = (params) => {
  try {
    const {
      paymentMethod,
      amountPaid,
      tenantName,
      roomName,
      roomAddress,
      managerInfo,
      lineItems = [],
      setPaymentReceiptData,
      setShowPaymentReceipt,
      convertNumberToWords,
    } = params;

    // Generate unique receipt number
    const receiptNumber = `RCP${Date.now()}`.slice(0, 12);
    const transactionDate = new Date();

    // Payment method details
    const paymentMethodText =
      {
        cash: "CASH RECEIPT",
        bank_transfer: "BANK TRANSFER RECEIPT",
        gcash: "GCASH RECEIPT",
      }[paymentMethod] || "PAYMENT RECEIPT";

    const paymentDetails =
      {
        cash: "Payment received in cash",
        bank_transfer: "Bank transfer verified",
        gcash: "GCash transaction verified",
      }[paymentMethod] || "Payment processed";

    // Default line item if none provided
    const items =
      lineItems.length > 0
        ? lineItems
        : [
            {
              description: `${roomName} - Billing Payment`,
              amount: amountPaid,
            },
          ];

    const receipt = {
      receiptNumber,
      transactionDate: transactionDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      transactionTime: transactionDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      paymentMethod,
      paymentMethodText,
      paymentDetails,
      amountPaid,
      tenantName: tenantName || "Tenant",
      roomName: roomName || "Room",
      roomAddress: roomAddress || "Address",
      managerInfo: managerInfo || "PropFlow",
      amountWords: convertNumberToWords(amountPaid),
      lineItems: items,
      cardNumber: `XXXX XXXX XXXX ${String(Date.now()).slice(-4)}`,
      barcodeNumber: `${receiptNumber}${String(Date.now()).slice(-8)}`,
    };

    setPaymentReceiptData(receipt);
    setShowPaymentReceipt(true);

    return receipt;
  } catch (error) {
    Alert.alert("Error", "Failed to generate receipt: " + error.message);
    return null;
  }
};

/**
 * Download/save payment receipt as image
 * @param {Object} params - Download parameters
 * @param {Object} params.paymentReceiptRef - React ref to ViewShot component
 * @param {Object} params.paymentReceiptData - Receipt data object
 * @param {Function} params.setDownloadingPDF - State setter for loading state
 * @param {Function} params.setShowPaymentReceipt - State setter for modal visibility
 */
export const downloadPaymentReceiptImage = async (params) => {
  try {
    const {
      paymentReceiptRef,
      paymentReceiptData,
      setDownloadingPDF,
      setShowPaymentReceipt,
    } = params;

    if (!paymentReceiptRef?.current) {
      Alert.alert("Error", "Could not capture receipt");
      return;
    }

    setDownloadingPDF(true);

    setTimeout(async () => {
      try {
        const uri = await paymentReceiptRef.current.capture();

        // Request permissions
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          const asset = await MediaLibrary.createAssetAsync(uri);
          await MediaLibrary.createAlbumAsync("PaymentReceipts", asset, false);

          const filename = `Receipt_${paymentReceiptData?.receiptNumber}`;
          Alert.alert("Success", `Payment receipt saved as "${filename}"`);
        } else {
          Alert.alert("Permission Denied", "Cannot access photo library");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to save receipt: " + error.message);
      } finally {
        setShowPaymentReceipt(false);
        setDownloadingPDF(false);
      }
    }, 500);
  } catch (error) {
    Alert.alert("Error", "Failed to download receipt: " + error.message);
  }
};
