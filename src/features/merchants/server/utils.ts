export function calculateMerchantNetPayment(totalCodAmount: number, totalDeliveryFeeDeduction: number) {
  return totalCodAmount - totalDeliveryFeeDeduction;
}
