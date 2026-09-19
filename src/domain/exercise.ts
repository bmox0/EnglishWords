import {buildOptions} from "./choices"

import type {Card} from "./cards"
import type {Field, Note} from "./notes"
import type {CardState} from "./scheduler"

/** How answers are given: always typed, always picked from options, or picked while learning and typed on reviews. */
export type AnswerMode = "auto" | "type" | "choice"

/** One question: what is shown, what is asked, and the options when it is answered by choosing. */
export interface Exercise {
  given: Field
  ask: Field
  mode: "type" | "choice"
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

/** In auto mode a card is answered by choosing when it is new or was just failed, and by typing from the second learning step on. */
export function modeFor(card: CardState, setting: AnswerMode): Exercise["mode"] {
  if (setting !== "auto") return setting
  if (card.type === "review") return "type"
  if (card.type === "learning" && card.step > 0) return "type"
  return "choice"
}

function fieldsFor(card: Card, random: () => number): [Field, Field] {
  if (card.kind === "en_ru") return ["v1", "ru"]
  if (card.kind === "ru_en") return ["ru", "v1"]
  return FORMS_FIELDS[Math.floor(random() * FORMS_FIELDS.length)] ?? ["v1", "v2"]
}

/** The question for a card; a forms card asks a random single form each time. */
export function makeExercise(card: Card, mode: Exercise["mode"], notes: Note[], random: () => number = Math.random): Exercise {
  const [given, ask] = fieldsFor(card, random)
  return {given, ask, mode, options: mode === "choice" ? buildOptions(card.note, given, ask, notes, random) : []}
}
