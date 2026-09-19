import type {CardKind, Maturity} from "./cards"
import type {Field} from "./notes"
import type {CardType, Grade} from "./scheduler"

export const GRADE_LABEL: Record<Grade, string> = {1: "Again", 2: "Hard", 3: "Good", 4: "Easy"}

export const KIND_LABEL: Record<CardKind, string> = {en_ru: "EN → RU", ru_en: "RU → EN", forms: "Forms"}

export const TYPE_LABEL: Record<CardType, string> = {new: "new", learning: "learning", relearning: "relearning", review: "review"}

export const MATURITY_LABEL: Record<Maturity, string> = {new: "new", learn: "learning", young: "young", mature: "mature"}

export const FIELD_LABEL: Record<Field, string> = {ru: "translation", v1: "infinitive", v2: "past simple", v3: "past participle"}

const ASK_NAME: Record<Field, string> = {ru: "Translation", v1: "Infinitive", v2: "Past Simple", v3: "Past Participle"}

/** The task above the prompt, shown as "To Past Simple (V1 → V2)": what to turn the prompt into, and the direction. */
export function taskLabel(given: Field, ask: Field): {name: string; direction: string} {
  const withRu = given === "ru" || ask === "ru"
  const code = (field: Field) => (field === "v1" && withRu ? "EN" : field.toUpperCase())
  const name = given === "ru" && ask === "v1" ? ASK_NAME.ru : ASK_NAME[ask]
  return {name, direction: `${code(given)} → ${code(ask)}`}
}
