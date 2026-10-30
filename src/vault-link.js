/** Email-link return handling. Pure so the github.io bounce can be checked without Clerk. */

export function readClerkLinkCallback(search) {
  const params = new URLSearchParams(search);
  const status = params.get("__clerk_status");
  if (!status) return null;
  return { status, createdSessionId: params.get("__clerk_created_session") };
}

/** Drop Clerk's return params. Same document, no navigation. */
export function withoutClerkQuery(href) {
  const url = new URL(href);
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("__clerk") || key === "__dev_session" || key === "suffixed_cookies") url.searchParams.delete(key);
  }
  if (url.hash.includes("__clerk")) {
    url.hash = decodeURI(url.hash).replace(/__clerk_db_jwt\[[^\]]*\]/, "");
    if (url.hash === "#") url.hash = "";
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * What the tab that opened the email link should do.
 * `activate` means setActive with no redirectUrl. A redirect reloads this
 * page; on a Clerk development instance that reload drops the dev-browser
 * session and the wall paints signed out.
 * `transferable` is left to the tab that asked for the link. Consuming the
 * transfer here races that dev-browser token.
 */
export function emailLinkReturnPlan({ status, createdSessionId, sessionIds, signInStatus, signUpStatus }) {
  if (status === "expired" || status === "client_mismatch" || status === "failed") return { action: "error", code: status };
  if (status === "verified") {
    if (createdSessionId && sessionIds?.includes(createdSessionId)) return { action: "activate", sessionId: createdSessionId };
    if (signInStatus === "needs_second_factor" || signUpStatus === "missing_requirements") return { action: "error", code: "needs_more" };
    return { action: "elsewhere" };
  }
  if (status === "transferable") return { action: "elsewhere" };
  return { action: "error", code: "failed" };
}

/** What the tab that asked for the link should do when its poll resolves. */
export function emailLinkAttemptPlan(result) {
  if (result?.status === "complete" && result.createdSessionId) return { action: "activate", sessionId: result.createdSessionId };
  const verification = result?.firstFactorVerification ?? result?.verifications?.emailAddress;
  if (verification?.status === "expired") return { action: "error", code: "expired" };
  if (verification?.status === "transferable") return { action: "transfer" };
  return { action: "error", code: "incomplete" };
}
