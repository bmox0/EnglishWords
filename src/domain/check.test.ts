import {describe, expect, it} from "vitest"

import {checkAnswer, gradeAnswer, gradeReason, gradeWord, levenshtein, LIMITS, normalize} from "./check"

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

describe("gradeAnswer", () => {
  it("grades by correctness: Good when right, Hard for a typo, Again for a miss or a peek", () => {
    expect(gradeAnswer("right", false, "type", 1000)).toBe(3)
    expect(gradeAnswer("close", false, "type", 1000)).toBe(2)
    expect(gradeAnswer("wrong", false, "choice", 1000)).toBe(1)
    expect(gradeAnswer("right", true, "choice", 1000)).toBe(1)
  })

  it("gives Hard to a right answer slower than the limit, which is longer for typing, and never Easy", () => {
    expect(gradeAnswer("right", false, "choice", LIMITS.choice.slow)).toBe(3)
    expect(gradeAnswer("right", false, "choice", LIMITS.choice.slow + 1)).toBe(2)
    expect(gradeAnswer("right", false, "type", LIMITS.choice.slow + 1)).toBe(3)
    expect(gradeAnswer("right", false, "type", LIMITS.type.slow + 1)).toBe(2)
    expect(gradeAnswer("right", false, "choice", 100)).toBe(3)
  })

  it("explains each grade in a few words", () => {
    expect(gradeReason("right", true, "choice", 1000)).toBe("you peeked")
    expect(gradeReason("wrong", false, "choice", 1000)).toBe("not right")
    expect(gradeReason("close", false, "type", 1000)).toBe("a typo")
    expect(gradeReason("right", false, "choice", LIMITS.choice.slow)).toBe("within 12 s")
    expect(gradeReason("right", false, "type", LIMITS.type.slow + 1)).toBe("over 20 s")
  })
})
