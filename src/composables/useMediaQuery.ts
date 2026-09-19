import {onBeforeUnmount, onMounted, ref} from "vue"

import type {Ref} from "vue"

/** Whether a CSS media query currently matches, kept up to date. */
export function useMediaQuery(query: string): Ref<boolean> {
  const list = window.matchMedia(query)
  const matches = ref(list.matches)
  const update = (event: MediaQueryListEvent) => (matches.value = event.matches)
  onMounted(() => list.addEventListener("change", update))
  onBeforeUnmount(() => list.removeEventListener("change", update))
  return matches
}
