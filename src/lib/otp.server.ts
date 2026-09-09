/**
 * OtpService — one-time codes delivered by e-mail only (registration
 * confirmation and password recovery). No SMS path exists: the customer's
 * phone number is stored as profile data, never used for code delivery.
 */

import { sendMail, isMailConfigured } from "./mailer.server";
import {
  passwordResetEmail,
  registrationEmail,
  registrationResendEmail,
} from "./email-templates.server";

export type OtpPurpose = "registration" | "password_reset";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function randomCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + ((bytes[0] ?? 0) % 900000));
}

async function hashCode(target: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${target}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deliver(params: {
  email: string;
  name: string;
  code: string;
  purpose: OtpPurpose;
  resend: boolean;
}): Promise<void> {
  if (!isMailConfigured()) throw new Error("smtp_not_configured");
  const letter =
    params.purpose === "password_reset"
      ? passwordResetEmail(params.code, params.name)
      : params.resend
        ? registrationResendEmail(params.code, params.name)
        : registrationEmail(params.code, params.name);
  await sendMail({ to: params.email, ...letter });
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Issues a fresh code, invalidating previous unused ones for the same purpose. */
export async function issueOtp(
  admin: AdminClient,
  params: {
    userId: string;
    email: string;
    phone?: string | null;
    name?: string;
    purpose: OtpPurpose;
    resend?: boolean;
  },
): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const code = randomCode();
  const code_hash = await hashCode(email, code);

  await admin
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .eq("purpose", params.purpose)
    .is("consumed_at", null);

  const { error } = await admin.from("phone_verifications").insert({
    user_id: params.userId,
    email,
    phone: params.phone ?? null,
    purpose: params.purpose,
    code_hash,
    expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) throw new Error("otp_issue_failed");

  await deliver({
    email,
    name: params.name ?? "",
    code,
    purpose: params.purpose,
    resend: params.resend ?? false,
  });
}

export type OtpResult = "ok" | "invalid" | "expired" | "too_many";

export async function verifyOtp(
  admin: AdminClient,
  params: { userId: string; email: string; purpose: OtpPurpose; code: string },
): Promise<OtpResult> {
  const email = params.email.trim().toLowerCase();
  const { data: row } = await admin
    .from("phone_verifications")
    .select("id, code_hash, attempts, expires_at")
    .eq("user_id", params.userId)
    .eq("purpose", params.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return "expired";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  if (row.attempts >= MAX_ATTEMPTS) return "too_many";

  const expected = await hashCode(email, params.code.trim());
  if (expected !== row.code_hash) {
    await admin
      .from("phone_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return "invalid";
  }

  await admin
    .from("phone_verifications")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return "ok";
}
