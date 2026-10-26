// Upper bounds for free-text input. They keep pages readable and stop
// oversized payloads from reaching the database.
export const TEXT_LIMITS = {
  id: 100,
  name: 100,
  username: 50,
  phoneNumber: 20,
  address: 300,
  shopName: 100,
  bankName: 100,
  accountNumber: 40,
  note: 500,
  password: 128,
} as const;

export function maxLengthMessage(label: string, limit: number) {
  return `${label} must be ${limit} characters or fewer.`;
}
