/**
 * Family content gate: shows Coming soon for anonymous/non-family visitors,
 * unlocks the full content for signed-in family users.
 *
 * Unlike the full Insight gate with its sign-in form, this gate only checks
 * the existing Clerk session. Non-family visitors see a Coming soon card
 * with a link to sign in through Insight.
 */

import { isAllowlisted } from "./family-allowlist.js";

const base = import.meta.env ? import.meta.env.BASE_URL : "/";

const wall = document.getElementById("family-wall");
const content = document.getElementById("family-content");
const account = document.getElementById("family-account");
const accountEmail = document.getElementById("family-account-email");
const signOut = document.getElementById("family-signout");

let opened = false;

function openContent(email) {
  if (opened) return;
  opened = true;
  wall.remove();
  if (account && accountEmail) {
    accountEmail.textContent = email ? `Signed in as ${email}` : "Signed in";
    account.hidden = false;
  }
  if (content) {
    const parent = content.parentElement;
    parent.insertBefore(content.content.cloneNode(true), content);
    content.remove();
  }
  document.dispatchEvent(new CustomEvent("family-content-open"));
}

function showComingSoon() {
  if (wall) wall.dataset.state = "coming-soon";
}

async function checkSession(publishableKey) {
  let clerk;
  try {
    const { Clerk } = await import("@clerk/clerk-js");
    clerk = new Clerk(publishableKey);
    await clerk.load();
  } catch (error) {
    console.error("Clerk load failed:", error);
    showComingSoon();
    return;
  }

  if (signOut) {
    signOut.addEventListener("click", async () => {
      signOut.disabled = true;
      await clerk.signOut();
      location.replace(`${base}options-flow/`);
    });
  }

  clerk.addListener(({ user }) => {
    if (user) {
      const email = user.primaryEmailAddress?.emailAddress;
      if (email && isAllowlisted(email)) {
        openContent(email);
      } else {
        showComingSoon();
      }
    } else if (opened) {
      location.replace(`${base}options-flow/`);
    } else {
      showComingSoon();
    }
  });

  if (clerk.user) {
    const email = clerk.user.primaryEmailAddress?.emailAddress;
    if (email && isAllowlisted(email)) {
      openContent(email);
    } else {
      showComingSoon();
    }
  } else {
    showComingSoon();
  }
}

if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
  checkSession(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
} else {
  showComingSoon();
}
