import type { ParcelStatus, UserRole } from "@/lib/domain";

type StatusTransition = `${ParcelStatus}->${ParcelStatus}`;

const riderAllowedTransitions = new Set<StatusTransition>([
  "at_office->on_the_way",
  "on_the_way->delivered",
]);

const officeAdminAllowedTransitions = new Set<StatusTransition>([
  "on_the_way->delivered",
  "on_the_way->postpone",
  "on_the_way->canceled_returned",
  "postpone->on_the_way",
  "postpone->canceled_returned",
  "canceled_returned->returned_to_merchant",
]);

export function canRegeneratePassword(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "super_admin") {
    return true;
  }

  return actorRole === "office_admin" && targetRole !== "super_admin";
}

export function canEditDeliveryFee(role: UserRole, parcel: { status: ParcelStatus; riderId: string | null }) {
  return role === "super_admin" && parcel.status === "at_office" && parcel.riderId === null;
}

export function canChangeParcelStatus(role: UserRole, from: ParcelStatus, to: ParcelStatus) {
  const transition = `${from}->${to}` as StatusTransition;

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

export function canMarkPaymentPaid(role: UserRole) {
  return role === "super_admin";
}
