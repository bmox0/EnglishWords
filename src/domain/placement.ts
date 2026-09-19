import {cardKinds} from "./cards"
import {gradeAnswer} from "./check"
import {buildOptions} from "./choices"

import type {CardKind} from "./cards"
import type {Verdict} from "./check"
import type {DoneEntry} from "./day"
import type {Exercise} from "./exercise"
import type {Field, Note} from "./notes"
import type {Grade} from "./scheduler"

/** What a placement question checks. Both form skills feed the one forms card. */
export type Skill = "en_ru" | "ru_en" | "v2" | "v3"

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

/** The grade an answer gets, the same as for an answer on the card. */
export function gradeOf(answer: PlacementAnswer): Grade {
  return gradeAnswer(answer.verdict, false, answer.mode, answer.ms)
}

/** The grade for every tested card by card id; the forms card takes the worse of V2 and V3, so it is graded once. */
export function cardGrades(answers: PlacementAnswer[]): Map<string, Grade> {
  const grades = new Map<string, Grade>()
  for (const answer of answers) {
    const id = `${answer.noteId}:${kindOf(answer.skill)}`
    const grade = gradeOf(answer)
    grades.set(id, Math.min(grades.get(id) ?? grade, grade) as Grade)
  }
  return grades
}

/** The answer as a line of today's history, the same as an answer given on the card. */
export function doneEntry(answer: PlacementAnswer): DoneEntry {
  const skill = SKILLS.find((s) => s.key === answer.skill) ?? SKILLS[0]!
  return {
    cardId: `${answer.noteId}:${skill.kind}`,
    noteId: answer.noteId,
    grade: gradeOf(answer),
    given: skill.given,
    ask: skill.ask,
    text: answer.text ?? "",
    ok: answer.verdict === "right",
    mode: answer.mode,
  }
}
