import {buildOptions} from "./choices"

import type {Card} from "./cards"
import type {Field, Note} from "./notes"

/** How questions are answered: typed, picked from four options, or both at once (a field with the options below it). */
export type AnswerMode = "both" | "type" | "choice"

/** How one answer was given: typed or picked. */
export type AnswerInput = "type" | "choice"

/** One question: what is shown, what is asked, and the options unless it is answered by typing only. */
export interface Exercise {
  given: Field
  ask: Field
  mode: AnswerMode
  options: string[]
}

const FORMS_TASKS: [Field, Field][] = [
  ["v1", "v2"],
  ["v1", "v3"],
  ["v2", "v1"],
  ["v3", "v1"],
  ["ru", "v2"],
  ["ru", "v3"],
]

/** Every task, in the order a day's cards come in: EN → RU, RU → EN, then the forms one direction at a time. */
export const TASKS: [Field, Field][] = [["v1", "ru"], ["ru", "v1"], ...FORMS_TASKS]

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * The card's task on the given day as an index into `TASKS`. A forms card asks one direction a day, picked from its id and the day,
 * so the direction holds across reloads and when the card comes back after a mistake.
 */
export function taskIndex(card: Card, day: number): number {
  if (card.kind === "en_ru") return 0
  if (card.kind === "ru_en") return 1
  return 2 + (hash(`${card.id}@${day}`) % FORMS_TASKS.length)
}

/** The question for a card on the given day. */
export function makeExercise(card: Card, mode: AnswerMode, notes: Note[], day: number, random: () => number = Math.random): Exercise {
  const [given, ask] = TASKS[taskIndex(card, day)] ?? ["v1", "ru"]
  return {given, ask, mode, options: mode === "type" ? [] : buildOptions(card.note, given, ask, notes, random)}
}
