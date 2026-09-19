import {groupByNote, isUnlocked} from "./cards"
import {taskIndex} from "./exercise"
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

const isLearning = (card: Card) => card.type === "learning" || card.type === "relearning"

/**
 * Gathers today's queue. Reviews of every card are due on their day, siblings included.
 * New cards fill the daily limit: first siblings that just unlocked (RU → EN, then forms), then EN → RU of new words.
 * A note gets at most one new card a day, and none while one of its cards is in learning.
 */
export function buildQueue(cards: Card[], day: DayProgress, t: number, newPerDay: number): Queue {
  const byDue = (a: Card, b: Card) => a.due - b.due
  const aheadLimit = t + SCHEDULER.learnAheadMin * MINUTE
  const siblings = groupByNote(cards)
  const learning = cards.filter(isLearning).sort(byDue)

  const reviews = cards
    .filter((c) => c.type === "review" && dayOf(c.due) <= day.index)
    .sort(byDue)
    .slice(0, Math.max(0, SCHEDULER.reviewsPerDay - day.revDone))

  const blocked = new Set([...day.introduced, ...learning.map((c) => c.note.id)])
  const candidates = cards.filter((c) => c.type === "new" && !blocked.has(c.note.id) && isUnlocked(c, siblings.get(c.note.id) ?? []))
  const news: Card[] = []
  for (const c of [...candidates.filter((x) => x.kind !== "en_ru"), ...candidates.filter((x) => x.kind === "en_ru")]) {
    if (news.length >= newPerDay - day.newDone) break
    if (blocked.has(c.note.id)) continue
    blocked.add(c.note.id)
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

/**
 * The next card. Cards come in blocks by task, in the order of `TASKS`, so the kind of question changes only between blocks.
 * Within a block: due learning cards first, then reviews and new cards mixed evenly, then learning cards due soon,
 * so the block's mistakes are cleared before the next block starts.
 * A card of the note that was just answered is skipped while anything else in the block is available.
 */
export function pickNext(queue: Queue, day: DayProgress): Card | null {
  const task = (c: Card) => taskIndex(c, day.index)
  const available = [...queue.learnDue, ...queue.reviews, ...queue.news, ...queue.learnAhead]
  if (!available.length) return null
  const block = Math.min(...available.map(task))
  const inBlock = (cards: Card[]) => cards.filter((c) => task(c) === block)
  const reviews = inBlock(queue.reviews)
  const news = inBlock(queue.news)
  const last = day.done.at(-1)?.noteId
  const r = reviews.length
  const n = news.length
  const newFirst = r && n ? day.newDone / (day.newDone + n) < day.revDone / (day.revDone + r) : !r
  const middle = newFirst ? [...news, ...reviews] : [...reviews, ...news]
  const order = [...inBlock(queue.learnDue), ...middle, ...inBlock(queue.learnAhead)]
  return order.find((c) => c.note.id !== last) ?? order[0] ?? null
}

/** Cards still to answer today. */
export function remainingCount(queue: Queue): number {
  return queue.learnDue.length + queue.learnAhead.length + queue.reviews.length + queue.news.length
}
