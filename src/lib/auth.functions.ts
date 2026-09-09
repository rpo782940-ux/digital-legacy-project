import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkPassword, normalizePhone } from "./phone";

/**
 * AuthService (server side): registration, e-mail confirmation and
 * OTP-based password recovery.
 *
 * The customer's real e-mail is the login identifier and is stored as-is.
 * The phone number is stored as profile data only — it is never turned into
 * a synthetic e-mail and never used to deliver codes (no SMS path exists).
 * info@technoforma.com.ua is only the SMTP sender, never a customer address.
 */

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(255)
  .email({ message: "invalid_email" });

const phoneField = z
  .string()
  .trim()
  .max(30)
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, { message: "invalid_phone" });

const passwordField = z
  .string()
  .min(8)
  .max(72)
  .refine((v) => checkPassword(v).ok, { message: "weak_password" });

const nameField = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[\p{L}\p{N}'._\- ]+$/u, { message: "invalid_name" });

/** First and last name are NOT unique — only e-mail and phone are. */
const registerSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: emailField,
  phone: phoneField,
  password: passwordField,
});

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  phone: string | null;
  email_verified: boolean;
};

const PROFILE_COLUMNS = "id, email, first_name, phone, email_verified";

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueOtp } = await import("./otp.server");

    // 1. Uniqueness is checked per field so the user gets the exact reason.
    const { data: byEmail } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .ilike("email", data.email)
      .maybeSingle<ProfileRow>();

    if (byEmail?.email_verified) return { ok: false as const, error: "email_taken" };

    const { data: byPhone } = await supabaseAdmin
      .from("profiles")
      .select("id, email_verified")
      .eq("phone", data.phone)
      .maybeSingle<{ id: string; email_verified: boolean }>();
    if (byPhone && byPhone.id !== byEmail?.id) {
      // A confirmed account already owns this number; an abandoned unconfirmed
      // registration is released so the number can be reused.
      if (byPhone.email_verified) return { ok: false as const, error: "phone_taken" };
      await supabaseAdmin.auth.admin.deleteUser(byPhone.id);
    }

    let userId = byEmail?.id ?? null;

    if (!userId) {
      // 2. Pending registration: the auth user exists but stays unconfirmed,
      //    so sign-in is impossible until the e-mail code is verified.
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: false,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
        },
      });
      if (error || !created.user) {
        console.error("[registerAccount] createUser failed", error);
        const taken = /already|registered|exists/i.test(error?.message ?? "");
        return { ok: false as const, error: taken ? ("email_taken" as const) : ("failed" as const) };
      }
      userId = created.user.id;

      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
        id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        nickname: null,
        email: data.email,
        phone: data.phone,
      });
      if (profileError) {
        console.error("[registerAccount] profile insert failed", profileError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        if (/phone/i.test(profileError.message)) {
          return { ok: false as const, error: "phone_taken" as const };
        }
        if (/email/i.test(profileError.message)) {
          return { ok: false as const, error: "email_taken" as const };
        }
        return { ok: false as const, error: "failed" as const };
      }
    } else {
      // Unfinished registration for the same e-mail — refresh it.
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        user_metadata: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
        },
      });
      await supabaseAdmin
        .from("profiles")
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
        })
        .eq("id", userId);
    }

    // 3. The 6-digit code goes to the address the customer typed.
    try {
      await issueOtp(supabaseAdmin, {
        userId,
        email: data.email,
        phone: data.phone,
        name: data.firstName,
        purpose: "registration",
      });
    } catch (error) {
      console.error("[registerAccount] otp delivery failed", error);
      return { ok: false as const, error: "mail_failed" as const };
    }

    return { ok: true as const };
  });

const otpSchema = z.object({ email: emailField, code: z.string().trim().min(4).max(8) });

async function findByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .ilike("email", email)
    .maybeSingle<ProfileRow>();
  return { supabaseAdmin, profile: data ?? null };
}

