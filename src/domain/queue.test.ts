import {describe, expect, it} from "vitest"

import {buildCards, cardKinds, isUnlocked} from "./cards"
import {freshDay} from "./day"
import {makeExercise, TASKS, taskIndex} from "./exercise"
import {buildQueue, pickNext} from "./queue"
import {dayOf, dayStart, freshState, MINUTE} from "./scheduler"

import type {Card} from "./cards"
import type {DayProgress} from "./day"
import type {Queue} from "./queue"
import type {Note} from "./notes"
import type {CardState} from "./scheduler"

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
const review = (ivl: number, due = dayStart(dayOf(T))): CardState => ({...freshState(), type: "review", ivl, due, reps: 2})
const learning = (due: number, ivl = 0): CardState => ({...freshState(), type: ivl ? "relearning" : "learning", step: 0, due, ivl, reps: 1})
const ids = (cards: Card[]) => cards.map((c) => c.id)
const drain = (q: Queue, day: DayProgress): Card[] => {
  const out: Card[] = []
  for (let card = pickNext(q, day); card; card = pickNext(q, day)) {
    out.push(card)
    for (const list of [q.learnDue, q.reviews, q.news, q.learnAhead]) if (list.includes(card)) list.splice(list.indexOf(card), 1)
  }
  return out
}
const answered = (noteId: string): DayProgress => ({
  ...freshDay(T),
  done: [{cardId: `${noteId}:en_ru`, noteId, grade: 3, given: "v1", ask: "ru", text: "", ok: true, mode: "type"}],
})

describe("cards", () => {
  it("gives a forms card to every verb, regular or not, and none to words without forms", () => {
    expect(cardKinds(NOTES[0]!)).toEqual(["en_ru", "ru_en", "forms"])
    expect(cardKinds(NOTES[1]!)).toEqual(["en_ru", "ru_en", "forms"])
    expect(cardKinds({id: "noun-cat", pos: "noun", en: "cat", ru: ["кот"], tags: []})).toEqual(["en_ru", "ru_en"])
  })

  it("restores progress by card id when notes are added in front", () => {
    const cards = buildCards([verb("new", true), ...NOTES], {"verb-walk:en_ru": review(5)})
    expect(cards.find((c) => c.id === "verb-walk:en_ru")).toMatchObject({type: "review", ivl: 5})
    expect(cards.find((c) => c.id === "verb-new:en_ru")).toMatchObject({type: "new"})
  })

  it("unlocks RU → EN after EN → RU graduates, and forms after RU → EN", () => {
    const fresh = buildCards(NOTES.slice(0, 1), {})
    expect(fresh.map((c) => isUnlocked(c, fresh))).toEqual([true, false, false])
    const stepOne = buildCards(NOTES.slice(0, 1), {"verb-go:en_ru": learning(T)})
    expect(stepOne.map((c) => isUnlocked(c, stepOne))).toEqual([true, false, false])
    const graduated = buildCards(NOTES.slice(0, 1), {"verb-go:en_ru": review(1)})
    expect(graduated.map((c) => isUnlocked(c, graduated))).toEqual([true, true, false])
    const lapsed = buildCards(NOTES.slice(0, 1), {"verb-go:en_ru": learning(T, 1), "verb-go:ru_en": review(3)})
    expect(lapsed.map((c) => isUnlocked(c, lapsed))).toEqual([true, true, true])
  })
})

