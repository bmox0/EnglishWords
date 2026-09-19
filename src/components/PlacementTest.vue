<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef} from "vue"

import {checkAnswer, LIMITS} from "../domain/check"
import {FIELD_LABEL, GRADE_LABEL, taskLabel} from "../domain/labels"
import {display} from "../domain/notes"
import {buildPlacement, gradeOf, notesFor, SKILLS} from "../domain/placement"
import {useStudy} from "../store/study"
import ChoiceOptions from "./ChoiceOptions.vue"

import type {Verdict} from "../domain/check"
import type {AnswerInput, AnswerMode} from "../domain/exercise"
import type {Note} from "../domain/notes"
import type {PlacementAnswer, PlacementQuestion, Skill} from "../domain/placement"
import type {Grade} from "../domain/scheduler"

const open = defineModel<boolean>("open", {required: true})

const SECONDS_PER_QUESTION: Record<AnswerMode, number> = {choice: 4, type: 8, both: 6}
const WORD_COUNTS = [100, 50, 20]
const MIN_ANSWER_MS = 250
const MODE_TEXT: Record<AnswerMode, string> = {
  both: "type the answer or pick one of the four options below the field",
  type: "every answer is typed",
  choice: "every answer is picked from four options",
}

const study = useStudy()
const stage = ref<"intro" | "run" | "results">("intro")
const selected = ref<Skill[]>(SKILLS.map((s) => s.key))
const wordCount = ref<number | null>(null)
const questions = shallowRef<PlacementQuestion[]>([])
const answers = ref<PlacementAnswer[]>([])
const index = ref(0)
const applied = ref<number | null>(null)
const typed = ref("")
const other = ref<Note | null>(null)
const input = ref<HTMLInputElement | null>(null)
let shownAt = 0

const notesById = computed(() => new Map(study.notes.map((n) => [n.id, n])))
const skillNotes = (key: Skill) => notesFor(key, study.notes)

const counts = computed(() => Object.fromEntries(SKILLS.map((s) => [s.key, skillNotes(s.key).length])) as Record<Skill, number>)
const most = computed(() => Math.max(0, ...selected.value.map((key) => counts.value[key])))
const wordChoices = computed(() => WORD_COUNTS.filter((n) => n < most.value))
const limit = computed(() => (wordCount.value !== null && wordCount.value < most.value ? wordCount.value : null))
const asked = (key: Skill) => Math.min(counts.value[key], limit.value ?? Infinity)
const total = computed(() => selected.value.reduce((sum, key) => sum + asked(key), 0))
const minutes = computed(() => Math.max(1, Math.round((total.value * SECONDS_PER_QUESTION[study.state.settings.answerMode]) / 60)))

const question = computed(() => questions.value[index.value] ?? null)
const note = computed(() => (question.value ? notesById.value.get(question.value.noteId) : undefined))
const prompt = computed(() => (question.value && note.value ? display(note.value, question.value.given) : ""))
const sub = computed(() => (question.value?.given === "ru" && note.value?.hint ? `(${note.value.hint})` : ""))
const task = computed(() => taskLabel(question.value?.given ?? "v1", question.value?.ask ?? "ru"))
const progress = computed(() => `${(index.value / Math.max(1, questions.value.length)) * 100}%`)

const summary = computed(() =>
  SKILLS.flatMap((s) => {
    const list = answers.value.filter((a) => a.skill === s.key)
    if (!list.length) return []
    const count = (grade: Grade) => list.filter((a) => gradeOf(a) === grade).length
    const times = list
      .filter((a) => a.verdict !== "wrong")
      .map((a) => a.ms)
      .sort((a, b) => a - b)
    const median = times.length ? `${((times[Math.floor(times.length / 2)] ?? 0) / 1000).toFixed(1)} s` : "—"
    return [{label: s.label, asked: list.length, good: count(3), hard: count(2), again: count(1), median}]
  }),
)

const GRADES: Grade[] = [1, 2, 3]

const answerFilter = ref<Grade | "all">("all")

const answerRows = computed(() =>
  answers.value
    .flatMap((a, order) => {
      const n = notesById.value.get(a.noteId)
      const s = SKILLS.find((x) => x.key === a.skill)
      if (!n || !s) return []
      const grade = gradeOf(a)
      return [
        {
          key: `${a.noteId}:${a.skill}`,
          order,
          skill: s.label,
          prompt: display(n, s.given),
          answer: display(n, s.ask),
          text: a.text,
          verdict: a.verdict,
          ms: a.ms,
          grade,
        },
      ]
    })
    .sort((a, b) => a.grade - b.grade || a.order - b.order),
)

const gradeCounts = computed(
  () => Object.fromEntries(GRADES.map((g) => [g, answerRows.value.filter((r) => r.grade === g).length])) as Record<Grade, number>,
)
const shownRows = computed(() => (answerFilter.value === "all" ? answerRows.value : answerRows.value.filter((r) => r.grade === answerFilter.value)))

