import {nextTick, readonly, ref, watch} from "vue"

export const THEME_STORAGE_KEY = "english-words:dark"

const systemDark = window.matchMedia("(prefers-color-scheme: dark)")

function savedDark(): boolean {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (saved) return saved === "true"
  } catch {}
  return systemDark.matches
}

const isDark = ref(savedDark())
let animating = false

function syncThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue("--desk").trim()
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color)
}

watch(
  isDark,
  (dark) => {
    document.documentElement.classList.toggle("dark", dark)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, String(dark))
    } catch {}
    syncThemeColor()
  },
  {immediate: true},
)

systemDark.addEventListener("change", (event) => (isDark.value = event.matches))

/** Switches to the light or dark theme, revealing it with a diagonal wipe from the top-right corner where the browser supports view transitions. */
async function setTheme(dark: boolean) {
  if (dark === isDark.value) return
  const apply = async () => {
    isDark.value = dark
    await nextTick()
  }
  if (typeof document.startViewTransition !== "function" || animating) {
    await apply()
    return
  }
  animating = true
  try {
    await document.startViewTransition(apply).finished.catch(() => undefined)
  } finally {
    animating = false
  }
}

/** The light or dark theme: follows the system until changed, remembered in localStorage, applied as the `dark` class on `<html>`. */
export function useTheme() {
  return {isDark: readonly(isDark), setTheme}
}
