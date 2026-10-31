/**
 * Family wall surface. The gauge and the longer close read render only when
 * the page sets data-family-entry to the private entry. Public pages leave it off.
 */
import { FAMILY_ENTRY } from "./family-allowlist.js";

export { FAMILY_ENTRY };

export function isFamilySurface(doc = globalThis.document) {
  return doc?.body?.dataset?.familyEntry === FAMILY_ENTRY;
}
