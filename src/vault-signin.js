/** Password sign-in decisions for the Vault wall. Pure so `npm run check` can run them without Clerk. */

/**
 * What the wall does with a SignIn resource after any step.
 * `needs_client_trust` is Clerk's new-device check on password sign-ins: it
 * asks for an email code exactly like a second factor.
 */
export function nextStep(signIn) {
  const status = signIn?.status;
  if (status === "complete" && signIn.createdSessionId) return { action: "activate", sessionId: signIn.createdSessionId };
  if (status === "needs_second_factor" || status === "needs_client_trust") {
    const factors = signIn.supportedSecondFactors ?? [];
    const email = factors.find((factor) => factor.strategy === "email_code");
    if (email) return { action: "code", strategy: "email_code", emailAddressId: email.emailAddressId };
    if (factors.some((factor) => factor.strategy === "totp")) return { action: "code", strategy: "totp" };
    return { action: "error", code: "second_factor" };
  }
  if (status === "needs_new_password") return { action: "new_password" };
  return { action: "error", code: "incomplete" };
}

export const STEP_ERRORS = {
  second_factor: "This account asks for a second step the Vault wall cannot show. Switch it to an email code in Clerk, then sign in again.",
  incomplete: "Sign-in did not finish. Start over and try again.",
};

const CLERK_ERRORS = {
  form_identifier_not_found: "There is no Vault sign-in for that email yet. Vault does not create accounts here.",
  form_password_incorrect: "That password did not match. Try again, or use Set or reset password.",
  strategy_for_user_invalid: "This account has no password yet. Use Set or reset password below.",
  form_code_incorrect: "That code did not match. Check the newest email and try again.",
  verification_expired: "That code expired. Start over to get a new one.",
  verification_failed: "Too many wrong codes. Start over to get a new one.",
};

export function clerkCode(error) {
  return error?.errors?.[0]?.code ?? null;
}

/** Desk copy for a Clerk API error, falling back to Clerk's own message. */
export function errorCopy(error) {
  const first = error?.errors?.[0];
  if (!first) return error?.message || "Something went wrong. Try again in a moment.";
  if (CLERK_ERRORS[first.code]) return CLERK_ERRORS[first.code];
  if (first.meta?.paramName === "strategy") return "Password sign-in is not switched on for this Vault yet.";
  return first.longMessage ?? first.message ?? "Something went wrong. Try again in a moment.";
}
