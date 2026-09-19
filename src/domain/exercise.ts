import {buildOptions} from "./choices"

import type {Card} from "./cards"
import type {Field, Note} from "./notes"

/** How answers are given: always typed, always picked from options, or a mix of about 40% picked and 60% typed. */
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

/** The share of answers picked from options in auto mode; the rest are typed. */
export const CHOICE_SHARE = 0.4

/** How many of today's answers were picked from options, out of all of them. */
export interface ModeTally {
  picked: number
  total: number
}

/**
 * The chance that a card is answered by picking. In auto mode the first look at a brand-new word (its new EN → RU card) is always picked;
 * any other card is picked more or less often so that about 40% of today's answers end up picked.
 */
export function choiceChance(card: Pick<Card, "type" | "kind">, setting: AnswerMode, today: ModeTally = {picked: 0, total: 0}): number {
  if (setting !== "auto") return setting === "choice" ? 1 : 0
  if (card.type === "new" && card.kind === "en_ru") return 1
  return Math.min(1, Math.max(0, CHOICE_SHARE * (today.total + 1) - today.picked))
}

/** Picks typing or choosing for a card with the chance from `choiceChance`. */
export function modeFor(
  card: Pick<Card, "type" | "kind">,
  setting: AnswerMode,
  today?: ModeTally,
  random: () => number = Math.random,
): Exercise["mode"] {
  return random() < choiceChance(card, setting, today) ? "choice" : "type"
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
