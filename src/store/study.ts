import {computed, inject, markRaw, reactive} from "vue"

import {buildCards, groupByNote, stateOf} from "../domain/cards"
import {checkAnswer, suggestGrade} from "../domain/check"
import {freshDay, rollDay} from "../domain/day"
import {makeExercise, modeFor} from "../domain/exercise"
import {seedState} from "../domain/placement"
import {buildQueue, pickNext} from "../domain/queue"
import {display} from "../domain/notes"
import {nextState} from "../domain/scheduler"
import {loadSaved, parseSaved, writeSaved} from "../domain/storage"

import type {Card} from "../domain/cards"
import type {Verdict} from "../domain/check"
import type {DayProgress} from "../domain/day"
import type {Exercise} from "../domain/exercise"
import type {Note} from "../domain/notes"
import type {Level} from "../domain/placement"
import type {CardState, Grade} from "../domain/scheduler"
import type {KeyValueStore, Saved, Settings} from "../domain/storage"
import type {InjectionKey} from "vue"

/** The question on screen and what has happened to it so far. */
export interface Session {
  cardId: string | null
  exercise: Exercise | null
  answer: string
  result: Verdict | null
  chosen: number | null
  other: Note | null
  peeked: boolean
}

/** An extra drill over cards with mistakes; it never changes the schedule. */
export interface Practice {
  cardIds: string[]
  index: number
  right: number
}

/** Per-note answers of today, for the table. */
export interface TodayInfo {
  entries: DayProgress["done"]
  wrong: boolean
  last: Grade
}

/** How many cards "Learn more" adds to today's new-card limit. */
export const LEARN_MORE = 10

/** The most cards one practice round takes. */
export const PRACTICE_SIZE = 20

const freshSession = (): Session => ({cardId: null, exercise: null, answer: "", result: null, chosen: null, other: null, peeked: false})

