<script setup lang="ts">
import {computed} from "vue"

import {FIELD_LABEL} from "../domain/labels"
import {display, hasForms} from "../domain/notes"

import type {Exercise} from "../domain/exercise"
import type {Field, Note} from "../domain/notes"

const props = defineProps<{note: Note; exercise: Exercise}>()

const fields = computed<Field[]>(() => (hasForms(props.note) ? ["ru", "v1", "v2", "v3"] : ["ru", "v1"]))
</script>

<template>
  <div class="forms" :class="{four: fields.length === 4}">
    <div v-for="field in fields" :key="field" :class="{hl: field === exercise.ask, dim: field === exercise.given, ru: field === 'ru'}">
      <span class="w" :lang="field === 'ru' ? 'ru' : 'en'">{{ display(note, field) }}</span>
      <span class="cap" :lang="field === 'ru' && note.hint ? 'ru' : 'en'">{{ field === "ru" && note.hint ? note.hint : FIELD_LABEL[field] }}</span>
    </div>
  </div>
</template>
