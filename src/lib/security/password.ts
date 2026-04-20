import "server-only";
import { randomInt } from "node:crypto";

export function generateStrongPassword(length = 24): string {
    const effectiveLength = Math.max(length, 12);
    const lowercase = "abcdefghijkmnpqrstuvwxyz";
    const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "!@#$%^&*()-_=+";

    const all = `${lowercase}${uppercase}${digits}${symbols}`;
    const guaranteed = [
        pickRandomChar(lowercase),
        pickRandomChar(uppercase),
        pickRandomChar(digits),
        pickRandomChar(symbols),
    ];
    const chars = [...guaranteed];

    while (chars.length < effectiveLength) {
        chars.push(pickRandomChar(all));
    }

    // Fisher-Yates shuffle so guaranteed classes are distributed randomly.
    for (let index = chars.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
    }

    return chars.join("");
}

function pickRandomChar(pool: string): string {
    return pool[randomInt(pool.length)] ?? "A";
}
