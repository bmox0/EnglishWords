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

function setCircleClip(origin: Element | null | undefined) {
  const rect = origin?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth
  const y = rect ? rect.top + rect.height / 2 : 0
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const style = document.documentElement.style
  style.setProperty("--vt-clip-from", `circle(0px at ${x}px ${y}px)`)
  style.setProperty("--vt-clip-to", `circle(${radius}px at ${x}px ${y}px)`)
}

/** Switches between the light and dark theme with a circle that grows from `origin`, where the browser supports view transitions. */
async function toggleTheme(origin?: Element | null) {
  const apply = async () => {
    isDark.value = !isDark.value
    await nextTick()
  }
  if (typeof document.startViewTransition !== "function") {
    await apply()
    return
  }
  if (animating) return
  animating = true
  try {
    setCircleClip(origin)
    await document.startViewTransition(apply).finished.catch(() => undefined)
  } finally {
    animating = false
  }
}

/** The light or dark theme: follows the system until changed, remembered in localStorage, applied as the `dark` class on `<html>`. */
export function useTheme() {
  return {isDark: readonly(isDark), toggleTheme}
}