/** Creates the study state: cards, today's queue, the current question, and persistence to `store`. */
export function createStudy(notes: Note[], store: KeyValueStore | null, clock: () => number = Date.now, random: () => number = Math.random) {
  const allNotes = notes.map((note) => markRaw(note))
  const initial = loadSaved(store, clock())
  let savedCards: Record<string, CardState> = {...initial.cards}

  const state = reactive({
    now: clock(),
    day: rollDay(initial.day, clock()),
    settings: initial.settings,
    tableOpen: initial.tableOpen,
    cards: buildCards(allNotes, initial.settings.formsFor, savedCards) as Card[],
    session: freshSession(),
    practice: null as Practice | null,
    practiceResult: null as {right: number; total: number} | null,
    storageOk: true,
  })

  const newLimit = computed(() => state.settings.newPerDay + state.day.extraNew)
  const queue = computed(() => buildQueue(state.cards, state.day, state.now, newLimit.value))
  const canLearnMore = computed(
    () => buildQueue(state.cards, state.day, state.now, newLimit.value + LEARN_MORE).news.length > queue.value.news.length,
  )
  const mistakeIds = computed(() => {
    const wrongToday = new Set(state.day.done.filter((d) => !d.ok || d.grade === 1).map((d) => d.cardId))
    return state.cards.filter((c) => c.type !== "new" && (wrongToday.has(c.id) || c.lapses > 0)).map((c) => c.id)
  })
  const current = computed(() => (state.session.cardId ? (state.cards.find((c) => c.id === state.session.cardId) ?? null) : null))
  const suggested = computed(() => (state.session.result ? suggestGrade(state.session.result, state.session.peeked) : null))

  const cardsByNote = computed(() => groupByNote(state.cards))

  const today = computed(() => {
    const map = new Map<string, TodayInfo>()
    for (const entry of state.day.done) {
      const info = map.get(entry.noteId) ?? {entries: [], wrong: false, last: entry.grade}
      info.entries.push(entry)
      info.last = entry.grade
      if (entry.grade === 1) info.wrong = true
      map.set(entry.noteId, info)
    }
    return map
  })

  function snapshot(): Saved {
    return {version: 1, cards: savedCards, day: state.day, settings: state.settings, tableOpen: state.tableOpen}
  }

  function persist() {
    for (const card of state.cards) if (card.type !== "new") savedCards[card.id] = stateOf(card)
    state.storageOk = writeSaved(store, snapshot())
  }

  function start(card: Card | null) {
    state.session = freshSession()
    if (!card) return
    state.session.cardId = card.id
    const today = {picked: state.day.done.filter((d) => d.mode === "choice").length, total: state.day.done.length}
    state.session.exercise = makeExercise(card, modeFor(card, state.settings.answerMode, today, random), allNotes, random)
  }

  function ensureCurrent() {
    if (!current.value) start(pickNext(queue.value, state.day))
  }

  function apply(saved: Saved) {
    const previous = current.value ? {id: current.value.id, reps: current.value.reps} : null
    const session = state.session
    savedCards = {...saved.cards}
    state.now = clock()
    state.day = rollDay(saved.day, state.now)
    state.settings = saved.settings
    state.tableOpen = saved.tableOpen
    state.cards = buildCards(allNotes, saved.settings.formsFor, savedCards)
    const same = previous && state.cards.find((c) => c.id === previous.id)?.reps === previous.reps
    if (!same) state.practice = null
    state.session = same ? session : freshSession()
    ensureCurrent()
  }

  /** Advances the clock, rolls the day over at 4:00 and brings back learning cards that became due. */
  function tick() {
    state.now = clock()
    const day = rollDay(state.day, state.now)
    if (day !== state.day) {
      state.day = day
      persist()
    }
    ensureCurrent()
  }

  function setAnswer(text: string) {
    if (!state.session.result) state.session.answer = text
  }

  /** Checks the typed answer; an empty answer counts as "don't remember". */
  function check() {
    const card = current.value
    const exercise = state.session.exercise
    if (!card || exercise?.mode !== "type" || state.session.result) return
    const result = checkAnswer(card.note, exercise, state.session.answer, allNotes)
    if (result.kind === "other") {
      state.session.other = result.other
      state.session.answer = ""
      return
    }
    state.session.other = null
    state.session.result = result.verdict
  }

  /** Answers a choice question with the option at `index`. */
  function choose(index: number) {
    const card = current.value
    const exercise = state.session.exercise
    const option = exercise?.options[index]
    if (!card || exercise?.mode !== "choice" || option === undefined || state.session.result) return
    state.session.chosen = index
    state.session.result = option === display(card.note, exercise.ask) ? "right" : "wrong"
  }

  /** Gives up on a choice question without guessing. */
  function giveUp() {
    if (current.value && state.session.exercise?.mode === "choice" && !state.session.result) state.session.result = "wrong"
  }

  /** Raises today's new-card limit so more new cards come up. */
  function learnMore() {
    state.practiceResult = null
    state.day.extraNew += LEARN_MORE
    persist()
    ensureCurrent()
  }

  function startPracticeCard() {
    const practice = state.practice
    start(practice ? (state.cards.find((c) => c.id === practice.cardIds[practice.index]) ?? null) : null)
  }

  /** Starts a practice round over up to 20 cards with mistakes, in random order; answers there do not touch the schedule. */
  function startPractice() {
    const ids = [...mistakeIds.value]
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j] as string, ids[i] as string]
    }
    if (!ids.length) return
    state.practiceResult = null
    state.practice = {cardIds: ids.slice(0, PRACTICE_SIZE), index: 0, right: 0}
    startPracticeCard()
  }

  /** Moves a practice round to its next card, or ends it with a score after the last one. */
  function practiceNext() {
    const practice = state.practice
    if (!practice || !state.session.result) return
    if (state.session.result === "right" && !state.session.peeked) practice.right++
    practice.index++
    if (practice.index < practice.cardIds.length) {
      startPracticeCard()
      return
    }
    state.practiceResult = {right: practice.right, total: practice.cardIds.length}
    endPractice()
  }

  function endPractice() {
    state.practice = null
    state.session = freshSession()
    ensureCurrent()
  }

  /** Records the grade for the checked card, saves progress and moves to the next card. */
  function grade(value: Grade) {
    const card = current.value
    const exercise = state.session.exercise
    const result = state.session.result
    if (!card || !exercise || !result || state.practice) return
    state.now = clock()
    state.day = rollDay(state.day, state.now)
    if (card.type === "new") {
      state.day.newDone++
      if (!state.day.introduced.includes(card.note.id)) state.day.introduced.push(card.note.id)
    }
    if (card.type === "review") state.day.revDone++
    Object.assign(card, nextState(stateOf(card), value, state.now, random))
    state.day.done.push({
      cardId: card.id,
      noteId: card.note.id,
      grade: value,
      given: exercise.given,
      ask: exercise.ask,
      text: exercise.mode === "choice" ? (exercise.options[state.session.chosen ?? -1] ?? "") : state.session.answer,
      ok: result === "right",
      mode: exercise.mode,
    })
    persist()
    state.session = freshSession()
    ensureCurrent()
  }

  /** Reveals the current card's row in the table; the grade offered after checking becomes Again. */
  function peek() {
    if (current.value && !state.session.result) state.session.peeked = true
  }

  function setTableOpen(open: boolean) {
    state.tableOpen = open
    persist()
  }

  function updateSettings(patch: Partial<Settings>) {
    const formsChanged = patch.formsFor !== undefined && patch.formsFor !== state.settings.formsFor
    state.settings = {...state.settings, ...patch}
    if (formsChanged) state.cards = buildCards(allNotes, state.settings.formsFor, savedCards)
    persist()
    if (patch.answerMode && current.value && !state.session.result) start(current.value)
    ensureCurrent()
  }

  /** Replaces the state of every tested card with the one its placement level gives; returns how many cards changed. */
  function applyPlacement(levels: Map<string, Level>): number {
    state.now = clock()
    let changed = 0
    for (const card of state.cards) {
      const level = levels.get(card.id)
      if (!level) continue
      Object.assign(card, seedState(level, state.now, random))
      if (card.type === "new") delete savedCards[card.id]
      changed++
    }
    persist()
    state.session = freshSession()
    ensureCurrent()
    return changed
  }

  function exportProgress(): string {
    return JSON.stringify(snapshot(), null, 2)
  }

  /** Replaces all progress with an exported file; returns false when the file is not a valid export. */
  function importProgress(json: string): boolean {
    let saved: Saved | null
    try {
      saved = parseSaved(JSON.parse(json), clock())
    } catch {
      return false
    }
    if (!saved) return false
    apply(saved)
    persist()
    return true
  }

  function resetProgress() {
    savedCards = {}
    state.now = clock()
    state.day = freshDay(state.now)
    state.cards = buildCards(allNotes, state.settings.formsFor, savedCards)
    state.practice = null
    state.session = freshSession()
    persist()
    ensureCurrent()
  }

  /** Picks up progress written by another tab. */
  function reloadFromStorage() {
    apply(loadSaved(store, clock()))
  }

  ensureCurrent()

  return {
    notes: allNotes,
    state,
    queue,
    current,
    suggested,
    canLearnMore,
    mistakeIds,
    cardsByNote,
    today,
    tick,
    setAnswer,
    check,
    choose,
    giveUp,
    grade,
    learnMore,
    startPractice,
    practiceNext,
    endPractice,
    peek,
    setTableOpen,
    updateSettings,
    applyPlacement,
    exportProgress,
    importProgress,
    resetProgress,
    reloadFromStorage,
  }
}

export type Study = ReturnType<typeof createStudy>

export const StudyKey: InjectionKey<Study> = Symbol("study")

/** The study state provided by the app root. */
export function useStudy(): Study {
  const study = inject(StudyKey)
  if (!study) throw new Error("useStudy() called outside the app")
  return study
}
