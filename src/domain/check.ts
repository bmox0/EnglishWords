import {valuesOf} from "./notes"

import type {Exercise} from "./exercise"
import type {Note} from "./notes"
import type {Grade} from "./scheduler"

export type Verdict = "right" | "close" | "wrong"

/** A checked answer, or a hint that the typed word is another note with the same translation. */
export type CheckResult = {kind: "verdict"; verdict: Verdict} | {kind: "other"; other: Note}

/** Lowercases, treats ё as е, drops a leading "to " and end punctuation, and collapses spaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/^\s*to\s+/, "")
    .replace(/[.!?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  let prev = Array.from({length: b.length + 1}, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length] ?? 0
}

/** Grades one word: exact match is right, a small typo is close (1 edit from 4 letters, 2 from 8). */
export function gradeWord(answer: string, valid: string[]): Verdict {
  const a = normalize(answer)
  if (!a) return "wrong"
  const accepted = valid.map(normalize)
  if (accepted.includes(a)) return "right"
  const tolerance = a.length >= 8 ? 2 : a.length >= 4 ? 1 : 0
  return Math.min(...accepted.map((v) => levenshtein(a, v))) <= tolerance ? "close" : "wrong"
}

/** Checks a typed answer; several variants may be typed separated by "/" or "," and all of them must be correct. */
export function checkAnswer(note: Note, exercise: Pick<Exercise, "given" | "ask">, answer: string, notes: Note[]): CheckResult {
  if (exercise.given === "ru" && exercise.ask === "v1") {
    const typed = normalize(answer)
    const other = notes.find((o) => o.id !== note.id && normalize(o.en) === typed && o.ru.some((r) => note.ru.includes(r)))
    if (other) return {kind: "other", other}
  }
  const words = answer
    .split(/[/,]/)
    .map((w) => w.trim())
    .filter(Boolean)
  if (!words.length) return {kind: "verdict", verdict: "wrong"}
  const verdicts = words.map((w) => gradeWord(w, valuesOf(note, exercise.ask)))
  const verdict = verdicts.includes("wrong") ? "wrong" : verdicts.includes("close") ? "close" : "right"
  return {kind: "verdict", verdict}
}

/** A right answer slower than `slow` ms counts as hard; typing gets more time. */
export const LIMITS: Record<Exercise["mode"], {slow: number}> = {
  choice: {slow: 12000},
  type: {slow: 20000},
}

/**
 * The grade an answer gets on its own: Again for a miss, "don't know" or a peek; Hard for a typo or a right answer
 * slower than the `slow` limit; Good otherwise. Easy is never given automatically.
 */
export function gradeAnswer(verdict: Verdict, peeked: boolean, mode: Exercise["mode"], ms: number): Grade {
  if (peeked || verdict === "wrong") return 1
  return verdict === "close" || ms > LIMITS[mode].slow ? 2 : 3
}

/** Why `gradeAnswer` gave its grade, in a few words, so the rule is easy to remember. */
export function gradeReason(verdict: Verdict, peeked: boolean, mode: Exercise["mode"], ms: number): string {
  const slow = LIMITS[mode].slow
  if (peeked) return "you peeked"
  if (verdict === "wrong") return "not right"
  if (verdict === "close") return "a typo"
  return `${ms > slow ? "over" : "within"} ${slow / 1000} s`
}
