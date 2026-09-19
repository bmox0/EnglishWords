<script setup lang="ts">
import {computed, nextTick, onMounted, ref, watch} from "vue"

import {formatMinutes, plural} from "../domain/format"
import {FIELD_LABEL, taskLabel} from "../domain/labels"
import {display} from "../domain/notes"
import {remainingCount} from "../domain/queue"
import {dayOf, MINUTE} from "../domain/scheduler"
import {LEARN_MORE, PRACTICE_SIZE, useStudy} from "../store/study"
import ChoiceOptions from "./ChoiceOptions.vue"
import FormsRow from "./FormsRow.vue"
import GradeResult from "./GradeResult.vue"

const props = defineProps<{compact: boolean; tableVisible: boolean; blocked: boolean}>()
const emit = defineEmits<{"toggle-table": []; "open-settings": []; "open-test": []}>()

const study = useStudy()
const session = computed(() => study.state.session)
const card = study.current
const input = ref<HTMLInputElement | null>(null)
const after = ref<HTMLElement | null>(null)

const remaining = computed(() => remainingCount(study.queue.value))
const untouched = computed(() => study.state.cards.every((c) => c.type === "new"))
const upcoming = computed(() => Math.max(0, remaining.value - (card.value ? 1 : 0)))
const trackWide = computed(() => study.state.day.done.length + (card.value ? 1 : 0) + upcoming.value > 20)

const VERDICT_TEXT = {right: "Correct", close: "Almost: check the spelling", wrong: "Not quite"} as const

const sub = computed(() => {
  const exercise = session.value.exercise
  const note = card.value?.note
  if (!exercise || !note) return ""
  if (exercise.given === "ru" && note.hint) return `(${note.hint})`
  if (exercise.given === "v1" && card.value?.kind === "forms") return display(note, "ru")
  if (exercise.given === "v2" || exercise.given === "v3") return FIELD_LABEL[exercise.given]
  return ""
})

const task = computed(() => taskLabel(session.value.exercise?.given ?? "v1", session.value.exercise?.ask ?? "ru"))

const prompt = computed(() => (card.value && session.value.exercise ? display(card.value.note, session.value.exercise.given) : ""))

const empty = computed(() => {
  const later = study.queue.value.later
  const first = later[0]
  if (first) {
    return {
      title: "Break",
      text: `${plural(later.length, "card")} you are learning will be back in ${formatMinutes((first.due - study.state.now) / MINUTE)}.`,
    }
  }
  const tomorrow = study.state.cards.filter((c) => c.type === "review" && dayOf(c.due) === study.state.day.index + 1).length
  const hasNew = study.state.cards.some((c) => c.type === "new")
  const text = tomorrow ? `Tomorrow: ${plural(tomorrow, "review")}.` : hasNew ? "More new cards open tomorrow." : "Nothing is due tomorrow."
  return {title: "All done for today", text}
})

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  if (session.value.result) el.value = session.value.answer
  else study.setAnswer(el.value)
}

function onBeforeInput(event: InputEvent) {
  if (session.value.result) event.preventDefault()
}

function focusInput() {
  if (props.blocked) return
  const active = document.activeElement
  if (active && active !== document.body && active !== input.value && active.closest("[data-no-hotkeys], dialog, .ref")) return
  input.value?.focus({preventScroll: true})
}

watch(
  () => session.value.cardId,
  () => nextTick(focusInput),
)

watch(
  () => props.blocked,
  (blocked) => {
    if (!blocked) nextTick(focusInput)
  },
)

function toggleTable() {
  emit("toggle-table")
  if (!props.compact) nextTick(focusInput)
}

watch(
  () => session.value.result,
  (result) => {
    if (result && props.compact) nextTick(() => after.value?.scrollIntoView({block: "nearest"}))
  },
)

onMounted(focusInput)
</script>

