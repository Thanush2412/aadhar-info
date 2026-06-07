// Verhoeff algorithm tables
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Validates a number using the Verhoeff algorithm
 */
export function validateVerhoeff(numStr: string): boolean {
  const cleanStr = numStr.replace(/\s+/g, '');
  if (!/^\d+$/.test(cleanStr)) {
    return false;
  }

  let c = 0;
  const digits = cleanStr.split('').map(Number);
  digits.reverse();

  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[i % 8][digits[i]]];
  }

  return c === 0;
}

/**
 * Validates if the string is a valid Aadhaar number (exactly 12 digits + Verhoeff validation)
 */
export function isValidAadhaar(aadhaar: string): boolean {
  const clean = aadhaar.replace(/\s+/g, '');
  if (clean.length !== 12) {
    return false;
  }
  // Aadhaar numbers should not start with 0 or 1
  if (clean.startsWith('0') || clean.startsWith('1')) {
    return false;
  }
  return validateVerhoeff(clean);
}

/**
 * Generates a valid checksum digit for a given 11-digit base number to make it a valid Aadhaar number.
 * Useful for mocking/generating valid numbers.
 */
export function generateVerhoeffChecksum(baseNumStr: string): string {
  let c = 0;
  const digits = baseNumStr.replace(/\s+/g, '').split('').map(Number);
  digits.reverse();

  for (let i = 0; i < digits.length; i++) {
    c = d[c][p[(i + 1) % 8][digits[i]]];
  }

  return String(inv[c]);
}

/**
 * Generates a mock valid Aadhaar number
 */
export function generateMockAadhaar(): string {
  // Aadhaar starts with 2-9
  let base = String(Math.floor(Math.random() * 8) + 2);
  for (let i = 0; i < 10; i++) {
    base += String(Math.floor(Math.random() * 10));
  }
  const checksum = generateVerhoeffChecksum(base);
  return base + checksum;
}
