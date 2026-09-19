import {describe, expect, it} from "vitest"

import {buildOptions, regularPast} from "./choices"
import {NOTES} from "./data"
import {modeFor} from "./exercise"
import {freshState} from "./scheduler"

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

describe("modeFor", () => {
  it("chooses while learning and types on reviews in auto mode", () => {
    expect(modeFor(freshState(), "auto")).toBe("choice")
    expect(modeFor({...freshState(), type: "learning", step: 1}, "auto")).toBe("type")
    expect(modeFor({...freshState(), type: "learning", step: 0}, "auto")).toBe("choice")
    expect(modeFor({...freshState(), type: "relearning", ivl: 3}, "auto")).toBe("choice")
    expect(modeFor({...freshState(), type: "review", ivl: 3}, "auto")).toBe("type")
    expect(modeFor({...freshState(), type: "review", ivl: 3}, "choice")).toBe("choice")
    expect(modeFor(freshState(), "type")).toBe("type")
  })
})
