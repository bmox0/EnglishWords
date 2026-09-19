<script setup lang="ts">
import type {Verdict} from "../domain/check"

const props = defineProps<{options: string[]; correct: string; chosen: number | null; result: Verdict | null; lang: string}>()
const emit = defineEmits<{choose: [index: number]}>()

function stateOf(index: number): string {
  if (!props.result) return ""
  if (props.options[index] === props.correct) return "right"
  return index === props.chosen ? "wrong" : "dim"
}
</script>

<template>
  <div class="opts" :class="{answered: !!result}" role="group" aria-label="Answer options">
    <button
      v-for="(option, index) in options"
      :key="option"
      type="button"
      class="opt"
      :class="stateOf(index)"
      :aria-keyshortcuts="result ? undefined : String(index + 1)"
      @click="emit('choose', index)"
    >
      <kbd class="keys">{{ index + 1 }}</kbd>
      <span :lang="lang">{{ option }}</span>
    </button>
  </div>
</template>