export const confirmRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => otpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin, profile } = await findByEmail(data.email);
    const { verifyOtp } = await import("./otp.server");

    if (!profile) return { ok: false as const, error: "invalid" };
    if (profile.email_verified) return { ok: true as const };

    const result = await verifyOtp(supabaseAdmin, {
      userId: profile.id,
      email: data.email,
      purpose: "registration",
      code: data.code,
    });
    if (result !== "ok") return { ok: false as const, error: result };

    // 4. Only now does the pending registration become a real account.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      email_confirm: true,
    });
    if (error) {
      console.error("[confirmRegistration] confirm failed", error);
      return { ok: false as const, error: "invalid" };
    }

    await supabaseAdmin.from("profiles").update({ email_verified: true }).eq("id", profile.id);
    return { ok: true as const };
  });

const emailOnly = z.object({ email: emailField });

export const resendRegistrationCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailOnly.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin, profile } = await findByEmail(data.email);
    const { issueOtp } = await import("./otp.server");
    if (!profile || profile.email_verified) return { ok: true as const };

    try {
      await issueOtp(supabaseAdmin, {
        userId: profile.id,
        email: data.email,
        phone: profile.phone,
        name: profile.first_name ?? "",
        purpose: "registration",
        resend: true,
      });
    } catch (error) {
      console.error("[resendRegistrationCode] otp delivery failed", error);
      return { ok: false as const, error: "mail_failed" as const };
    }
    return { ok: true as const };
  });

/** Password recovery: the code goes to the account e-mail. */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailOnly.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin, profile } = await findByEmail(data.email);
    const { issueOtp } = await import("./otp.server");
    // Always report success so the endpoint cannot enumerate customers.
    if (!profile) return { ok: true as const };

    try {
      await issueOtp(supabaseAdmin, {
        userId: profile.id,
        email: data.email,
        phone: profile.phone,
        name: profile.first_name ?? "",
        purpose: "password_reset",
      });
    } catch (error) {
      console.error("[requestPasswordReset] otp delivery failed", error);
    }
    return { ok: true as const };
  });

const resetSchema = z.object({
  email: emailField,
  code: z.string().trim().min(4).max(8),
  password: passwordField,
});

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin, profile } = await findByEmail(data.email);
    const { verifyOtp } = await import("./otp.server");
    if (!profile) return { ok: false as const, error: "invalid" };

    const result = await verifyOtp(supabaseAdmin, {
      userId: profile.id,
      email: data.email,
      purpose: "password_reset",
      code: data.code,
    });
    if (result !== "ok") return { ok: false as const, error: result };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.password,
      email_confirm: true,
    });
    if (error) return { ok: false as const, error: "invalid" };

    await supabaseAdmin.from("profiles").update({ email_verified: true }).eq("id", profile.id);
    return { ok: true as const };
  });

/**
 * Sign-in by e-mail OR phone.
 *
 * A phone number is resolved server side to the customer's real e-mail
 * (no synthetic addresses exist), the password is verified with a
 * publishable-key client and the resulting session is handed back so the
 * browser can adopt it with `supabase.auth.setSession`.
 */
const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(72),
});

export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");

    let email = data.identifier.toLowerCase();

    if (!email.includes("@")) {
      const phone = normalizePhone(data.identifier);
      if (!phone) return { ok: false as const, error: "invalid_credentials" as const };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("phone", phone)
        .maybeSingle<{ email: string | null }>();
      if (!profile?.email) return { ok: false as const, error: "invalid_credentials" as const };
      email = profile.email;
    }

    const client = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: result, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error || !result.session) {
      const unconfirmed = /confirm/i.test(error?.message ?? "");
      return {
        ok: false as const,
        error: unconfirmed ? ("email_not_confirmed" as const) : ("invalid_credentials" as const),
        email: unconfirmed ? email : undefined,
      };
    }

    return {
      ok: true as const,
      accessToken: result.session.access_token,
      refreshToken: result.session.refresh_token,
    };
  });
