import {freshDay} from "./day"

import type {FormsFor} from "./cards"
import type {DayProgress, DoneEntry} from "./day"
import type {CardState, CardType} from "./scheduler"

export const STORAGE_KEY = "english-words:v1"

/** User settings. */
export interface Settings {
  newPerDay: number
  formsFor: FormsFor
}

/** Everything kept in localStorage; cards are keyed by card id and only answered cards are stored. */
export interface Saved {
  version: 1
  cards: Record<string, CardState>
  day: DayProgress
  settings: Settings
  tableOpen: boolean
}

export const DEFAULT_SETTINGS: Settings = {newPerDay: 20, formsFor: "irregular"}

/** Minimal storage surface, so tests can pass a fake. */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">

const CARD_TYPES: CardType[] = ["new", "learning", "relearning", "review"]
const FIELDS = ["ru", "v1", "v2", "v3"]

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)

/** A fresh save for a first visit. */
export function emptySaved(t: number): Saved {
  return {version: 1, cards: {}, day: freshDay(t), settings: {...DEFAULT_SETTINGS}, tableOpen: true}
}

function readCard(value: unknown): CardState | null {
  if (!isObject(value) || !CARD_TYPES.includes(value.type as CardType)) return null
  const {step, due, ivl, ease, reps, lapses} = value
  if (![step, due, ivl, ease, reps, lapses].every(isNumber)) return null
  return {type: value.type as CardType, step, due, ivl, ease, reps, lapses} as CardState
}

function readDone(value: unknown): DoneEntry | null {
  if (!isObject(value)) return null
  const {cardId, noteId, grade, given, ask, text, ok} = value
  if (typeof cardId !== "string" || typeof noteId !== "string" || typeof text !== "string" || typeof ok !== "boolean") return null
  if (![1, 2, 3, 4].includes(grade as number) || !FIELDS.includes(given as string) || !FIELDS.includes(ask as string)) return null
  return value as unknown as DoneEntry
}

function readDay(value: unknown, t: number): DayProgress {
  if (!isObject(value) || !isNumber(value.index) || !isNumber(value.newDone) || !isNumber(value.revDone)) return freshDay(t)
  const touched = Array.isArray(value.touched) ? value.touched.filter((x): x is string => typeof x === "string") : []
  const done = Array.isArray(value.done) ? value.done.map(readDone).filter((x): x is DoneEntry => x !== null) : []
  return {index: value.index, newDone: value.newDone, revDone: value.revDone, touched, done}
}

function readSettings(value: unknown): Settings {
  if (!isObject(value)) return {...DEFAULT_SETTINGS}
  const newPerDay = isNumber(value.newPerDay) ? Math.min(500, Math.max(0, Math.round(value.newPerDay))) : DEFAULT_SETTINGS.newPerDay
  const formsFor = value.formsFor === "all" || value.formsFor === "irregular" ? value.formsFor : DEFAULT_SETTINGS.formsFor
  return {newPerDay, formsFor}
}

/** Reads a save from untrusted JSON, dropping anything malformed; returns null when it is not a save at all. */
export function parseSaved(value: unknown, t: number): Saved | null {
  if (!isObject(value) || value.version !== 1 || !isObject(value.cards)) return null
  const cards: Record<string, CardState> = {}
  for (const [id, raw] of Object.entries(value.cards)) {
    const card = readCard(raw)
    if (card) cards[id] = card
  }
  return {
    version: 1,
    cards,
    day: readDay(value.day, t),
    settings: readSettings(value.settings),
    tableOpen: typeof value.tableOpen === "boolean" ? value.tableOpen : true,
  }
}

/** Loads the save, falling back to an empty one when storage is unavailable or corrupt. */
export function loadSaved(store: KeyValueStore | null, t: number): Saved {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    return (raw && parseSaved(JSON.parse(raw), t)) || emptySaved(t)
  } catch {
    return emptySaved(t)
  }
}

/** Writes the save; returns false when the browser refuses (private mode, quota). */
export function writeSaved(store: KeyValueStore | null, saved: Saved): boolean {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(saved))
    return !!store
  } catch {
    return false
  }
}