function answerClass(row: {text: string | null; verdict: Verdict}): string {
  if (row.text === null) return "muted"
  return row.verdict === "right" ? "ok" : row.verdict === "close" ? "ok-slow" : "bad"
}

function focusInput() {
  nextTick(() => input.value?.focus({preventScroll: true}))
}

function start() {
  questions.value = buildPlacement(study.notes, selected.value, limit.value ?? Infinity, study.state.settings.answerMode)
  answers.value = []
  index.value = 0
  applied.value = null
  answerFilter.value = "all"
  typed.value = ""
  other.value = null
  stage.value = "run"
  shownAt = performance.now()
  focusInput()
}

function record(text: string | null, verdict: Verdict, mode: AnswerInput) {
  const q = question.value
  const ms = performance.now() - shownAt
  if (!q || ms < MIN_ANSWER_MS) return
  answers.value.push({noteId: q.noteId, skill: q.skill, mode, text, verdict, ms: Math.round(ms)})
  index.value++
  typed.value = ""
  other.value = null
  shownAt = performance.now()
  if (index.value >= questions.value.length) stage.value = "results"
  else if (question.value?.mode !== "choice") focusInput()
}

function choose(option: string | null) {
  const q = question.value
  const n = note.value
  if (!q || !n) return
  record(option, option !== null && option === display(n, q.ask) ? "right" : "wrong", "choice")
}

function submitTyped() {
  const q = question.value
  const n = note.value
  if (!q || !n) return
  const result = checkAnswer(n, q, typed.value, study.notes)
  if (result.kind === "other") {
    other.value = result.other
    typed.value = ""
    return
  }
  record(typed.value.trim() || null, result.verdict, "type")
}

function finish() {
  stage.value = answers.value.length ? "results" : "intro"
}

function apply() {
  applied.value = study.applyPlacement(answers.value)
}

function close() {
  if (stage.value === "run" && answers.value.length && !window.confirm("Stop the test? Your answers will be lost. Use Finish now to keep them."))
    return
  open.value = false
  stage.value = "intro"
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value || event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === "Escape" && stage.value !== "run") {
    close()
    return
  }
  if (stage.value !== "run" || !question.value?.options.length) return
  if (["1", "2", "3", "4"].includes(event.key)) {
    event.preventDefault()
    const option = question.value.options[Number(event.key) - 1]
    if (option !== undefined) choose(option)
  } else if (event.key === "0") {
    event.preventDefault()
    choose(null)
  }
}

function onVisible() {
  if (document.visibilityState === "visible") shownAt = performance.now()
}

onMounted(() => {
  document.addEventListener("keydown", onKeydown)
  document.addEventListener("visibilitychange", onVisible)
})

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown)
  document.removeEventListener("visibilitychange", onVisible)
})
</script>

