/**
 * Run a boot once the page is parsed, and again when the Vault gate clones
 * its template into the document. Public pages find their nodes immediately.
 * Gated pages find them only after `vault-open`.
 */
export function onDeskReady(run) {
  const kick = () => run();
  document.addEventListener("vault-open", kick);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kick);
  else kick();
}
