export function generateTemporaryPassword() {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const bytes = getRandomBytes(10);

  return [
    uppercase[bytes[0] % uppercase.length],
    uppercase[bytes[1] % uppercase.length],
    lowercase[bytes[2] % lowercase.length],
    lowercase[bytes[3] % lowercase.length],
    lowercase[bytes[4] % lowercase.length],
    digits[bytes[5] % digits.length],
    digits[bytes[6] % digits.length],
    digits[bytes[7] % digits.length],
    digits[bytes[8] % digits.length],
    lowercase[bytes[9] % lowercase.length],
  ].join("");
}

function getRandomBytes(length: number) {
  const bytes = new Uint8Array(length);

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}
