/**
 * Phone helpers — the phone number is the primary customer identifier.
 * Client-safe (no server imports): used by forms and by server services alike.
 */

/** Normalises any Ukrainian input to the canonical `+380XXXXXXXXX` form, or null. */
export function normalizePhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D+/g, "");
  let local = digits;
  if (local.startsWith("380")) local = local.slice(3);
  else if (local.startsWith("80")) local = local.slice(2);
  else if (local.startsWith("0")) local = local.slice(1);
  if (!/^\d{9}$/.test(local)) return null;
  return `+380${local}`;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** Pretty display: +380 50 235 33 00 */
export function formatPhone(phone: string): string {
  const n = normalizePhone(phone);
  if (!n) return phone;
  const d = n.slice(4);
  return `+380 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/**
 * Supabase Auth requires an email credential, but customers sign in by phone.
 * A deterministic synthetic address keeps the phone as the only identifier.
 */
export function phoneToAuthEmail(phone: string): string {
  const n = normalizePhone(phone);
  if (!n) throw new Error("invalid_phone");
  return `${n.slice(1)}@phone.technoforma.local`;
}

export type PasswordCheck = { ok: boolean; reason?: "short" | "weak" };

/** Minimum strength: 8+ chars with at least one letter and one digit. */
export function checkPassword(password: string): PasswordCheck {
  if (password.length < 8) return { ok: false, reason: "short" };
  if (!/[A-Za-zА-Яа-яІіЇїЄє]/.test(password) || !/\d/.test(password))
    return { ok: false, reason: "weak" };
  return { ok: true };
}
