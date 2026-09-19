import {describe, expect, it} from "vitest"

import {checkAnswer, gradeWord, levenshtein, normalize, suggestGrade} from "./check"

import type {Note} from "./notes"

const note = (en: string, ru: string[], v2: string[], v3: string[], hint?: string): Note => ({
  id: `verb-${en}`,
  pos: "verb",
  en,
  ru,
  v2,
  v3,
  tags: [],
  hint,
})
const DO = note("do", ["делать"], ["did"], ["done"])
const MAKE = note("make", ["делать"], ["made"], ["made"])
const BE = note("be", ["быть"], ["was", "were"], ["been"])
const UNDERSTAND = note("understand", ["понимать"], ["understood"], ["understood"])
const NOTES = [DO, MAKE, BE, UNDERSTAND]

describe("normalize", () => {
  it("ignores case, ё, a leading to, punctuation and extra spaces", () => {
    expect(normalize("  To  Go! ")).toBe("go")
    expect(normalize("Ёж")).toBe("еж")
  })
})

describe("gradeWord", () => {
  it("accepts one typo from 4 letters and two from 8", () => {
    expect(levenshtein("went", "wnet")).toBe(2)
    expect(gradeWord("gon", ["gone"])).toBe("wrong")
    expect(gradeWord("gonne", ["gone"])).toBe("close")
    expect(gradeWord("understod", ["understood"])).toBe("close")
    expect(gradeWord("undrstod", ["understood"])).toBe("close")
    expect(gradeWord("", ["gone"])).toBe("wrong")
  })
})

describe("checkAnswer", () => {
  it("accepts any listed variant and several variants at once", () => {
    expect(checkAnswer(BE, {given: "v1", ask: "v2"}, "were", NOTES)).toEqual({kind: "verdict", verdict: "right"})
    expect(checkAnswer(BE, {given: "v1", ask: "v2"}, "was / were", NOTES)).toEqual({kind: "verdict", verdict: "right"})
    expect(checkAnswer(BE, {given: "v1", ask: "v2"}, "was, been", NOTES)).toEqual({kind: "verdict", verdict: "wrong"})
  })

  it("points out another verb with the same translation instead of failing", () => {
    expect(checkAnswer(DO, {given: "ru", ask: "v1"}, "make", NOTES)).toEqual({kind: "other", other: MAKE})
    expect(checkAnswer(DO, {given: "ru", ask: "v1"}, "do", NOTES)).toEqual({kind: "verdict", verdict: "right"})
  })

  it("treats an empty answer as not remembered", () => {
    expect(checkAnswer(DO, {given: "v1", ask: "ru"}, "  ", NOTES)).toEqual({kind: "verdict", verdict: "wrong"})
  })
})

describe("suggestGrade", () => {
  it("offers Again after a peek even when the answer is right", () => {
    expect(suggestGrade("right", false)).toBe(3)
    expect(suggestGrade("close", false)).toBe(2)
    expect(suggestGrade("wrong", false)).toBe(1)
    expect(suggestGrade("right", true)).toBe(1)
  })
})
