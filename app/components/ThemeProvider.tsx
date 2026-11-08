"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { normalizeTheme, THEME_QUERY, THEME_STORAGE_KEY, type ThemePreference } from "@/app/lib/theme";

type ThemeContextValue = { preference: ThemePreference; ready: boolean; choose: (value: ThemePreference) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const CHANGE_EVENT = "sj-theme-change";
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

function getSnapshot() { return normalizeTheme(document.documentElement.dataset.themePreference); }
function getServerSnapshot(): ThemePreference { return "system"; }
function clientReady() { return true; }
function serverReady() { return false; }
function subscribeReady() { return () => {}; }

function apply(value: ThemePreference, animate = false) {
  const root = document.documentElement;
  const theme = value === "system" ? (matchMedia(THEME_QUERY).matches ? "dark" : "light") : value;
  clearTimeout(transitionTimer);
  if (animate && root.dataset.theme !== theme && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.dataset.themeTransition = "true";
    transitionTimer = setTimeout(() => { delete root.dataset.themeTransition; }, 200);
  } else delete root.dataset.themeTransition;
  root.dataset.themePreference = value;
  root.dataset.theme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const media = matchMedia(THEME_QUERY);
  const onSystemChange = () => { if (getSnapshot() === "system") apply("system", true); };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) apply(normalizeTheme(event.newValue), true);
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystemChange);
  };
}

function choose(value: ThemePreference) {
  const normalized = normalizeTheme(value);
  try { localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch { /* usable in this tab even when storage is blocked */ }
  apply(normalized, true);
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeControl requires ThemeProvider");
  return value;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR and first hydration share system/disabled markup; bootstrap owns pre-paint color.
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  useLayoutEffect(() => {
    // Restore attributes after Strict Mode / global-error document remounts.
    let value = getSnapshot();
    try { value = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* system or in-memory choice */ }
    apply(value);
    return () => { clearTimeout(transitionTimer); delete document.documentElement.dataset.themeTransition; };
  }, []);
  return <ThemeContext.Provider value={{ preference, ready, choose }}>{children}</ThemeContext.Provider>;
}
