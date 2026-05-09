export function buildRiderPayoutCode(date = new Date(), sequence = 1) {
  const stamp = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `RP-${stamp}-${sequence.toString().padStart(3, "0")}`;
}
