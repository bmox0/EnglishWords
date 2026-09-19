<script setup lang="ts">
import {stateOf} from "../domain/cards"
import {formatDays, formatMinutes} from "../domain/format"
import {GRADE_LABEL} from "../domain/labels"
import {dayOf, MINUTE, nextState} from "../domain/scheduler"

import type {Card} from "../domain/cards"
import type {Grade} from "../domain/scheduler"

const props = defineProps<{card: Card; suggested: Grade; now: number}>()
const emit = defineEmits<{grade: [value: Grade]}>()

const GRADES: Grade[] = [1, 2, 3, 4]

function preview(grade: Grade): string {
  const next = nextState(stateOf(props.card), grade, props.now)
  return next.type === "review" ? formatDays(dayOf(next.due) - dayOf(props.now)) : formatMinutes((next.due - props.now) / MINUTE)
}
</script>

<template>
  <div class="grades">
    <button
      v-for="grade in GRADES"
      :key="grade"
      type="button"
      class="grade"
      :class="{suggested: grade === suggested}"
      :data-g="grade"
      :title="`Key ${grade}`"
      @mousedown.prevent
      @click="emit('grade', grade)"
    >
      <small>{{ preview(grade) }}</small>
      <b>{{ GRADE_LABEL[grade] }}</b>
    </button>
  </div>
</template>
