/**
 * Emails that may sign in to Vault.
 *
 * To add someone: append their email below (lowercase), open a PR, and redeploy.
 * Then, in the Clerk Dashboard, add the same email under Restrictions → Allowlist
 * and create the user (Users → Create user, email + password) so they never go
 * through sign-up.
 *
 * This list only decides who the wall will try to sign in. It is not access
 * control: Clerk's restrictions (sign-up off, allowlist) are what refuse accounts.
 */
export const VAULT_ALLOWLIST = ["vannatrader@gmail.com"];

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isAllowlisted(email, list = VAULT_ALLOWLIST) {
  const wanted = normalizeEmail(email);
  return Boolean(wanted) && list.some((entry) => normalizeEmail(entry) === wanted);
}
