import type {CardKind, Maturity} from "./cards"
import type {Exercise} from "./exercise"
import type {Field} from "./notes"
import type {CardType, Grade} from "./scheduler"

export const GRADE_LABEL: Record<Grade, string> = {1: "Again", 2: "Hard", 3: "Good", 4: "Easy"}

export const KIND_LABEL: Record<CardKind, string> = {en_ru: "EN → RU", ru_en: "RU → EN", forms: "Forms"}

export const TYPE_LABEL: Record<CardType, string> = {new: "new", learning: "learning", relearning: "relearning", review: "review"}

export const MATURITY_LABEL: Record<Maturity, string> = {new: "new", learn: "learning", young: "young", mature: "mature"}

export const FIELD_LABEL: Record<Field, string> = {ru: "translation", v1: "infinitive", v2: "past simple", v3: "past participle"}

/** The instruction above the prompt. */
export function taskText(exercise: Exercise): string {
  const verb = {both: "Type or pick", type: "Type", choice: "Pick"}[exercise.mode]
  if (exercise.ask === "ru") return `${verb} the translation`
  if (exercise.ask === "v1") return exercise.given === "ru" ? `${verb} the English word` : `${verb} the infinitive`
  return `${verb} the ${FIELD_LABEL[exercise.ask]}`
}
