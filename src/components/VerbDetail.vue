<script setup lang="ts">
import {computed} from "vue"

import {dueText, formatDays} from "../domain/format"
import {FIELD_LABEL, GRADE_LABEL, KIND_LABEL, TYPE_LABEL} from "../domain/labels"
import {display} from "../domain/notes"
import {useStudy} from "../store/study"

import type {Note} from "../domain/notes"

const props = defineProps<{note: Note}>()

const study = useStudy()
const cards = computed(() => study.cardsByNote.value.get(props.note.id) ?? [])
const answers = computed(() => study.today.value.get(props.note.id)?.entries ?? [])
</script>

<template>
  <p v-if="note.hint" class="muted" lang="ru">{{ note.hint }}</p>
  <table class="cards-of">
    <thead>
      <tr>
        <th>Card</th>
        <th>State</th>
        <th>Interval</th>
        <th>Next</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="card in cards" :key="card.id">
        <td>{{ KIND_LABEL[card.kind] }}</td>
        <td>{{ TYPE_LABEL[card.type] }}</td>
        <td>{{ card.type === "review" ? formatDays(card.ivl) : "—" }}</td>
        <td>{{ dueText(card, study.state.now) }}</td>
      </tr>
    </tbody>
  </table>
  <template v-if="answers.length">
    <div class="detail-h">Answers today</div>
    <table class="cards-of">
      <tbody>
        <tr v-for="(entry, index) in answers" :key="index">
          <td>{{ display(note, entry.given) }} → {{ FIELD_LABEL[entry.ask] }}</td>
          <td :class="entry.ok ? 'ok' : 'bad'">{{ entry.text || "empty" }}</td>
          <td>{{ GRADE_LABEL[entry.grade] }}</td>
        </tr>
      </tbody>
    </table>
  </template>
</template>
