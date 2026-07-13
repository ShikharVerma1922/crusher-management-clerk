import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

/**
 * Validates form steps based on the current step index.
 * Returns { valid: true } or { valid: false, title: string, message: string }
 */
export const validateFormStep = ({
  currentStep,
  customerName,
  vehicleNumber,
  selectedMaterial,
  materialQuantity,
  isRateSettled,
  materialRate,
  hasRoyalty,
  royaltyQuantity,
  royaltyRate,
  paymentMode,
  amountPaid,
}) => {
  if (currentStep === 0) {
    if (!customerName?.trim())
      return {
        valid: false,
        title: "Missing Field",
        message: "Enter Customer Name.",
      };
    if (!vehicleNumber?.trim())
      return {
        valid: false,
        title: "Missing Field",
        message: "Enter Vehicle Number.",
      };
  }

  if (currentStep === 1) {
    if (!selectedMaterial)
      return {
        valid: false,
        title: "Missing Field",
        message: "Select a material type.",
      };
  }

  if (currentStep === 2) {
    if (Number(materialQuantity) <= 0)
      return {
        valid: false,
        title: "Invalid Input",
        message: "Enter material quantity.",
      };
  }

  // Step 3 is just the IsRateSettled toggle screen (always valid)

  if (currentStep === 4 && isRateSettled) {
    if (Number(materialRate) <= 0)
      return {
        valid: false,
        title: "Invalid Input",
        message: "Enter material rate per ft³.",
      };
  }

  // Step 5 is just the IncludeRoyalty toggle screen (always valid)

  if (currentStep === 6 && isRateSettled && hasRoyalty) {
    if (Number(royaltyQuantity) <= 0)
      return {
        valid: false,
        title: "Invalid Input",
        message: "Enter royalty quantity.",
      };
  }

  if (currentStep === 7 && isRateSettled && hasRoyalty) {
    if (Number(royaltyRate) <= 0)
      return {
        valid: false,
        title: "Invalid Input",
        message: "Enter royalty rate per m³.",
      };
  }

  if (currentStep === 9) {
    if (paymentMode === "CASH") {
      if (!isRateSettled)
        return {
          valid: false,
          title: "Action Blocked",
          message: "CASH tickets cannot have open rates.",
        };
      if (Number(amountPaid) <= 0)
        return {
          valid: false,
          title: "Invalid Input",
          message: "Enter cash received.",
        };
    }
  }

  return { valid: true };
};

/**
 * Builds the comprehensive transactional record payload for offline/local logging.
 * Handles client-side UUID allocations for missing customer IDs automatically.
 */
// export const compileFinalTicketRecord = ({
//   shiftId,
//   clerkId,
//   vehicleNumber,
//   customerId,
//   customerName,
//   selectedMaterial,
//   materialsList,
//   site,
//   materialQuantity,
//   materialRate,
//   royaltyQuantity,
//   royaltyRate,
//   amountPaid,
//   paymentMode,
//   isRateSettled,
//   hasRoyalty,
// }) => {
//   const selectedMaterialObject = Array.isArray(materialsList)
//     ? materialsList.find(
//         (m) => m.id === selectedMaterial || m.name === selectedMaterial,
//       )
//     : null;

//   // 1. Resolve localized customer identities
//   let targetCustomerId = customerId;
//   let offlineCustomerPayload = null;

//   if (!targetCustomerId) {
//     targetCustomerId = uuidv4(); // Safe client-generated UUID
//     offlineCustomerPayload = {
//       id: targetCustomerId,
//       name: customerName.trim(),
//       companyName: customerName.trim(),
//     };
//   }

//   // 2. Format localized pricing properties
//   const finalMatQty = Number(materialQuantity) || 0;
//   const finalMatRate = isRateSettled ? Number(materialRate) || 0 : 0;
//   const finalMatAmount = finalMatQty * finalMatRate;

//   const finalRoyQty =
//     isRateSettled && hasRoyalty ? Number(royaltyQuantity) || 0 : 0;
//   const finalRoyRate =
//     isRateSettled && hasRoyalty ? Number(royaltyRate) || 0 : 0;
//   const finalRoyAmount = finalRoyQty * finalRoyRate;

//   const finalGrandTotal = finalMatAmount + finalRoyAmount;
//   const finalAmountPaid = paymentMode === "CASH" ? Number(amountPaid) || 0 : 0;
//   const finalBalance = finalGrandTotal - finalAmountPaid;

//   return {
//     id: uuidv4(), // Transaction Entry Record UUID
//     shiftId,
//     clerkId,
//     vehicleNumber: vehicleNumber.trim().toUpperCase(),
//     customerId: targetCustomerId,
//     customerName: customerName.trim(),
//     materialId: selectedMaterialObject?.id || selectedMaterial,
//     materialName: selectedMaterialObject?.name || selectedMaterial,
//     site: site ? site.trim() : "",

//     materialQuantity: finalMatQty,
//     materialRate: finalMatRate,
//     materialAmount: finalMatAmount,

//     royaltyQuantity: finalRoyQty,
//     royaltyRate: finalRoyRate,
//     royaltyAmount: finalRoyAmount,

//     grandTotal: finalGrandTotal,
//     paymentMode,
//     amountPaid: finalAmountPaid,
//     balance: finalBalance,

//     rateStatus: isRateSettled ? "SETTLED" : "OPEN",
//     createdAt: new Date().toISOString(),
//     isSynced: false,
//     newOfflineCustomer: offlineCustomerPayload,
//   };
// };

/**
 * Handles keyboard input filtering mechanics for Vehicle Strings.
 */
export const formatVehicleNumber = (text) => {
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let formatted = "";

  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (index < 2) {
      if (/^[A-Z]$/.test(char)) formatted += char;
    } else if (index < 4) {
      if (/^[0-9]$/.test(char)) formatted += char;
    } else if (index < 6) {
      if (/^[A-Z]$/.test(char)) formatted += char;
    } else if (/^[0-9]$/.test(char)) {
      formatted += char;
    }
  }
  return formatted.slice(0, 10);
};

/**
 * Determines device keyboard optimization variants depending on vehicle length.
 */
export const getVehicleKeyboardType = (value) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const length = cleaned.length;

  if (length < 2) return "default";
  if (length < 4) return "number-pad";
  if (length < 6) return "default";
  return "number-pad";
};
