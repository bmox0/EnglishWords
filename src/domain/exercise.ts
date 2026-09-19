import type {Card} from "./cards"
import type {Field} from "./notes"

/** One question: what is shown and what has to be typed. */
export interface Exercise {
  given: Field
  ask: Field
}

const FORMS_EXERCISES: Exercise[] = [
  {given: "v1", ask: "v2"},
  {given: "v1", ask: "v3"},
  {given: "v2", ask: "v1"},
  {given: "v3", ask: "v1"},
  {given: "ru", ask: "v2"},
  {given: "ru", ask: "v3"},
]

/** The question for a card; a forms card asks a random single form each time. */
export function makeExercise(card: Card, random: () => number = Math.random): Exercise {
  if (card.kind === "en_ru") return {given: "v1", ask: "ru"}
  if (card.kind === "ru_en") return {given: "ru", ask: "v1"}
  return FORMS_EXERCISES[Math.floor(random() * FORMS_EXERCISES.length)] ?? {given: "v1", ask: "v2"}
}
