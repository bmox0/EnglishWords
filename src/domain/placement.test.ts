import {describe, expect, it} from "vitest"

import {NOTES} from "./data"
import {LIMITS} from "./check"
import {buildPlacement, cardGrades, doneEntry, gradeOf, notesFor} from "./placement"

import type {PlacementAnswer} from "./placement"

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

  it("asks each skill on its own first words of the deck, taking wrong options from the whole deck", () => {
    const questions = buildPlacement(NOTES, ["en_ru", "ru_en", "v2"], 50)
    expect(questions).toHaveLength(150)
    const idsOf = (skill: string) => new Set(questions.filter((q) => q.skill === skill).map((q) => q.noteId))
    expect(idsOf("en_ru")).toEqual(new Set(NOTES.slice(0, 50).map((n) => n.id)))
    expect(idsOf("ru_en")).toEqual(idsOf("en_ru"))
    expect(idsOf("v2")).toEqual(idsOf("en_ru"))
    expect(buildPlacement(NOTES, ["v3"], 500)).toHaveLength(NOTES.length)
    const first = new Set(NOTES.slice(0, 50).map((n) => n.ru.join(", ")))
    expect(questions.filter((q) => q.skill === "en_ru").some((q) => q.options.some((o) => !first.has(o)))).toBe(true)
  })

  it("asks by typing or choosing as the mode function says", () => {
    const questions = buildPlacement(NOTES, ["en_ru"], Infinity, (id) => (id === "verb-go" ? "type" : "choice"))
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

describe("grades", () => {
  it("grades an answer the same way as on the card", () => {
    expect(gradeOf(answer({ms: LIMITS.choice.slow}))).toBe(3)
    expect(gradeOf(answer({ms: LIMITS.choice.slow + 1}))).toBe(2)
    expect(gradeOf(answer({mode: "type", ms: LIMITS.choice.slow + 1}))).toBe(3)
    expect(gradeOf(answer({mode: "type", verdict: "close", ms: 1000}))).toBe(2)
    expect(gradeOf(answer({verdict: "wrong", ms: 500}))).toBe(1)
    expect(gradeOf(answer({text: null, verdict: "wrong"}))).toBe(1)
  })

  it("grades the forms card once, by the worse of V2 and V3", () => {
    const grades = cardGrades([
      answer({skill: "en_ru"}),
      answer({skill: "v2"}),
      answer({skill: "v3", verdict: "close"}),
      answer({noteId: "verb-be", skill: "v2", verdict: "wrong"}),
      answer({noteId: "verb-be", skill: "v3"}),
    ])
    expect(Object.fromEntries(grades)).toEqual({"verb-go:en_ru": 3, "verb-go:forms": 2, "verb-be:forms": 1})
  })

  it("turns an answer into a line of today's history, like an answer on the card", () => {
    expect(doneEntry(answer({skill: "v3", text: "gone"}))).toEqual({
      cardId: "verb-go:forms",
      noteId: "verb-go",
      grade: 3,
      given: "v1",
      ask: "v3",
      text: "gone",
      ok: true,
      mode: "choice",
    })
    expect(doneEntry(answer({skill: "ru_en", mode: "type", text: null, verdict: "wrong"}))).toMatchObject({
      cardId: "verb-go:ru_en",
      grade: 1,
      given: "ru",
      ask: "v1",
      text: "",
      ok: false,
    })
  })
})
