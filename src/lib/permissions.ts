import type { CreatableUserRole, ParcelStatus, UserRole } from "@/lib/domain";

type StatusTransition = `${ParcelStatus}->${ParcelStatus}`;

const riderAllowedTransitions = new Set<StatusTransition>([
  "at_office->on_the_way",
  "canceled_returned->returned_to_merchant",
  "on_the_way->delivered",
]);

const officeAdminAllowedTransitions = new Set<StatusTransition>([
  "on_the_way->delivered",
  "on_the_way->postpone",
  "on_the_way->canceled_returned",
  "postpone->at_office",
  "postpone->canceled_returned",
  "canceled_returned->returned_to_merchant",
]);

function canOfficeAdminManageNonSuperAdmin(targetRole: UserRole) {
  return targetRole !== "super_admin";
}

export function canManageUser(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "super_admin") {
    return true;
  }

  return actorRole === "office_admin" && canOfficeAdminManageNonSuperAdmin(targetRole);
}

export function canRegeneratePassword(actorRole: UserRole, targetRole: UserRole) {
  return canManageUser(actorRole, targetRole);
}

export function canCreateUser(actorRole: UserRole, targetRole: CreatableUserRole) {
  if (actorRole === "super_admin") {
    return true;
  }

  if (actorRole === "office_admin") {
    return targetRole === "merchant" || targetRole === "rider";
  }

  return false;
}

export function canCreateParcel(role: UserRole) {
  return role === "super_admin" || role === "office_admin";
}

export function canManageMerchantProfiles(role: UserRole) {
  return role === "super_admin";
}

export function canManageRiderProfiles(role: UserRole) {
  return role === "super_admin";
}

export function canCreateMerchantSettlement(role: UserRole) {
  return role === "super_admin" || role === "office_admin";
}

export function canConfirmRiderCashHandover(role: UserRole) {
  return role === "super_admin" || role === "office_admin";
}

export function canCreateRiderPayoutDraft(role: UserRole) {
  return role === "super_admin" || role === "office_admin";
}

export function canCancelRiderPayoutDraft(role: UserRole) {
  return role === "super_admin" || role === "office_admin";
}

export function canSettleRiderPayout(role: UserRole) {
  return role === "super_admin";
}

export function canEditDeliveryFee(
  role: UserRole,
  parcel: { status: ParcelStatus; riderId: string | null },
) {
  return role === "super_admin" && parcel.status === "at_office" && parcel.riderId === null;
}

export function canManageTownshipPricing(role: UserRole) {
  return role === "super_admin";
}

export function canChangeParcelStatus(role: UserRole, from: ParcelStatus, to: ParcelStatus) {
  const transition: StatusTransition = `${from}->${to}`;

  if (role === "super_admin") {
    return true;
  }

  if (role === "rider") {
    return riderAllowedTransitions.has(transition);
  }

  if (role === "office_admin") {
    return officeAdminAllowedTransitions.has(transition);
  }

  return false;
}

export function canResolveMerchantSettlement(role: UserRole) {
  return role === "super_admin";
}
