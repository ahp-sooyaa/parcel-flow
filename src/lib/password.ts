export function generateTemporaryPassword(length = 12) {
  const effectiveLength = Math.max(length, 12);
  const lowercase = "abcdefghijkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+";
  const allCharacters = `${lowercase}${uppercase}${digits}${symbols}`;

  const characters = [
    pickRandomCharacter(lowercase),
    pickRandomCharacter(uppercase),
    pickRandomCharacter(digits),
    pickRandomCharacter(symbols),
  ];

  while (characters.length < effectiveLength) {
    characters.push(pickRandomCharacter(allCharacters));
  }

  // Shuffle so required character classes are not fixed in predictable positions.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

function pickRandomCharacter(pool: string) {
  return pool[getRandomIndex(pool.length)] ?? "A";
}

function getRandomIndex(max: number) {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Secure password generation requires Web Crypto support.");
  }

  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];

  return randomValue % max;
}
