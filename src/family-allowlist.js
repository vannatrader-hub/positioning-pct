/**
 * Ops only. Do not name FAMILY_ENTRY in README, public nav, footers, sitemaps,
 * or robots.txt. The public site must not link here.
 *
 * Entry directory: FAMILY_ENTRY (one segment, no trailing slash). Share that
 * path only with people on FAMILY_ALLOWLIST. Add their email here (lowercase),
 * redeploy, then add the same email in Clerk Restrictions → Allowlist and
 * create the user. Leave them off VAULT_ALLOWLIST unless they should open Vault.
 *
 * Data is not copied for this entry. Surfaces in src/product-feeds.js share
 * public/data and src render modules. The book feed stays Vault-only.
 * A signed-out request shows a generic Coming soon wall, not a product page.
 */
export const FAMILY_ENTRY = "m4c8q";

export const FAMILY_ALLOWLIST = [
  "vannatrader@gmail.com",
];

export { normalizeEmail, isAllowlisted } from "./vault-allowlist.js";