<template>
  <section class="work" aria-label="Dictation">
    <div class="work-inner">
      <div class="work-top">
        <div class="track" :class="{wide: trackWide}" role="img" :aria-label="`Today: ${study.state.day.done.length} done, ${remaining} left`">
          <i v-for="(entry, index) in study.state.day.done" :key="index" :class="`g${entry.grade}`" />
          <i v-if="card" class="cur" />
          <i v-for="index in upcoming" :key="`next-${index}`" />
        </div>
        <div class="top-actions">
          <button type="button" class="icon-btn" aria-label="Placement test" title="Placement test" @click="emit('open-test')">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5M9 2h6" />
            </svg>
          </button>
          <button type="button" class="icon-btn" aria-label="Settings" title="Settings" @click="emit('open-settings')">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
          <button type="button" class="side-toggle" aria-controls="verb-table" :aria-expanded="tableVisible" @click="toggleTable">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M15 4v16" />
            </svg>
            {{ compact ? "Table" : tableVisible ? "Hide table" : "Show table" }}
          </button>
        </div>
      </div>

      <p v-if="untouched" class="msg intro-test">
        Already know some of these verbs?
        <button type="button" class="text-btn" @click="emit('open-test')">Take the placement test</button>
        to skip them.
      </p>

      <p v-if="!study.state.storageOk" class="warn" role="alert">This browser is not saving progress (private mode or full storage).</p>

      <div v-if="!card || !session.exercise" class="empty">
        <h2>{{ empty.title }}</h2>
        <p>{{ empty.text }}</p>
        <p v-if="study.state.practiceResult" class="practice-score">
          Practice: {{ study.state.practiceResult.right }} of {{ study.state.practiceResult.total }} right.
        </p>
        <div v-if="study.canLearnMore.value || study.mistakeIds.value.length" class="empty-actions">
          <button v-if="study.canLearnMore.value" type="button" class="btn primary" @click="study.learnMore()">
            Learn {{ LEARN_MORE }} more cards
          </button>
          <button v-if="study.mistakeIds.value.length" type="button" class="btn" @click="study.startPractice()">
            Practice mistakes · {{ Math.min(PRACTICE_SIZE, study.mistakeIds.value.length) }}
          </button>
        </div>
        <p v-if="study.mistakeIds.value.length" class="muted">Practice goes over cards you got wrong, without changing when they come back.</p>
      </div>

      <template v-else>
        <div class="meta">
          <span
            >To <b>{{ task.name }}</b> ({{ task.direction }})</span
          >
          <span v-if="study.state.practice">practice {{ study.state.practice.index + 1 }} / {{ study.state.practice.cardIds.length }}</span>
          <span v-else>{{ remaining }} left</span>
        </div>
        <h1 class="prompt" :lang="session.exercise.given === 'ru' ? 'ru' : 'en'" :style="{'--len': Math.max(6, prompt.length)}">{{ prompt }}</h1>
        <div v-if="sub" class="sub" :lang="session.exercise.given === 'v1' ? 'ru' : 'en'">{{ sub }}</div>

        <div v-if="session.exercise.mode !== 'choice'" class="fields">
          <div class="field" :class="session.result">
            <input
              ref="input"
              data-answer
              type="text"
              :value="session.answer"
              :placeholder="session.exercise.ask === 'ru' ? 'in Russian' : 'in English'"
              :lang="session.exercise.ask === 'ru' ? 'ru' : 'en'"
              :aria-label="FIELD_LABEL[session.exercise.ask]"
              :aria-readonly="!!session.result"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="go"
              @input="onInput"
              @beforeinput="onBeforeInput"
            />
            <div class="cap">{{ FIELD_LABEL[session.exercise.ask] }}</div>
          </div>
        </div>

        <ChoiceOptions
          v-if="session.exercise.options.length"
          :options="session.exercise.options"
          :correct="display(card.note, session.exercise.ask)"
          :chosen="session.chosen"
          :result="session.result"
          :lang="session.exercise.ask === 'ru' ? 'ru' : 'en'"
          @choose="study.choose"
        />
        <div v-if="session.other" class="msg" role="status">
          <b lang="en">{{ session.other.en }}</b> also means «<span lang="ru">{{ display(session.other, "ru") }}</span
          >», but a different verb is asked here. Try again.
        </div>
        <div v-if="session.peeked && !session.result && !study.state.practice" class="msg" role="status">
          You peeked at the table, so this card gets Again.
        </div>

        <div v-if="!session.result && session.exercise.mode === 'choice'" class="hint">
          <span class="keys"><kbd>1</kbd>–<kbd>4</kbd> pick an answer</span>
          <button type="button" class="text-btn" @click="study.giveUp()">Don't know</button>
        </div>
        <div v-else-if="!session.result" class="hint">
          <button type="button" class="check-btn" @mousedown.prevent @click="study.check()">Check</button>
          <span class="keys"><kbd>Enter</kbd> check</span>
          <span v-if="session.exercise.mode === 'both'" class="keys"><kbd>1</kbd>–<kbd>4</kbd> pick</span>
          <span>Leave it empty if you don't remember</span>
        </div>
        <div v-else ref="after" class="after">
          <p class="sr" role="status">{{ VERDICT_TEXT[session.result] }}</p>
          <FormsRow :note="card.note" :exercise="session.exercise" />
          <div v-if="study.state.practice" class="hint">
            <button type="button" class="btn primary" @mousedown.prevent @click="study.practiceNext()">Next</button>
            <span v-if="session.exercise.options.length">or tap any option again</span>
            <span class="keys"><kbd>Enter</kbd> next</span>
            <button type="button" class="text-btn" @click="study.endPractice()">End practice</button>
          </div>
          <template v-else-if="study.autoGrade.value">
            <div class="hint">
              <GradeResult :card="card" :grade="study.autoGrade.value" :reason="study.autoGradeReason.value" :now="study.state.now" />
              <button type="button" class="btn primary" @mousedown.prevent @click="study.next()">Next</button>
            </div>
            <div class="hint" :class="{keys: !session.exercise.options.length}">
              <span v-if="session.exercise.options.length">Tap any option again to go on</span>
              <span class="keys"><kbd>Enter</kbd> next</span>
              <span class="keys"><kbd>1</kbd>–<kbd>4</kbd> change the grade</span>
            </div>
          </template>
        </div>
      </template>
    </div>
  </section>
</template>
