import {dayOf} from "./scheduler"

import type {AnswerInput} from "./exercise"
import type {Field} from "./notes"
import type {Grade} from "./scheduler"

/** One answer given today, kept to show in the table and on the progress track. */
export interface DoneEntry {
  cardId: string
  noteId: string
  grade: Grade
  given: Field
  ask: Field
  text: string
  ok: boolean
  mode: AnswerInput
}

/** Today's counters: the limits, extra new cards asked for, the notes that got a new card today and the answers log; all reset when the day changes. */
export interface DayProgress {
  index: number
  newDone: number
  revDone: number
  extraNew: number
  introduced: string[]
  done: DoneEntry[]
}

/** An empty day for the given timestamp. */
export function freshDay(t: number): DayProgress {
  return {index: dayOf(t), newDone: 0, revDone: 0, extraNew: 0, introduced: [], done: []}
}

/** The same progress if `t` is still the same day, otherwise a fresh day. */
export function rollDay(day: DayProgress, t: number): DayProgress {
  return dayOf(t) === day.index ? day : freshDay(t)
}