describe("queue", () => {
  it("starts every new word with EN → RU and respects the daily limit", () => {
    const cards = buildCards(NOTES, {})
    expect(ids(buildQueue(cards, freshDay(T), T, 20).news)).toEqual(["verb-go:en_ru", "verb-walk:en_ru", "verb-see:en_ru", "verb-play:en_ru"])
    expect(buildQueue(cards, {...freshDay(T), newDone: 18}, T, 20).news).toHaveLength(2)
  })

  it("puts unlocked siblings before new words and still shows the sibling's review the same day", () => {
    const cards = buildCards(NOTES, {"verb-see:en_ru": review(1), "verb-see:ru_en": review(3, dayStart(dayOf(T) + 2))})
    const q = buildQueue(cards, freshDay(T), T, 3)
    expect(ids(q.news)).toEqual(["verb-see:forms", "verb-go:en_ru", "verb-walk:en_ru"])
    expect(ids(q.reviews)).toEqual(["verb-see:en_ru"])
  })

  it("gives a note at most one new card a day and none while it is in learning", () => {
    const cards = buildCards(NOTES, {
      "verb-go:en_ru": review(1),
      "verb-walk:en_ru": review(1),
      "verb-see:en_ru": learning(T + MINUTE, 2),
    })
    const q = buildQueue(cards, {...freshDay(T), introduced: ["verb-go"]}, T, 20)
    expect(ids(q.news)).toEqual(["verb-walk:ru_en", "verb-play:en_ru"])
  })

  it("never shows two cards of the same word back to back when something else is available", () => {
    const cards = buildCards(NOTES, {"verb-go:en_ru": learning(T - MINUTE), "verb-walk:en_ru": learning(T - 30_000)})
    const q = buildQueue(cards, freshDay(T), T, 20)
    expect(pickNext(q, freshDay(T))?.id).toBe("verb-go:en_ru")
    expect(pickNext(q, answered("verb-go"))?.id).toBe("verb-walk:en_ru")
    const alone = buildCards(NOTES.slice(0, 1), {"verb-go:en_ru": learning(T - MINUTE)})
    expect(pickNext(buildQueue(alone, freshDay(T), T, 20), answered("verb-go"))?.id).toBe("verb-go:en_ru")
  })

  it("shows learning cards due soon last and leaves those due in more than 20 minutes for later", () => {
    const soon = buildCards(NOTES.slice(0, 1), {"verb-go:en_ru": learning(T + 5 * MINUTE)})
    expect(pickNext(buildQueue(soon, freshDay(T), T, 0), freshDay(T))?.id).toBe("verb-go:en_ru")
    const later = buildCards(NOTES.slice(0, 1), {"verb-go:en_ru": learning(T + 30 * MINUTE)})
    const q = buildQueue(later, freshDay(T), T, 0)
    expect(q.later).toHaveLength(1)
    expect(pickNext(q, freshDay(T))).toBeNull()
  })

  it("gives the day's cards in blocks by task: EN → RU, RU → EN, then each form direction", () => {
    const saved = Object.fromEntries(NOTES.flatMap((n) => ["en_ru", "ru_en", "forms"].map((kind) => [`${n.id}:${kind}`, review(3)])))
    const cards = buildCards(NOTES, saved)
    const day = freshDay(T)
    const order = drain(buildQueue(cards, day, T, 20), day)
    expect(order).toHaveLength(12)
    expect(order.slice(0, 4).map((c) => c.kind)).toEqual(["en_ru", "en_ru", "en_ru", "en_ru"])
    expect(order.slice(4, 8).map((c) => c.kind)).toEqual(["ru_en", "ru_en", "ru_en", "ru_en"])
    const tasks = order.map((c) => taskIndex(c, day.index))
    expect(tasks).toEqual([...tasks].sort((a, b) => a - b))
  })

  it("clears a block's mistakes before the next block and holds a later block's mistakes until its turn", () => {
    const cards = buildCards(NOTES, {
      "verb-go:en_ru": learning(T + 5 * MINUTE),
      "verb-walk:en_ru": review(3),
      "verb-walk:ru_en": review(3),
      "verb-see:en_ru": review(3),
      "verb-see:ru_en": learning(T - MINUTE, 2),
    })
    const day = freshDay(T)
    expect(ids(drain(buildQueue(cards, day, T, 0), day))).toEqual([
      "verb-walk:en_ru",
      "verb-see:en_ru",
      "verb-go:en_ru",
      "verb-see:ru_en",
      "verb-walk:ru_en",
    ])
  })

  it("asks a forms card one direction a day, the same every time it comes up that day", () => {
    const [, , forms] = buildCards(NOTES.slice(0, 1), {})
    const day = dayOf(T)
    const task = taskIndex(forms!, day)
    expect(task).toBeGreaterThanOrEqual(2)
    expect(makeExercise(forms!, "type", NOTES, day)).toMatchObject({given: TASKS[task]![0], ask: TASKS[task]![1]})
    expect(taskIndex(forms!, day)).toBe(task)
    const month = new Set(Array.from({length: 30}, (_, i) => taskIndex(forms!, day + i)))
    expect(month.size).toBeGreaterThan(1)
  })
})
