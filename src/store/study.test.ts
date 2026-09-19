import {describe, expect, it} from "vitest"

import {MINUTE} from "../domain/scheduler"
import {STORAGE_KEY} from "../domain/storage"
import {createStudy} from "./study"

import type {Note} from "../domain/notes"
import type {KeyValueStore} from "../domain/storage"

const T = new Date(2026, 8, 19, 12, 0).getTime()
const DO: Note = {id: "verb-do", pos: "verb", en: "do", ru: ["делать"], v2: ["did"], v3: ["done"], irregular: true, tags: []}
const MAKE: Note = {id: "verb-make", pos: "verb", en: "make", ru: ["делать"], v2: ["made"], v3: ["made"], irregular: true, tags: []}
const WALK: Note = {id: "verb-walk", pos: "verb", en: "walk", ru: ["гулять"], v2: ["walked"], v3: ["walked"], irregular: false, tags: []}

function memoryStore(): KeyValueStore & {data: Map<string, string>} {
  const data = new Map<string, string>()
  return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)}
}

function setup(notes = [DO, MAKE, WALK], store = memoryStore()) {
  let now = T
  const study = createStudy(
    notes,
    store,
    () => now,
    () => 0,
  )
  study.updateSettings({answerMode: "type"})
  return {study, store, advance: (ms: number) => (now += ms)}
}

function answerCurrent(study: ReturnType<typeof createStudy>, text: string) {
  study.setAnswer(text)
  study.check()
}

describe("answering by choice", () => {
  it("types a word after its first look, even after a mistake", () => {
    const study = createStudy(
      [DO, WALK],
      null,
      () => T,
      () => 0,
    )
    const first = study.state.session.exercise!
    expect(first.mode).toBe("choice")
    study.choose(first.options.findIndex((o) => o !== "делать"))
    study.grade(1)
    expect(study.current.value?.id).toBe("verb-walk:en_ru")
    expect(study.state.session.exercise?.mode).toBe("choice")
    study.giveUp()
    study.grade(1)
    expect(study.current.value?.id).toBe("verb-do:en_ru")
    expect(study.state.session.exercise).toMatchObject({mode: "type", options: []})
  })

  it("offers options for a brand-new word in auto mode", () => {
    const study = createStudy(
      [DO, MAKE, WALK],
      null,
      () => T,
      () => 0,
    )
    const exercise = study.state.session.exercise!
    expect(exercise.mode).toBe("choice")
    expect(exercise.options).toContain("делать")
    study.setAnswer("делать")
    study.check()
    expect(study.state.session.result).toBeNull()
    study.choose(exercise.options.indexOf("делать"))
    expect(study.state.session.result).toBe("right")
    expect(study.suggested.value).toBe(3)
    study.grade(3)
    expect(study.state.day.done[0]).toMatchObject({text: "делать", ok: true})
  })

  it("suggests Again for a wrong option or a give-up", () => {
    const study = createStudy(
      [DO, MAKE, WALK],
      null,
      () => T,
      () => 0,
    )
    const options = study.state.session.exercise!.options
    study.choose(options.findIndex((o) => o !== "делать"))
    expect(study.state.session.result).toBe("wrong")
    expect(study.suggested.value).toBe(1)
    study.grade(1)
    study.giveUp()
    expect(study.suggested.value).toBe(1)
  })

  it("switches the current question when the answer mode changes", () => {
    const study = createStudy(
      [DO, WALK],
      null,
      () => T,
      () => 0,
    )
    const cardId = study.state.session.cardId
    study.updateSettings({answerMode: "type"})
    expect(study.state.session).toMatchObject({cardId, exercise: {mode: "type", options: []}})
  })
})

