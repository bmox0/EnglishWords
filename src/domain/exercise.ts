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

const FORMS_FIELDS: [Field, Field][] = [
  ["v1", "v2"],
  ["v1", "v3"],
  ["v2", "v1"],
  ["v3", "v1"],
  ["ru", "v2"],
  ["ru", "v3"],
]

function fieldsFor(card: Card, random: () => number): [Field, Field] {
  if (card.kind === "en_ru") return ["v1", "ru"]
  if (card.kind === "ru_en") return ["ru", "v1"]
  return FORMS_FIELDS[Math.floor(random() * FORMS_FIELDS.length)] ?? ["v1", "v2"]
}

/** The question for a card; a forms card asks a random single form each time. */
export function makeExercise(card: Card, mode: AnswerMode, notes: Note[], random: () => number = Math.random): Exercise {
  const [given, ask] = fieldsFor(card, random)
  return {given, ask, mode, options: mode === "type" ? [] : buildOptions(card.note, given, ask, notes, random)}
}
