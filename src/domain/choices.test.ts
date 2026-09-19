import {describe, expect, it} from "vitest"

import {buildOptions, regularPast} from "./choices"
import {NOTES} from "./data"
import {choiceChance, modeFor} from "./exercise"

const note = (id: string) => NOTES.find((n) => n.id === id)!
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

describe("buildOptions", () => {
  it("has the correct answer once and three other options", () => {
    for (let seed = 1; seed < 40; seed++) {
      const options = buildOptions(note("verb-go"), "v1", "v2", NOTES, seeded(seed))
      expect(options).toHaveLength(4)
      expect(options.filter((o) => o === "went")).toHaveLength(1)
      expect(new Set(options).size).toBe(4)
    }
  })

  it("never offers a word with the same translation, so only one option is right", () => {
    for (let seed = 1; seed < 40; seed++) {
      expect(buildOptions(note("verb-do"), "ru", "v1", NOTES, seeded(seed))).not.toContain("make")
      expect(buildOptions(note("verb-make"), "v1", "ru", NOTES, seeded(seed)).filter((o) => o === "делать")).toHaveLength(1)
    }
  })

  it("mixes up forms of the same verb and never shows the prompt as an option", () => {
    const options = buildOptions(note("verb-go"), "v1", "v3", NOTES, seeded(7))
    expect(options).toContain("gone")
    expect(options).toContain("went")
    expect(options).not.toContain("go")
  })

  it("does not offer a single variant of a multi-form answer as a wrong option", () => {
    for (let seed = 1; seed < 40; seed++) {
      const options = buildOptions(note("verb-be"), "v1", "v2", NOTES, seeded(seed))
      expect(options).toContain("was / were")
      expect(options).not.toContain("was")
      expect(options).not.toContain("were")
    }
  })

  it("guesses the regular past a learner would write", () => {
    expect(regularPast("go")).toBe("goed")
    expect(regularPast("take")).toBe("taked")
    expect(regularPast("try")).toBe("tried")
  })
})

describe("answer mode", () => {
  it("always picks for the first look at a brand-new word in auto mode", () => {
    expect(choiceChance({type: "new", kind: "en_ru"}, "auto", {picked: 10, total: 10})).toBe(1)
  })

  it("steers the rest of the day towards 40% picked in auto mode", () => {
    expect(choiceChance({type: "review", kind: "en_ru"}, "auto")).toBeCloseTo(0.4)
    expect(choiceChance({type: "review", kind: "en_ru"}, "auto", {picked: 4, total: 10})).toBeCloseTo(0.4)
    expect(choiceChance({type: "new", kind: "ru_en"}, "auto", {picked: 8, total: 10})).toBe(0)
    expect(choiceChance({type: "learning", kind: "forms"}, "auto", {picked: 0, total: 10})).toBe(1)
  })

  it("lands near 40% picked over a day", () => {
    let seed = 42
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const today = {picked: 0, total: 0}
    for (let i = 0; i < 200; i++) {
      const card = i % 4 === 0 ? ({type: "new", kind: "en_ru"} as const) : ({type: "review", kind: "ru_en"} as const)
      if (modeFor(card, "auto", today, random) === "choice") today.picked++
      today.total++
    }
    expect(today.picked / today.total).toBeGreaterThan(0.35)
    expect(today.picked / today.total).toBeLessThan(0.45)
  })

  it("follows a fixed setting", () => {
    expect(modeFor({type: "review", kind: "ru_en"}, "choice")).toBe("choice")
    expect(modeFor({type: "new", kind: "en_ru"}, "type")).toBe("type")
  })
})
