export type ThemePreference = "system" | "light" | "dark";
export const THEME_STORAGE_KEY = "sj-theme";
export const THEME_QUERY = "(prefers-color-scheme: dark)";

export function normalizeTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Constant script only: never interpolate user input. Runs before body first paint.
// CSS handles system preference even when scripts/storage are unavailable.
export const THEME_BOOTSTRAP = `(function(){var p="system";try{var v=localStorage.getItem("${THEME_STORAGE_KEY}");if(v==="light"||v==="dark")p=v;}catch(e){}var d=document.documentElement;d.dataset.themePreference=p;d.dataset.theme=p==="system"?(matchMedia("${THEME_QUERY}").matches?"dark":"light"):p;})();`;
