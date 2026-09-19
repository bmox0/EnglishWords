<script setup lang="ts">
import {computed} from "vue"

import {stateOf} from "../domain/cards"
import {formatDays, formatMinutes} from "../domain/format"
import {GRADE_LABEL} from "../domain/labels"
import {dayOf, MINUTE, nextState} from "../domain/scheduler"

import type {Card} from "../domain/cards"
import type {Grade} from "../domain/scheduler"

const props = defineProps<{card: Card; grade: Grade; reason: string; now: number}>()

const back = computed(() => {
  const next = nextState(stateOf(props.card), props.grade, props.now)
  return next.type === "review" ? formatDays(dayOf(next.due) - dayOf(props.now)) : formatMinutes((next.due - props.now) / MINUTE)
})
</script>

<template>
  <span class="graded" :data-g="grade">
    <b>{{ GRADE_LABEL[grade] }}</b>
    <small>{{ reason }} · back in {{ back }}</small>
  </span>
</template>
