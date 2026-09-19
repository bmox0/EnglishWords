<script setup lang="ts">
import {ref, watch} from "vue"

import {useTheme} from "../composables/useTheme"
import {useStudy} from "../store/study"

import type {AnswerMode} from "../domain/exercise"

const open = defineModel<boolean>("open", {required: true})

const study = useStudy()
const {isDark, setTheme} = useTheme()
const dialog = ref<HTMLDialogElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const status = ref("")

watch(open, (value) => {
  status.value = ""
  if (value) dialog.value?.showModal()
  else dialog.value?.close()
})

function onNewPerDay(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value)) study.updateSettings({newPerDay: Math.min(500, Math.max(0, Math.round(value)))})
}

const ANSWER_MODES: {value: AnswerMode; label: string}[] = [
  {value: "both", label: "Type or pick"},
  {value: "type", label: "Always type"},
  {value: "choice", label: "Always pick"},
]

function onAnswerMode(value: AnswerMode) {
  study.updateSettings({answerMode: value})
}

function exportFile() {
  const blob = new Blob([study.exportProgress()], {type: "application/json"})
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `english-verbs-progress-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(link.href)
  status.value = "Progress exported."
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ""
  if (!file) return
  if (!window.confirm("Replace the progress in this browser with the file?")) return
  status.value = study.importProgress(await file.text()) ? "Progress imported." : "This file is not a progress export."
}

function reset() {
  if (!window.confirm("Reset all progress? This cannot be undone.")) return
  study.resetProgress()
  status.value = "Progress reset."
}
</script>

<template>
  <dialog ref="dialog" class="settings" aria-labelledby="settings-title" data-no-hotkeys @close="open = false" @click.self="open = false">
    <form method="dialog" class="settings-body">
      <h2 id="settings-title">Settings</h2>

      <label class="setting">
        <span>New cards per day</span>
        <input type="number" min="0" max="500" inputmode="numeric" :value="study.state.settings.newPerDay" @change="onNewPerDay" />
      </label>

      <fieldset class="setting">
        <legend>Theme</legend>
        <label><input type="radio" name="theme" :checked="!isDark" @change="setTheme(false)" /> Light</label>
        <label><input type="radio" name="theme" :checked="isDark" @change="setTheme(true)" /> Dark</label>
      </fieldset>

      <fieldset class="setting">
        <legend>Answers</legend>
        <label v-for="mode in ANSWER_MODES" :key="mode.value">
          <input type="radio" name="answers" :checked="study.state.settings.answerMode === mode.value" @change="onAnswerMode(mode.value)" />
          {{ mode.label }}
        </label>
      </fieldset>

      <h3>Progress</h3>
      <p class="muted">Progress is saved in this browser only. Export it to keep a backup or to move to another device.</p>
      <div class="settings-actions">
        <button type="button" class="btn" @click="exportFile">Export</button>
        <button type="button" class="btn" @click="fileInput?.click()">Import…</button>
        <button type="button" class="btn danger" @click="reset">Reset</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importFile" />
      </div>
      <p v-if="status" class="muted" role="status">{{ status }}</p>

      <div class="settings-footer">
        <span class="muted">{{ study.notes.length }} words</span>
        <button class="btn primary" value="close" autofocus>Done</button>
      </div>
    </form>
  </dialog>
</template>
