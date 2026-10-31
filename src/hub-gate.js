/**
 * Family gate for Positioning % Hub. Same sign-in card as Vault, different
 * list and return URL. Dispatches `vault-open` so the shared department
 * modules (flow, new today, wall) mount after the template is cloned.
 */
import { FAMILY_ALLOWLIST, FAMILY_ENTRY, isAllowlisted, normalizeEmail } from "./family-allowlist.js";
import { STEP_ERRORS, clerkCode, errorCopy, nextStep } from "./vault-signin.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{6}$/;

const wall = document.getElementById("vault-wall");
const form = document.getElementById("wall-form");
const input = document.getElementById("wall-email");
const codeField = document.getElementById("wall-code-field");
const codeLabel = document.getElementById("wall-code-label");
const codeInput = document.getElementById("wall-code");
const passwordField = document.getElementById("wall-password-field");
const passwordLabel = document.getElementById("wall-password-label");
const passwordInput = document.getElementById("wall-password");
const submit = document.getElementById("wall-submit");
const lede = document.getElementById("wall-lede");
const status = document.getElementById("wall-status");
const forgot = document.getElementById("wall-forgot");
const reset = document.getElementById("wall-reset");
const account = document.getElementById("vault-account");
const accountEmail = document.getElementById("vault-account-email");
const signOut = document.getElementById("vault-signout");
const content = document.getElementById("vault-content");

const NOT_LISTED = "That email is not on the list.";
const SUBMIT = { password: "Sign in", code: "Verify", reset: "Set password and sign in" };

let opened = false;
let step = "password";

function vaultUrl() {
  return new URL(`${base}${FAMILY_ENTRY}/`, location.origin).href;
}

function setState(state) {
  wall.dataset.state = state;
  const busy = state === "busy" || state === "off";
  for (const control of [input, codeInput, passwordInput, submit, forgot, reset]) control.disabled = busy;
}

function showStep(next) {
  step = next;
  wall.dataset.step = next;
  codeField.hidden = next === "password";
  passwordField.hidden = next === "code";
  input.readOnly = next !== "password";
  codeInput.value = "";
  codeLabel.textContent = "Code from your email";
  passwordInput.value = "";
  passwordInput.autocomplete = next === "reset" ? "new-password" : "current-password";
  passwordLabel.textContent = next === "reset" ? "New password" : "Password";
  submit.textContent = SUBMIT[next];
  forgot.hidden = next !== "password";
  reset.hidden = next === "password";
}

