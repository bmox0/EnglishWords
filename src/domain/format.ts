import {dayOf, MINUTE} from "./scheduler"

import type {Card} from "./cards"

/** A day count the way Anki prints it: 4d, 1.5mo, 2y. */
export function formatDays(days: number): string {
  const short = (x: number) => x.toFixed(1).replace(/\.0$/, "")
  if (days < 30) return `${days}d`
  if (days < 365) return `${short(days / 30)}mo`
  return `${short(days / 365)}y`
}

/** A duration in minutes: <1m, 10m, 3h, then days. */
export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${Math.round(minutes)}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return formatDays(Math.round(minutes / 1440))
}

/** When a card comes back, relative to `t`. */
export function dueText(card: Card, t: number): string {
  if (card.type === "new") return "not seen yet"
  if (card.type === "review") {
    const days = dayOf(card.due) - dayOf(t)
    return days <= 0 ? "today" : `in ${formatDays(days)}`
  }
  const minutes = (card.due - t) / MINUTE
  return minutes <= 0 ? "now" : `in ${formatMinutes(minutes)}`
}

/** "1 card", "3 cards". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}
