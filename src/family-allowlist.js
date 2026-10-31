/**
 * Emails that may sign in to Insight (the family desk).
 *
 * To add a family member: append their email below (lowercase), open a PR,
 * and redeploy. Then, in the Clerk Dashboard, add the same email under
 * Restrictions → Allowlist and create the user (Users → Create user, email
 * + password) so they never go through sign-up.
 *
 * CEO (vannatrader@gmail.com) is on this list so they can test Insight.
 * Family emails go here; do NOT put them on VAULT_ALLOWLIST.
 *
 * This list only decides who the wall will try to sign in. It is not access
 * control: Clerk's restrictions (sign-up off, allowlist) are what refuse accounts.
 */
export const FAMILY_ALLOWLIST = [
  "vannatrader@gmail.com", // CEO - can test both Insight and Vault
  // Add family emails below (one per line, lowercase):
];

export { normalizeEmail, isAllowlisted } from "./vault-allowlist.js";
