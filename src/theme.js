/**
 * Light / dark theme for every Positioning % surface: Dashboard, Vault, and the Hub.
 * The inline boot script in each page head sets `data-theme` on <html> before first
 * paint (stored `p-theme`, else `prefers-color-scheme` on the first visit, then stored).
 * This module wires the topbar toggle, keeps aria-pressed and theme-color in step,
 * and follows a change made in another tab.
 */
export const THEME_KEY = "p-theme";
export const THEMES = ["light", "dark"];
export const THEME_PAGE = { light: "#f3f1ec", dark: "#161410" };

export function resolveTheme(stored, prefersDark) {
  if (THEMES.includes(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

function readStored() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function store(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Private mode: the choice holds for this page view only. */
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_PAGE[theme]);
  for (const button of document.querySelectorAll("[data-theme-set]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeSet === theme));
  }
}

if (typeof document !== "undefined") {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const current = () => resolveTheme(document.documentElement.dataset.theme ?? readStored(), prefersDark);
  const first = current();
  if (!THEMES.includes(readStored())) store(first);
  apply(first);

  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-theme-set]") : null;
    if (!button || !THEMES.includes(button.dataset.themeSet)) return;
    store(button.dataset.themeSet);
    apply(button.dataset.themeSet);
  });
  /* Gated rooms clone their topbar from a template after sign-in. */
  document.addEventListener("vault-open", () => apply(current()));
  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY && THEMES.includes(event.newValue)) apply(event.newValue);
  });
}
