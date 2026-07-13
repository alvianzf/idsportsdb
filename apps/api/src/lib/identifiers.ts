/**
 * Canonical form of an athlete identifier (nomor induk / nomor registrasi).
 *
 * Identifiers are stored canonicalized so that formatting variants can never
 * coexist: the column's `@unique` constraint then rejects any pair that differs
 * only by whitespace or case. e.g. " reg 001 ", "REG001", and "reg 001" all
 * canonicalize to "REG001".
 */
export function canonicalIdentifier(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}
