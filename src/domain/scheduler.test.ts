import {describe, expect, it} from "vitest"

import {dayOf, dayStart, freshState, fuzzInterval, MINUTE, nextState} from "./scheduler"

import type {CardState} from "./scheduler"

const T = new Date(2026, 8, 19, 12, 0).getTime()
const review = (ivl: number, ease = 2.5): CardState => ({...freshState(), type: "review", ivl, ease, due: dayStart(dayOf(T)), reps: 3})

describe("days", () => {
  it("starts a day at 4:00", () => {
    const before = new Date(2026, 8, 20, 3, 59).getTime()
    const after = new Date(2026, 8, 20, 4, 0).getTime()
    expect(dayOf(before)).toBe(dayOf(T))
    expect(dayOf(after)).toBe(dayOf(T) + 1)
    expect(dayStart(dayOf(T) + 1)).toBe(after)
  })
})

describe("learning", () => {
  it("walks a new card through the 1 and 10 minute steps, then graduates to 1 day", () => {
    const first = nextState(freshState(), 3, T)
    expect(first).toMatchObject({type: "learning", step: 1, due: T + 10 * MINUTE})
    const graduated = nextState(first, 3, T)
    expect(graduated).toMatchObject({type: "review", ivl: 1, due: dayStart(dayOf(T) + 1)})
  })

  it("restarts on Again and waits between steps on Hard", () => {
    expect(nextState(freshState(), 1, T)).toMatchObject({type: "learning", step: 0, due: T + MINUTE})
    expect(nextState(freshState(), 2, T)).toMatchObject({type: "learning", step: 0, due: T + 5.5 * MINUTE})
  })

  it("graduates straight to 4 days on Easy", () => {
    expect(nextState(freshState(), 4, T)).toMatchObject({type: "review", ivl: 4})
  })
})

describe("reviews", () => {
  it("multiplies the interval by ease on Good", () => {
    expect(nextState(review(10), 3, T)).toMatchObject({type: "review", ivl: 25, ease: 2.5})
  })

  it("uses the hard factor and lowers ease on Hard", () => {
    expect(nextState(review(10), 2, T)).toMatchObject({ivl: 12, ease: 2.35})
  })

  it("adds the easy bonus and raises ease on Easy", () => {
    expect(nextState(review(10), 4, T)).toMatchObject({ivl: 33, ease: 2.65})
  })

  it("sends a lapse to relearning for 10 minutes and returns with interval 1", () => {
    const lapsed = nextState(review(10), 1, T)
    expect(lapsed).toMatchObject({type: "relearning", lapses: 1, ease: 2.3, ivl: 1, due: T + 10 * MINUTE})
    expect(nextState(lapsed, 3, T)).toMatchObject({type: "review", ivl: 1})
  })

  it("never drops ease below 130%", () => {
    expect(nextState(review(10, 1.3), 1, T).ease).toBe(1.3)
  })
})

describe("fuzz", () => {
  it("leaves short intervals alone and keeps long ones near the target", () => {
    expect(fuzzInterval(2, () => 0.5)).toBe(2)
    expect(fuzzInterval(10, () => 0)).toBe(8)
    expect(fuzzInterval(10, () => 0.999)).toBe(12)
  })
})