describe("study session", () => {
  it("starts with the first new card and saves progress after grading", () => {
    const {study, store} = setup()
    expect(study.current.value?.id).toBe("verb-do:en_ru")
    answerCurrent(study, "делать")
    expect(study.state.session.result).toBe("right")
    expect(study.suggested.value).toBe(3)
    study.grade(3)
    const saved = JSON.parse(store.data.get(STORAGE_KEY)!)
    expect(saved.cards["verb-do:en_ru"]).toMatchObject({type: "learning", step: 1})
    expect(saved.day.done).toHaveLength(1)
    expect(study.current.value?.id).toBe("verb-make:en_ru")
  })

  it("asks again instead of failing when a same-meaning verb is typed", () => {
    const ruEn = createStudy(
      [DO, MAKE],
      null,
      () => T,
      () => 0,
    )
    ruEn.state.session.exercise = {given: "ru", ask: "v1", mode: "type", options: []}
    answerCurrent(ruEn, "make")
    expect(ruEn.state.session.result).toBeNull()
    expect(ruEn.state.session.other?.en).toBe("make")
    expect(ruEn.state.session.answer).toBe("")
  })

  it("suggests Again after peeking", () => {
    const {study} = setup()
    study.peek()
    answerCurrent(study, "делать")
    expect(study.suggested.value).toBe(1)
  })

  it("restores progress in a new session and keeps it when words are added", () => {
    const {study, store, advance} = setup()
    answerCurrent(study, "делать")
    study.grade(4)
    advance(MINUTE)
    const again = createStudy(
      [{...WALK, id: "verb-zzz", en: "zzz"}, DO, MAKE, WALK],
      store,
      () => T + MINUTE,
      () => 0,
    )
    expect(again.state.cards.find((c) => c.id === "verb-do:en_ru")).toMatchObject({type: "review", ivl: 4})
    expect(again.state.day.newDone).toBe(1)
  })

  it("keeps progress of removed words in storage", () => {
    const {study, store} = setup()
    answerCurrent(study, "делать")
    study.grade(4)
    const without = createStudy(
      [MAKE, WALK],
      store,
      () => T,
      () => 0,
    )
    answerCurrent(without, "делать")
    without.grade(3)
    const saved = JSON.parse(store.data.get(STORAGE_KEY)!)
    expect(Object.keys(saved.cards).sort()).toEqual(["verb-do:en_ru", "verb-make:en_ru"])
  })

  it("opens RU → EN the day after EN → RU is learned", () => {
    const {study, advance} = setup([DO, WALK])
    expect(study.current.value?.id).toBe("verb-do:en_ru")
    answerCurrent(study, "делать")
    study.grade(4)
    expect(study.current.value?.id).toBe("verb-walk:en_ru")
    answerCurrent(study, "гулять")
    study.grade(4)
    expect(study.current.value).toBeNull()
    advance(24 * 60 * MINUTE)
    study.tick()
    expect(study.queue.value.news.map((c) => c.id)).toEqual(["verb-do:ru_en", "verb-walk:ru_en"])
  })

  it("rolls the day over at 4:00", () => {
    const {study, advance} = setup()
    answerCurrent(study, "делать")
    study.grade(3)
    advance(16 * 60 * MINUTE)
    study.tick()
    expect(study.state.day.done).toHaveLength(0)
    expect(study.state.day.newDone).toBe(0)
  })

  it("exports and imports progress, rejecting foreign files", () => {
    const {study} = setup()
    answerCurrent(study, "делать")
    study.grade(4)
    const exported = study.exportProgress()
    const other = setup()
    expect(other.study.importProgress('{"hello":1}')).toBe(false)
    expect(other.study.importProgress("not json")).toBe(false)
    expect(other.study.importProgress(exported)).toBe(true)
    expect(other.study.state.cards.find((c) => c.id === "verb-do:en_ru")).toMatchObject({type: "review"})
  })

  it("resets progress but keeps settings", () => {
    const {study, store} = setup()
    study.updateSettings({newPerDay: 5})
    answerCurrent(study, "делать")
    study.grade(4)
    study.resetProgress()
    const saved = JSON.parse(store.data.get(STORAGE_KEY)!)
    expect(saved.cards).toEqual({})
    expect(saved.settings.newPerDay).toBe(5)
  })

  it("applies placement results, resetting unknown cards and scheduling known ones", () => {
    const {study, store} = setup()
    answerCurrent(study, "делать")
    study.grade(4)
    const changed = study.applyPlacement(
      new Map([
        ["verb-do:en_ru", "unknown"],
        ["verb-make:en_ru", "known"],
        ["verb-walk:ru_en", "shaky"],
      ]),
    )
    expect(changed).toBe(3)
    const saved = JSON.parse(store.data.get(STORAGE_KEY)!)
    expect(saved.cards["verb-do:en_ru"]).toBeUndefined()
    expect(saved.cards["verb-make:en_ru"]).toMatchObject({type: "review", ivl: 7})
    expect(saved.cards["verb-walk:ru_en"]).toMatchObject({type: "review", ivl: 2})
    expect(study.current.value?.id).toBe("verb-make:ru_en")
  })

  it("survives corrupt storage", () => {
    const store = memoryStore()
    store.data.set(STORAGE_KEY, "{broken")
    const {study} = setup([DO], store)
    expect(study.current.value?.id).toBe("verb-do:en_ru")
  })
})
