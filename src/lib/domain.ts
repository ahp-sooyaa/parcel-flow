export const userRoles = ["super_admin", "office_admin", "merchant", "rider"] as const;
export type UserRole = (typeof userRoles)[number];

export const adminRoles = ["super_admin", "office_admin"] as const;

export const parcelStatuses = [
  "at_office",
  "on_the_way",
  "delivered",
  "postpone",
  "canceled_returned",
  "returned_to_merchant",
] as const;
export type ParcelStatus = (typeof parcelStatuses)[number];

export const codStatuses = ["pending", "not_applicable", "collected", "not_collected"] as const;
export const deliveryFeeStatuses = [
  "pending",
  "collected",
  "not_collected",
  "deduct_from_merchant",
  "waived",
] as const;
export const settlementStatuses = ["pending", "in_progress", "settled"] as const;
export const financialItemTypes = ["cod_remit", "delivery_fee_deduction", "rider_way_payout"] as const;
export const financialItemStatuses = ["pending", "in_progress", "settled", "void"] as const;
export const parcelTypes = ["cod", "non_cod"] as const;

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  office_admin: "Office Admin",
  merchant: "Merchant",
  rider: "Rider",
};

export const parcelStatusLabels: Record<ParcelStatus, string> = {
  at_office: "At Office",
  on_the_way: "On The Way",
  delivered: "Delivered",
  postpone: "Postpone",
  canceled_returned: "Canceled / Returned",
  returned_to_merchant: "Returned to Merchant",
};

export function isAdminRole(role: UserRole) {
  return role === "super_admin" || role === "office_admin";
}
