<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue"

import {maturity} from "../domain/cards"
import {normalize} from "../domain/check"
import {GRADE_LABEL, KIND_LABEL, MATURITY_LABEL} from "../domain/labels"
import {display} from "../domain/notes"
import {dayOf} from "../domain/scheduler"
import {useStudy} from "../store/study"
import VerbDetail from "./VerbDetail.vue"

import type {Card} from "../domain/cards"
import type {Note} from "../domain/notes"

const props = defineProps<{compact: boolean}>()
const emit = defineEmits<{close: []}>()

type FilterKey = "all" | "today" | "mistakes" | "learning" | "new" | "learned"

const study = useStudy()
const search = ref("")
const filter = ref<FilterKey>("all")
const selected = ref<string | null>(null)
const root = ref<HTMLElement | null>(null)
const top = ref<HTMLElement | null>(null)

const columns = computed(() => (props.compact ? 4 : 5))

const cardsOf = (note: Note): Card[] => study.cardsByNote.value.get(note.id) ?? []

const FILTERS: {key: FilterKey; label: string; test: (note: Note) => boolean}[] = [
  {key: "all", label: "All", test: () => true},
  {key: "today", label: "Today", test: (n) => study.today.value.has(n.id)},
  {key: "mistakes", label: "Mistakes", test: (n) => !!study.today.value.get(n.id)?.wrong || cardsOf(n).some((c) => c.lapses > 0)},
  {key: "learning", label: "Learning", test: (n) => cardsOf(n).some((c) => maturity(c) === "learn")},
  {key: "new", label: "New", test: (n) => cardsOf(n).every((c) => c.type === "new")},
  {key: "learned", label: "Learned", test: (n) => cardsOf(n).every((c) => c.type === "review")},
]

const filterCounts = computed(() => Object.fromEntries(FILTERS.map((f) => [f.key, study.notes.filter(f.test).length])) as Record<FilterKey, number>)

const rows = computed(() => {
  const test = FILTERS.find((f) => f.key === filter.value)?.test ?? (() => true)
  const query = normalize(search.value)
  return study.notes.filter(
    (note) => test(note) && (!query || [note.en, ...(note.v2 ?? []), ...(note.v3 ?? []), ...note.ru].some((w) => normalize(w).includes(query))),
  )
})

const counts = computed(() => {
  const q = study.queue.value
  return {news: q.news.length, learn: q.learnDue.length + q.learnAhead.length, reviews: q.reviews.length}
})

const stats = computed(() => {
  const today = study.state.day.index
  const reviews = study.state.cards.filter((c) => c.type === "review")
  const within = (days: number) => reviews.filter((c) => dayOf(c.due) > today && dayOf(c.due) <= today + days).length
  return {learned: reviews.length, total: study.state.cards.length, tomorrow: within(1), week: within(7)}
})

function isMasked(note: Note): boolean {
  const s = study.state.session
  return study.current.value?.note.id === note.id && !s.result && !s.peeked
}

function toggle(noteId: string) {
  selected.value = selected.value === noteId ? null : noteId
}

function todayDot(note: Note): {grade: number; title: string} | null {
  const info = study.today.value.get(note.id)
  if (!info) return null
  return info.wrong ? {grade: 1, title: "A mistake today"} : {grade: info.last, title: `Today: ${GRADE_LABEL[info.last]}`}
}

function segsTitle(note: Note): string {
  return cardsOf(note)
    .map((c) => `${KIND_LABEL[c.kind]}: ${MATURITY_LABEL[maturity(c)]}`)
    .join("\n")
}

let observer: ResizeObserver | null = null

onMounted(() => {
  observer = new ResizeObserver(() => root.value?.style.setProperty("--sticky-top", `${top.value?.offsetHeight ?? 0}px`))
  if (top.value) observer.observe(top.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <aside id="verb-table" ref="root" class="ref" aria-label="Verb table">
    <div ref="top" class="ref-top">
      <div class="ref-search-row">
        <input
          v-model="search"
          data-no-hotkeys
          class="search"
          type="search"
          placeholder="Search: go, went, идти"
          aria-label="Search words"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <div class="counts" :aria-label="`Left today: ${counts.news} new, ${counts.learn} learning, ${counts.reviews} to review`">
          <span class="cnt new" :class="{zero: !counts.news}" title="New">{{ counts.news }}</span>
          <span class="cnt learn" :class="{zero: !counts.learn}" title="Learning">{{ counts.learn }}</span>
          <span class="cnt rev" :class="{zero: !counts.reviews}" title="To review">{{ counts.reviews }}</span>
        </div>
        <button v-if="compact" type="button" class="icon-btn" aria-label="Close table" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div class="chips" role="group" aria-label="Filter">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="chip"
          :class="{on: filter === f.key}"
          :aria-pressed="filter === f.key"
          @click="filter = f.key"
        >
          {{ f.label }} <b>{{ filterCounts[f.key] }}</b>
        </button>
      </div>
    </div>

    <table v-if="rows.length" class="rows">
      <thead>
        <tr>
          <th>Infinitive</th>
          <th>Past simple</th>
          <th>Past participle</th>
          <th v-if="!compact">Translation</th>
          <th><span class="sr">Progress</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="note in rows" :key="note.id">
          <tr
            v-if="isMasked(note)"
            class="masked"
            tabindex="0"
            title="Peek at the answer"
            @click="study.peek()"
            @keydown.enter.prevent="study.peek()"
          >
            <td :colspan="columns">On the card now — tap to peek</td>
          </tr>
          <template v-else>
            <tr
              class="row"
              :class="{sel: selected === note.id}"
              tabindex="0"
              :aria-expanded="selected === note.id"
              @click="toggle(note.id)"
              @keydown.enter.prevent="toggle(note.id)"
            >
              <td class="w" lang="en">
                <i v-if="todayDot(note)" class="dot" :class="`g${todayDot(note)?.grade}`" :title="todayDot(note)?.title" />{{ note.en }}
                <span v-if="compact" class="ru-inline" lang="ru">{{ display(note, "ru") }}</span>
              </td>
              <td class="w" :class="{reg: !note.irregular}" lang="en">{{ note.v2 ? display(note, "v2") : "—" }}</td>
              <td class="w" :class="{reg: !note.irregular}" lang="en">{{ note.v3 ? display(note, "v3") : "—" }}</td>
              <td v-if="!compact" class="ru" lang="ru">{{ display(note, "ru") }}</td>
              <td>
                <span class="segs" :title="segsTitle(note)"><i v-for="card in cardsOf(note)" :key="card.id" :class="maturity(card)" /></span>
              </td>
            </tr>
            <tr v-if="selected === note.id" class="detail">
              <td :colspan="columns"><VerbDetail :note="note" /></td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
    <p v-else class="muted nothing">Nothing found.</p>

    <div class="ref-meta">
      <div class="stats">
        <span
          >Learned <b>{{ stats.learned }}</b> of {{ stats.total }} cards</span
        >
        <span
          >Tomorrow <b>{{ stats.tomorrow }}</b></span
        >
        <span
          >This week <b>{{ stats.week }}</b></span
        >
      </div>
      <div class="legend">
        <span><i class="l-new" />new</span>
        <span><i class="l-learn" />learning</span>
        <span><i class="l-young" />young</span>
        <span><i class="l-mature" />mature</span>
      </div>
    </div>
  </aside>
</template>
