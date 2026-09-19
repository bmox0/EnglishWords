import {describe, expect, it} from "vitest"

import {NOTES} from "./data"
import {buildPlacement, cardLevels, levelOf, LIMITS, notesFor, seedState} from "./placement"
import {dayOf, dayStart} from "./scheduler"

import type {PlacementAnswer} from "./placement"

const T = new Date(2026, 8, 19, 12, 0).getTime()
const answer = (patch: Partial<PlacementAnswer>): PlacementAnswer => ({
  noteId: "verb-go",
  skill: "en_ru",
  mode: "choice",
  text: "идти",
  verdict: "right",
  ms: 1000,
  ...patch,
})

describe("buildPlacement", () => {
  it("asks every note once per chosen skill, forms for regular and irregular verbs alike", () => {
    const questions = buildPlacement(NOTES, ["ru_en", "v2"])
    expect(questions).toHaveLength(NOTES.length * 2)
    expect(questions.slice(0, NOTES.length).every((q) => q.skill === "ru_en")).toBe(true)
    expect(new Set(questions.filter((q) => q.skill === "v2").map((q) => q.noteId)).size).toBe(NOTES.length)
    expect(notesFor("v3", [...NOTES.slice(0, 2), {id: "noun-cat", pos: "noun", en: "cat", ru: ["кот"], tags: []}])).toHaveLength(2)
  })

  it("asks by typing or choosing as the mode function says", () => {
    const questions = buildPlacement(NOTES, ["en_ru"], (id) => (id === "verb-go" ? "type" : "choice"))
    const go = questions.find((q) => q.noteId === "verb-go")!
    expect(go).toMatchObject({mode: "type", options: []})
    expect(questions.filter((q) => q.mode === "choice").every((q) => q.options.length === 4)).toBe(true)
  })

  it("puts the right answer among the options", () => {
    for (const q of buildPlacement(NOTES, ["en_ru", "v3"])) {
      const note = NOTES.find((n) => n.id === q.noteId)!
      const correct = q.ask === "ru" ? note.ru.join(", ") : (note.v3 ?? []).join(" / ")
      expect(q.options).toContain(correct)
    }
  })
})

describe("levels", () => {
  it("rates by correctness and time, giving typing more time", () => {
    expect(levelOf(answer({ms: LIMITS.choice.fast}))).toBe("known")
    expect(levelOf(answer({ms: LIMITS.choice.fast + 1}))).toBe("shaky")
    expect(levelOf(answer({ms: LIMITS.choice.slow + 1}))).toBe("unknown")
    expect(levelOf(answer({verdict: "wrong", ms: 500}))).toBe("unknown")
    expect(levelOf(answer({text: null, verdict: "wrong"}))).toBe("unknown")
    expect(levelOf(answer({mode: "type", ms: LIMITS.choice.fast + 1}))).toBe("known")
    expect(levelOf(answer({mode: "type", verdict: "close", ms: 1000}))).toBe("shaky")
  })

  it("rates the forms card by the worse of V2 and V3", () => {
    const levels = cardLevels([
      answer({skill: "en_ru"}),
      answer({skill: "v2", ms: 1000}),
      answer({skill: "v3", ms: LIMITS.choice.fast + 500}),
      answer({noteId: "verb-be", skill: "v2", verdict: "wrong"}),
      answer({noteId: "verb-be", skill: "v3"}),
    ])
    expect(Object.fromEntries(levels)).toEqual({"verb-go:en_ru": "known", "verb-go:forms": "shaky", "verb-be:forms": "unknown"})
  })
})

describe("seedState", () => {
  it("sends known cards 7–21 days out, shaky ones 2–4 days, and resets unknown ones", () => {
    expect(seedState("known", T, () => 0)).toMatchObject({type: "review", ivl: 7, due: dayStart(dayOf(T) + 7), ease: 2.5})
    expect(seedState("known", T, () => 0.999).ivl).toBe(21)
    expect(seedState("shaky", T, () => 0)).toMatchObject({type: "review", ivl: 2, ease: 2.3})
    expect(seedState("shaky", T, () => 0.999).ivl).toBe(4)
    expect(seedState("unknown", T)).toMatchObject({type: "new", ivl: 0, reps: 0})
  })
})
