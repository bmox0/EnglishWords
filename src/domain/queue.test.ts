import {describe, expect, it} from "vitest"

import {buildCards, cardKinds} from "./cards"
import {freshDay} from "./day"
import {buildQueue, pickNext} from "./queue"
import {dayOf, dayStart, MINUTE} from "./scheduler"

import type {Note} from "./notes"

const T = new Date(2026, 8, 19, 12, 0).getTime()
const verb = (en: string, irregular: boolean): Note => ({
  id: `verb-${en}`,
  pos: "verb",
  en,
  ru: [en],
  v2: [en + "ed"],
  v3: [en + "ed"],
  irregular,
  tags: [],
})
const NOTES = [verb("go", true), verb("walk", false), verb("see", true), verb("play", false)]

describe("cards", () => {
  it("gives forms cards to irregular verbs only, unless asked for all", () => {
    expect(cardKinds(NOTES[0]!, "irregular")).toEqual(["en_ru", "ru_en", "forms"])
    expect(cardKinds(NOTES[1]!, "irregular")).toEqual(["en_ru", "ru_en"])
    expect(cardKinds(NOTES[1]!, "all")).toEqual(["en_ru", "ru_en", "forms"])
    expect(cardKinds({id: "noun-cat", pos: "noun", en: "cat", ru: ["кот"], tags: []}, "all")).toEqual(["en_ru", "ru_en"])
  })

  it("restores progress by card id when notes are added in front", () => {
    const saved = {"verb-walk:en_ru": {type: "review" as const, step: 0, due: 1, ivl: 5, ease: 2.5, reps: 4, lapses: 0}}
    const cards = buildCards([verb("new", true), ...NOTES], "irregular", saved)
    expect(cards.find((c) => c.id === "verb-walk:en_ru")).toMatchObject({type: "review", ivl: 5})
    expect(cards.find((c) => c.id === "verb-new:en_ru")).toMatchObject({type: "new"})
  })
})

describe("queue", () => {
  it("takes one new card per note and respects the daily limit", () => {
    const cards = buildCards(NOTES, "irregular", {})
    expect(buildQueue(cards, freshDay(T), T, 20).news.map((c) => c.id)).toEqual([
      "verb-go:en_ru",
      "verb-walk:en_ru",
      "verb-see:en_ru",
      "verb-play:en_ru",
    ])
    expect(buildQueue(cards, {...freshDay(T), newDone: 18}, T, 20).news).toHaveLength(2)
  })

  it("buries siblings of notes answered today or still in learning", () => {
    const cards = buildCards(NOTES, "irregular", {
      "verb-go:en_ru": {type: "learning", step: 1, due: T + 10 * MINUTE, ivl: 0, ease: 2.5, reps: 1, lapses: 0},
    })
    const day = {...freshDay(T), touched: ["verb-walk"]}
    const q = buildQueue(cards, day, T, 20)
    expect(q.news.map((c) => c.note.id)).toEqual(["verb-see", "verb-play"])
    expect(q.learnAhead.map((c) => c.id)).toEqual(["verb-go:en_ru"])
  })

  it("shows due learning cards first and learning cards due soon last", () => {
    const cards = buildCards(NOTES, "irregular", {
      "verb-go:en_ru": {type: "learning", step: 0, due: T - MINUTE, ivl: 0, ease: 2.5, reps: 1, lapses: 0},
      "verb-see:en_ru": {type: "review", step: 0, due: dayStart(dayOf(T)), ivl: 3, ease: 2.5, reps: 3, lapses: 0},
    })
    const day = freshDay(T)
    expect(pickNext(buildQueue(cards, day, T, 20), day)?.id).toBe("verb-go:en_ru")
    expect(pickNext(buildQueue(cards, day, T, 0), day)?.id).toBe("verb-go:en_ru")
    const onlySoon = buildCards(NOTES.slice(0, 1), "irregular", {
      "verb-go:en_ru": {type: "learning", step: 1, due: T + 5 * MINUTE, ivl: 0, ease: 2.5, reps: 1, lapses: 0},
    })
    expect(pickNext(buildQueue(onlySoon, day, T, 0), day)?.id).toBe("verb-go:en_ru")
  })

  it("leaves learning cards due in more than 20 minutes for later", () => {
    const cards = buildCards(NOTES.slice(0, 1), "irregular", {
      "verb-go:en_ru": {type: "learning", step: 1, due: T + 30 * MINUTE, ivl: 0, ease: 2.5, reps: 1, lapses: 0},
    })
    const q = buildQueue(cards, freshDay(T), T, 0)
    expect(q.later).toHaveLength(1)
    expect(pickNext(q, freshDay(T))).toBeNull()
  })
})
