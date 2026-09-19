import {dayOf, MINUTE, SCHEDULER} from "./scheduler"

import type {Card} from "./cards"
import type {DayProgress} from "./day"

/** Cards available right now, grouped the way Anki gathers them. */
export interface Queue {
  learnDue: Card[]
  learnAhead: Card[]
  later: Card[]
  reviews: Card[]
  news: Card[]
}

/** Gathers today's queue: learning cards by due time, then reviews and new cards within the daily limits, one card per note. */
export function buildQueue(cards: Card[], day: DayProgress, t: number, newPerDay: number): Queue {
  const byDue = (a: Card, b: Card) => a.due - b.due
  const aheadLimit = t + SCHEDULER.learnAheadMin * MINUTE
  const learning = cards.filter((c) => c.type === "learning" || c.type === "relearning").sort(byDue)
  const seen = new Set(day.touched)
  learning.forEach((c) => seen.add(c.note.id))

  const reviews: Card[] = []
  const reviewRoom = SCHEDULER.reviewsPerDay - day.revDone
  for (const c of cards.filter((x) => x.type === "review" && dayOf(x.due) <= day.index).sort(byDue)) {
    if (reviews.length >= reviewRoom) break
    if (seen.has(c.note.id)) continue
    seen.add(c.note.id)
    reviews.push(c)
  }

  const news: Card[] = []
  const newRoom = newPerDay - day.newDone
  for (const c of cards) {
    if (news.length >= newRoom) break
    if (c.type !== "new" || seen.has(c.note.id)) continue
    seen.add(c.note.id)
    news.push(c)
  }

  return {
    learnDue: learning.filter((c) => c.due <= t),
    learnAhead: learning.filter((c) => c.due > t && c.due <= aheadLimit),
    later: learning.filter((c) => c.due > aheadLimit),
    reviews,
    news,
  }
}

/** The next card to show: due learning cards first, then reviews and new cards mixed evenly, then learning cards due soon. */
export function pickNext(queue: Queue, day: DayProgress): Card | null {
  if (queue.learnDue[0]) return queue.learnDue[0]
  const r = queue.reviews.length
  const n = queue.news.length
  if (r && n) {
    const newShare = day.newDone / (day.newDone + n)
    const reviewShare = day.revDone / (day.revDone + r)
    return (newShare < reviewShare ? queue.news[0] : queue.reviews[0]) ?? null
  }
  return queue.reviews[0] ?? queue.news[0] ?? queue.learnAhead[0] ?? null
}

/** Cards still to answer today. */
export function remainingCount(queue: Queue): number {
  return queue.learnDue.length + queue.learnAhead.length + queue.reviews.length + queue.news.length
}