function say(text, tone) {
  status.textContent = text;
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function invalid(field, message) {
  field.setAttribute("aria-invalid", "true");
  say(message, "error");
  field.focus();
  return null;
}

function readEmail() {
  const email = normalizeEmail(input.value);
  input.setAttribute("aria-invalid", "false");
  if (!EMAIL.test(email)) return invalid(input, "Enter a full email address.");
  if (!isAllowlisted(email, FAMILY_ALLOWLIST)) return invalid(input, NOT_LISTED);
  return email;
}

function readCode() {
  const code = codeInput.value.replace(/\s+/g, "");
  codeInput.setAttribute("aria-invalid", "false");
  if (!CODE.test(code)) return invalid(codeInput, "Enter the 6-digit code.");
  return code;
}

function readPassword() {
  passwordInput.setAttribute("aria-invalid", "false");
  if (!passwordInput.value) return invalid(passwordInput, step === "reset" ? "Choose a new password." : "Enter your password.");
  return passwordInput.value;
}

function openVault(email) {
  if (opened) return;
  opened = true;
  wall.remove();
  accountEmail.textContent = email ? `Signed in as ${email}` : "Signed in";
  account.hidden = false;
  account.after(content.content.cloneNode(true));
  document.dispatchEvent(new CustomEvent("vault-open"));
}

/* No publishable key at build time: the wall stays up and sign-in is off. */
function startWithoutClerk() {
  lede.textContent = "Nothing on this page yet.";
  setState("off");
  say("Sign-in is not set up on this build.");
  if (import.meta.env?.DEV) console.info("Hub sign-in is off. Set VITE_CLERK_PUBLISHABLE_KEY (see README).");
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

  signOut.addEventListener("click", async () => {
    signOut.disabled = true;
    await clerk.signOut();
    location.replace(vaultUrl());
  });

  clerk.addListener(({ user }) => {
    if (user) openVault(user.primaryEmailAddress?.emailAddress);
    else if (opened) location.replace(vaultUrl());
  });

  if (clerk.user) openVault(clerk.user.primaryEmailAddress?.emailAddress);
  if (opened) return;

  let attempt = null;
  let factor = null;

  function fail(error) {
    if (clerkCode(error) === "session_exists") {
      location.reload();
      return;
    }
    setState("ready");
    say(errorCopy(error), "error");
  }

  async function follow(result, email) {
    const plan = nextStep(result);
    if (plan.action === "activate") {
      await clerk.setActive({ session: plan.sessionId });
      if (clerk.user) openVault(clerk.user.primaryEmailAddress?.emailAddress ?? email);
      return;
    }
    if (plan.action === "code") {
      attempt = result;
      factor = plan;
      if (plan.strategy === "email_code") await result.prepareSecondFactor({ strategy: "email_code", emailAddressId: plan.emailAddressId });
      showStep("code");
      if (plan.strategy === "totp") codeLabel.textContent = "Code from your authenticator app";
      setState("ready");
      say(plan.strategy === "email_code" ? `We sent a 6-digit code to ${email}. Enter it to finish signing in.` : "Enter the 6-digit code from your authenticator app.");
      codeInput.focus();
      return;
    }
    setState("ready");
    say(STEP_ERRORS[plan.code] ?? STEP_ERRORS.incomplete, "error");
  }

  async function signInWithPassword() {
    const email = readEmail();
    if (!email) return;
    const password = readPassword();
    if (!password) return;
    setState("busy");
    say("Signing in…");
    try {
      await follow(await clerk.client.signIn.create({ strategy: "password", identifier: email, password }), email);
    } catch (error) {
      fail(error);
    }
  }

  async function verifySecondFactor() {
    const code = readCode();
    if (!code) return;
    setState("busy");
    say("Checking the code…");
    try {
      await follow(await attempt.attemptSecondFactor({ strategy: factor.strategy, code }), normalizeEmail(input.value));
    } catch (error) {
      fail(error);
    }
  }

  async function finishReset() {
    const code = readCode();
    if (!code) return;
    const password = readPassword();
    if (!password) return;
    setState("busy");
    say("Setting your password…");
    try {
      let result = attempt;
      if (result.status !== "needs_new_password") result = await result.attemptFirstFactor({ strategy: "reset_password_email_code", code });
      if (result.status === "needs_new_password") result = await result.resetPassword({ password, signOutOfOtherSessions: false });
      attempt = result;
      await follow(result, normalizeEmail(input.value));
    } catch (error) {
      fail(error);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (wall.dataset.state !== "ready") return;
    if (step === "password") signInWithPassword();
    else if (step === "code") verifySecondFactor();
    else finishReset();
  });

  forgot.addEventListener("click", async () => {
    const email = readEmail();
    if (!email) return;
    setState("busy");
    say("Sending a code…");
    try {
      attempt = await clerk.client.signIn.create({ strategy: "reset_password_email_code", identifier: email });
      showStep("reset");
      setState("ready");
      say(`We sent a 6-digit code to ${email}. Enter it with a new password.`);
      codeInput.focus();
    } catch (error) {
      fail(error);
    }
  });

  reset.addEventListener("click", () => {
    attempt = null;
    factor = null;
    showStep("password");
    say("");
    input.focus();
  });

  showStep("password");
  setState("ready");
}

if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) startClerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
else startWithoutClerk();
