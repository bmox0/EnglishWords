import {cardKinds} from "./cards"
import {buildOptions} from "./choices"
import {dayOf, dayStart, freshState, SCHEDULER} from "./scheduler"

import type {CardKind} from "./cards"
import type {Verdict} from "./check"
import type {Exercise} from "./exercise"
import type {Field, Note} from "./notes"
import type {CardState} from "./scheduler"

/** What a placement question checks. Both form skills feed the one forms card. */
export type Skill = "en_ru" | "ru_en" | "v2" | "v3"

/** How well a card is known after the test. */
export type Level = "known" | "shaky" | "unknown"

/** One placement question, answered by typing or by picking from `options`. */
export interface PlacementQuestion {
  noteId: string
  skill: Skill
  given: Field
  ask: Field
  mode: Exercise["mode"]
  options: string[]
}

/** One answer: `text` is null for "Don't know". */
export interface PlacementAnswer {
  noteId: string
  skill: Skill
  mode: Exercise["mode"]
  text: string | null
  verdict: Verdict
  ms: number
}

export const SKILLS: {key: Skill; label: string; given: Field; ask: Field; kind: CardKind}[] = [
  {key: "en_ru", label: "EN → RU", given: "v1", ask: "ru", kind: "en_ru"},
  {key: "ru_en", label: "RU → EN", given: "ru", ask: "v1", kind: "ru_en"},
  {key: "v2", label: "V1 → V2", given: "v1", ask: "v2", kind: "forms"},
  {key: "v3", label: "V1 → V3", given: "v1", ask: "v3", kind: "forms"},
]

/** A right answer within `fast` ms counts as known, one slower than `slow` as not known; typing gets more time. */
export const LIMITS: Record<Exercise["mode"], {fast: number; slow: number}> = {
  choice: {fast: 4000, slow: 12000},
  type: {fast: 8000, slow: 20000},
}

const LEVEL_ORDER: Level[] = ["unknown", "shaky", "known"]

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/** Notes a skill can be checked on: form skills only cover notes that have a forms card. */
export function notesFor(skill: Skill, notes: Note[]): Note[] {
  const kind = SKILLS.find((s) => s.key === skill)?.kind ?? "en_ru"
  return notes.filter((note) => cardKinds(note).includes(kind))
}

/** The card kind a skill feeds. */
export function kindOf(skill: Skill): CardKind {
  return SKILLS.find((s) => s.key === skill)?.kind ?? "en_ru"
}

/**
 * Every question of the test: skill after skill, each skill on its first `limit` notes in deck order, shuffled;
 * `modeOf` picks typing or choosing per card.
 */
export function buildPlacement(
  notes: Note[],
  skills: Skill[],
  limit: number = Infinity,
  modeOf: (noteId: string, kind: CardKind) => Exercise["mode"] = () => "choice",
  random: () => number = Math.random,
): PlacementQuestion[] {
  return SKILLS.filter((s) => skills.includes(s.key)).flatMap((s) =>
    shuffle(notesFor(s.key, notes).slice(0, limit), random).map((note) => {
      const mode = modeOf(note.id, s.kind)
      const options = mode === "choice" ? buildOptions(note, s.given, s.ask, notes, random) : []
      return {noteId: note.id, skill: s.key, given: s.given, ask: s.ask, mode, options}
    }),
  )
}

/** Known if right and fast; shaky if right but slow or typed with a typo; unknown if wrong, skipped or very slow. */
export function levelOf(answer: PlacementAnswer): Level {
  const {fast, slow} = LIMITS[answer.mode]
  if (answer.verdict === "wrong" || answer.ms > slow) return "unknown"
  return answer.verdict === "right" && answer.ms <= fast ? "known" : "shaky"
}

/** The level of every tested card by card id; the forms card takes the worse of V2 and V3. */
export function cardLevels(answers: PlacementAnswer[]): Map<string, Level> {
  const levels = new Map<string, Level>()
  for (const answer of answers) {
    const id = `${answer.noteId}:${kindOf(answer.skill)}`
    const level = levelOf(answer)
    const previous = levels.get(id)
    if (!previous || LEVEL_ORDER.indexOf(level) < LEVEL_ORDER.indexOf(previous)) levels.set(id, level)
  }
  return levels
}

/**
 * The starting state for a tested card. Known cards go to review in 7–21 days and shaky ones in 2–4 days,
 * spread at random so they do not all come due on the same day; unknown cards start over as new.
 */
export function seedState(level: Level, t: number, random: () => number = Math.random): CardState {
  if (level === "unknown") return freshState()
  const [from, span, ease] = level === "known" ? [7, 15, SCHEDULER.startEase] : [2, 3, SCHEDULER.startEase - 0.2]
  const ivl = from + Math.floor(random() * span)
  return {type: "review", step: 0, due: dayStart(dayOf(t) + ivl), ivl, ease, reps: 1, lapses: 0}
}
