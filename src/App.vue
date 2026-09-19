<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue"

import SettingsDialog from "./components/SettingsDialog.vue"
import StudyPane from "./components/StudyPane.vue"
import VerbTable from "./components/VerbTable.vue"
import {useMediaQuery} from "./composables/useMediaQuery"
import {STORAGE_KEY} from "./domain/storage"
import {useStudy} from "./store/study"

import type {Grade} from "./domain/scheduler"

const study = useStudy()
const compact = useMediaQuery("(max-width: 900px)")
const sheetOpen = ref(false)
const settingsOpen = ref(false)
const tableVisible = computed(() => (compact.value ? sheetOpen.value : study.state.tableOpen))

function toggleTable() {
  if (compact.value) sheetOpen.value = !sheetOpen.value
  else study.setTableOpen(!study.state.tableOpen)
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || settingsOpen.value) return
  const target = event.target as HTMLElement
  if (event.key === "Escape" && compact.value && sheetOpen.value) {
    sheetOpen.value = false
    return
  }
  if (target.closest("[data-no-hotkeys]")) return
  const suggested = study.suggested.value
  if (suggested) {
    if (["1", "2", "3", "4"].includes(event.key)) {
      event.preventDefault()
      study.grade(Number(event.key) as Grade)
    } else if (event.key === "Enter") {
      event.preventDefault()
      study.grade(suggested)
    }
    return
  }
  if (event.key === "Enter" && target.matches("[data-answer]")) {
    event.preventDefault()
    study.check()
  }
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY) study.reloadFromStorage()
}

function onVisible() {
  if (document.visibilityState === "visible") study.tick()
}

let timer = 0

onMounted(() => {
  document.addEventListener("keydown", onKeydown)
  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("storage", onStorage)
  timer = window.setInterval(study.tick, 15_000)
})

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown)
  document.removeEventListener("visibilitychange", onVisible)
  window.removeEventListener("storage", onStorage)
  window.clearInterval(timer)
})
</script>

<template>
  <div class="app" :class="{'no-side': !compact && !tableVisible}">
    <StudyPane
      :compact="compact"
      :table-visible="tableVisible"
      :blocked="settingsOpen || (compact && sheetOpen)"
      @toggle-table="toggleTable"
      @open-settings="settingsOpen = true"
    />
    <VerbTable v-show="tableVisible" :compact="compact" @close="sheetOpen = false" />
  </div>
  <SettingsDialog v-model:open="settingsOpen" />
</template>