<template>
  <div v-if="open" class="test" role="dialog" aria-modal="true" aria-labelledby="test-title">
    <div class="test-inner">
      <div class="test-top">
        <h2 id="test-title">Placement test</h2>
        <button type="button" class="icon-btn" aria-label="Close the test" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <section v-if="stage === 'intro'" class="test-section">
        <p class="test-lead">Go through a whole topic in one run. Saved answers count like answers on the cards, and study goes on from them.</p>
        <ul class="test-rules">
          <li>Answer as fast as you can. The next question comes right away, with no feedback.</li>
          <li>Questions follow Settings → Answers: {{ MODE_TEXT[study.state.settings.answerMode] }}.</li>
          <li><b class="lv g3">Good</b> — right.</li>
          <li>
            <b class="lv g2">Hard</b> — typed with a typo, or right but over {{ LIMITS.choice.slow / 1000 }} s ({{ LIMITS.type.slow / 1000 }} s when
            typing).
          </li>
          <li><b class="lv g1">Again</b> — wrong or Don't know: the card comes back in a minute.</li>
        </ul>

        <fieldset class="skill-picks">
          <legend>What to check</legend>
          <label v-for="s in SKILLS" :key="s.key" class="pick">
            <input v-model="selected" class="check" type="checkbox" :value="s.key" />
            <span class="pick-label">{{ s.label }}</span>
            <span class="pick-count">{{ asked(s.key) }} words</span>
          </label>
        </fieldset>

        <div class="word-count">
          <span id="word-count-label">Words</span>
          <div class="chips" role="group" aria-labelledby="word-count-label">
            <button type="button" class="chip" :class="{on: limit === null}" :aria-pressed="limit === null" @click="wordCount = null">All</button>
            <button
              v-for="n in wordChoices"
              :key="n"
              type="button"
              class="chip"
              :class="{on: limit === n}"
              :aria-pressed="limit === n"
              @click="wordCount = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <p class="msg">
          {{ total }} questions, about {{ minutes }} min.
          <template v-if="limit !== null">Each skill takes the first {{ limit }} words of the list.</template>
          You can stop at any time and keep what you answered.
        </p>
        <div class="settings-actions">
          <button type="button" class="btn primary" :disabled="!total" @click="start">Start</button>
          <button type="button" class="btn" @click="close">Cancel</button>
        </div>
      </section>

      <section v-else-if="stage === 'run' && question" class="test-section">
        <div class="meta">
          <span
            >To <b>{{ task.name }}</b> ({{ task.direction }})</span
          >
          <span>{{ index + 1 }} / {{ questions.length }}</span>
        </div>
        <div class="test-bar" aria-hidden="true"><i :style="{width: progress}" /></div>
        <h1 class="prompt" :lang="question.given === 'ru' ? 'ru' : 'en'" :style="{'--len': Math.max(6, prompt.length)}">{{ prompt }}</h1>
        <div v-if="sub" class="sub" lang="ru">{{ sub }}</div>

        <div v-if="question.mode !== 'choice'" class="fields">
          <div class="field">
            <input
              ref="input"
              v-model="typed"
              type="text"
              :placeholder="question.ask === 'ru' ? 'in Russian' : 'in English'"
              :lang="question.ask === 'ru' ? 'ru' : 'en'"
              :aria-label="FIELD_LABEL[question.ask]"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="go"
              @keydown.enter.prevent="submitTyped"
            />
            <div class="cap">{{ FIELD_LABEL[question.ask] }}</div>
          </div>
        </div>

        <ChoiceOptions
          v-if="question.options.length"
          :key="index"
          :options="question.options"
          correct=""
          :chosen="null"
          :result="null"
          :lang="question.ask === 'ru' ? 'ru' : 'en'"
          @choose="(i) => choose(question?.options[i] ?? null)"
        />
        <div v-if="other" class="msg" role="status">
          <b lang="en">{{ other.en }}</b> also means «<span lang="ru">{{ display(other, "ru") }}</span
          >», but a different verb is asked here. Try again.
        </div>

        <div v-if="question.mode === 'choice'" class="hint">
          <span class="keys"><kbd>1</kbd>–<kbd>4</kbd> pick</span>
          <button type="button" class="text-btn" @click="choose(null)">Don't know</button>
          <span class="keys"><kbd>0</kbd></span>
          <button type="button" class="text-btn" @click="finish">Finish now</button>
        </div>
        <div v-else class="hint">
          <button type="button" class="check-btn" @mousedown.prevent @click="submitTyped">Next</button>
          <span class="keys"><kbd>Enter</kbd> next</span>
          <span v-if="question.mode === 'both'" class="keys"><kbd>1</kbd>–<kbd>4</kbd> pick</span>
          <span>Empty means don't know</span>
          <button type="button" class="text-btn" @click="finish">Finish now</button>
        </div>
      </section>

      <section v-else-if="stage === 'results'" class="test-section">
        <table class="cards-of test-summary">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Asked</th>
              <th class="lv g3">Good</th>
              <th class="lv g2">Hard</th>
              <th class="lv g1">Again</th>
              <th>Median</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summary" :key="row.label">
              <td>{{ row.label }}</td>
              <td>{{ row.asked }}</td>
              <td>{{ row.good }}</td>
              <td>{{ row.hard }}</td>
              <td>{{ row.again }}</td>
              <td>{{ row.median }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="applied === null" class="settings-actions">
          <button type="button" class="btn primary" @click="apply">Save answers</button>
          <button type="button" class="btn" @click="close">Discard</button>
        </div>
        <div v-else class="settings-actions" role="status">
          <span class="muted">{{ applied }} cards updated. The answers are in the table under Today.</span>
          <button type="button" class="btn primary" @click="close">Start studying</button>
        </div>

        <div class="detail-h">Your answers</div>
        <div class="chips" role="group" aria-label="Filter answers">
          <button
            type="button"
            class="chip"
            :class="{on: answerFilter === 'all'}"
            :aria-pressed="answerFilter === 'all'"
            @click="answerFilter = 'all'"
          >
            All <b>{{ answerRows.length }}</b>
          </button>
          <button
            v-for="g in GRADES"
            :key="g"
            type="button"
            class="chip"
            :class="{on: answerFilter === g}"
            :aria-pressed="answerFilter === g"
            @click="answerFilter = g"
          >
            {{ GRADE_LABEL[g] }} <b>{{ gradeCounts[g] }}</b>
          </button>
        </div>
        <table v-if="shownRows.length" class="cards-of test-answers">
          <thead>
            <tr>
              <th>Question</th>
              <th>Answer</th>
              <th>You</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in shownRows" :key="row.key">
              <td>
                {{ row.prompt }}<span v-if="summary.length > 1" class="test-skill">{{ row.skill }}</span>
              </td>
              <td>{{ row.answer }}</td>
              <td :class="answerClass(row)">{{ row.text ?? "don't know" }}</td>
              <td>
                <span class="lv" :class="`g${row.grade}`">{{ GRADE_LABEL[row.grade] }}</span>
                <span class="test-skill">{{ (row.ms / 1000).toFixed(1) }} s</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">No answers here.</p>
      </section>
    </div>
  </div>
</template>
