const base = import.meta.env ? import.meta.env.BASE_URL : "/";
const REQUESTS_KEY = "positioning-pct-vault-requests";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const wall = document.getElementById("vault-wall");
const form = document.getElementById("wall-form");
const input = document.getElementById("wall-email");
const submit = document.getElementById("wall-submit");
const lede = document.getElementById("wall-lede");
const status = document.getElementById("wall-status");
const reset = document.getElementById("wall-reset");
const account = document.getElementById("vault-account");
const accountEmail = document.getElementById("vault-account-email");
const signOut = document.getElementById("vault-signout");
const content = document.getElementById("vault-content");

let opened = false;

function vaultUrl() {
  return new URL(`${base}vault/`, location.origin).href;
}

function setState(state) {
  wall.dataset.state = state;
  const busy = state === "busy";
  input.disabled = busy;
  submit.disabled = busy;
  reset.hidden = state !== "sent";
}

function say(text, tone) {
  status.textContent = text;
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function readEmail() {
  const email = input.value.trim().toLowerCase();
  const valid = EMAIL.test(email);
  input.setAttribute("aria-invalid", String(!valid));
  if (!valid) {
    say("Enter a full email address.", "error");
    input.focus();
    return null;
  }
  return email;
}

function backToForm() {
  setState("ready");
  say("");
  input.focus();
}

function openVault(email) {
  if (opened) return;
  opened = true;
  wall.remove();
  accountEmail.textContent = email ? `Signed in as ${email}` : "Signed in";
  account.hidden = false;
  account.after(content.content.cloneNode(true));
}

function noteRequest(email) {
  try {
    const list = JSON.parse(localStorage.getItem(REQUESTS_KEY) ?? "[]");
    if (!list.some((entry) => entry.email === email)) list.push({ email, at: new Date().toISOString() });
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  } catch {
    /* The wall still answers when storage is blocked. */
  }
}

/* No publishable key at build time: same wall, request-only, nothing leaves the browser. */
function startRequestOnly() {
  lede.textContent = "Vault opens by invitation. Leave your email to request access.";
  submit.textContent = "Request access";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = readEmail();
    if (!email) return;
    noteRequest(email);
    setState("sent");
    say(`Thanks. Your request for ${email} is noted.`);
  });
  reset.addEventListener("click", backToForm);
  setState("ready");
  if (import.meta.env?.DEV) console.info("Vault sign-in is off. Set VITE_CLERK_PUBLISHABLE_KEY to send sign-in links (see README).");
}

function clerkMessage(error) {
  return error?.errors?.[0]?.longMessage ?? error?.errors?.[0]?.message ?? "Something went wrong. Try again in a moment.";
}

function clerkCode(error) {
  return error?.errors?.[0]?.code ?? null;
}

const LINK_ERRORS = {
  expired: "That sign-in link expired. Send a new one below.",
  client_mismatch: "Open the link in the same browser you asked from, or send a new one below.",
  failed: "That sign-in link did not work. Send a new one below.",
};

async function finishLinkHere(clerk) {
  try {
    await clerk.handleEmailLinkVerification({
      redirectUrlComplete: vaultUrl(),
      redirectUrl: vaultUrl(),
      onVerifiedOnOtherDevice: () => say("Link confirmed. Vault is open in the tab or device where you asked for it."),
    });
  } catch (error) {
    say(LINK_ERRORS[error?.code] ?? LINK_ERRORS.failed, "error");
  }
  history.replaceState(null, "", vaultUrl());
}

async function startLink(clerk, email) {
  const { signIn, signUp } = clerk.client;
  try {
    const attempt = await signIn.create({ identifier: email });
    const links = (attempt.supportedFirstFactors ?? []).filter((factor) => factor.strategy === "email_link");
    const factor = links.find((item) => item.safeIdentifier?.toLowerCase() === email) ?? links[0];
    if (!factor) throw new Error("Email sign-in links are switched off for this Vault.");
    const flow = attempt.createEmailLinkFlow();
    return { flow, done: flow.startEmailLinkFlow({ emailAddressId: factor.emailAddressId, redirectUrl: vaultUrl() }) };
  } catch (error) {
    if (clerkCode(error) !== "form_identifier_not_found") throw error;
  }
  try {
    const attempt = await signUp.create({ emailAddress: email });
    const flow = attempt.createEmailLinkFlow();
    return { flow, done: flow.startEmailLinkFlow({ redirectUrl: vaultUrl() }) };
  } catch (error) {
    /* Restricted or waitlist sign-up: record the request instead of opening an account. */
    try {
      await clerk.joinWaitlist({ emailAddress: email });
      return null;
    } catch {
      throw error;
    }
  }
}

async function startClerk(publishableKey) {
  let clerk;
  try {
    const { Clerk } = await import("@clerk/clerk-js");
    clerk = new Clerk(publishableKey);
    await clerk.load();
  } catch (error) {
    console.error(error);
    setState("ready");
    say("Sign-in is not reachable right now. Try again in a moment.", "error");
    return;
  }

  if (new URLSearchParams(location.search).has("__clerk_status")) await finishLinkHere(clerk);

  clerk.addListener(({ user }) => {
    if (user) openVault(user.primaryEmailAddress?.emailAddress);
    else if (opened) location.replace(vaultUrl());
  });
  if (opened) return;

  let pending = null;
  let attempt = 0;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = readEmail();
    if (!email) return;
    const mine = ++attempt;
    setState("busy");
    say("Sending your link…");
    let link;
    try {
      link = await startLink(clerk, email);
    } catch (error) {
      if (mine !== attempt) return;
      setState("ready");
      say(clerkCode(error) ? clerkMessage(error) : error.message, "error");
      return;
    }
    if (mine !== attempt) return;
    setState("sent");
    if (!link) {
      say(`Thanks. Your request for ${email} is in. You will get an email when Vault opens to you.`);
      return;
    }
    pending = link.flow;
    say(`Check ${email} for a sign-in link. Open it and Vault opens here.`);
    try {
      const result = await link.done;
      if (mine !== attempt) return;
      if (result.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        return;
      }
      const verification = result.firstFactorVerification ?? result.verifications?.emailAddress;
      setState("ready");
      say(verification?.status === "expired" ? LINK_ERRORS.expired : "Sign-in did not finish. Send a new link to try again.", "error");
    } catch (error) {
      if (mine !== attempt) return;
      setState("ready");
      say(clerkMessage(error), "error");
    } finally {
      if (pending === link.flow) pending = null;
    }
  });

  reset.addEventListener("click", () => {
    attempt += 1;
    pending?.cancelEmailLinkFlow();
    pending = null;
    backToForm();
  });

  signOut.addEventListener("click", async () => {
    signOut.disabled = true;
    await clerk.signOut();
    location.replace(vaultUrl());
  });

  if (wall.dataset.state === "checking") setState("ready");
}

if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) startClerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
else startRequestOnly();
