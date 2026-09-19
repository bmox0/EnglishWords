/** SM-2 scheduling state of one card, the part that is saved. */
export interface CardState {
  type: CardType
  step: number
  due: number
  ivl: number
  ease: number
  reps: number
  lapses: number
}

export type CardType = "new" | "learning" | "relearning" | "review"

/** Anki answer buttons: Again, Hard, Good, Easy. */
export type Grade = 1 | 2 | 3 | 4

export const MINUTE = 60_000
export const DAY = 86_400_000

/** Anki v3 scheduler defaults. */
export const SCHEDULER = {
  learnSteps: [1, 10],
  relearnSteps: [10],
  graduatingIvl: 1,
  easyIvl: 4,
  startEase: 2.5,
  minEase: 1.3,
  hardFactor: 1.2,
  easyBonus: 1.3,
  lapseMult: 0,
  maxIvl: 36500,
  dayStartHour: 4,
  learnAheadMin: 20,
  reviewsPerDay: 200,
} as const

/** A new card that has never been answered. */
export function freshState(): CardState {
  return {type: "new", step: 0, due: 0, ivl: 0, ease: SCHEDULER.startEase, reps: 0, lapses: 0}
}

/** Local day number; a day starts at 4:00 like in Anki, so a late-night session still counts as today. */
export function dayOf(ts: number): number {
  const d = new Date(ts - SCHEDULER.dayStartHour * 3_600_000)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY)
}

/** Timestamp of 4:00 local time on the given day number. */
export function dayStart(day: number): number {
  const d = new Date(day * DAY)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), SCHEDULER.dayStartHour).getTime()
}

function hardDelay(steps: readonly number[], step: number): number {
  const first = steps[0] ?? 1
  if (step > 0) return steps[step] ?? first
  const second = steps[1]
  return second !== undefined ? (first + second) / 2 : Math.min(first * 1.5, first + 1440)
}

/** Spreads review intervals over a few days so cards learned together do not stay together. */
export function fuzzInterval(ivl: number, random: () => number): number {
  if (ivl < 2.5) return ivl
  let delta = 1
  for (const [from, to, factor] of [
    [2.5, 7, 0.15],
    [7, 20, 0.1],
    [20, Infinity, 0.05],
  ] as const) {
    delta += factor * Math.max(0, Math.min(ivl, to) - from)
  }
  const lo = Math.max(2, Math.round(ivl - delta))
  const hi = Math.round(ivl + delta)
  return lo + Math.floor(random() * (hi - lo + 1))
}

/** The card state after answering with `grade` at time `t`; pass `random` to fuzz review intervals. */
export function nextState(card: CardState, grade: Grade, t: number, random?: () => number): CardState {
  const r: CardState = {...card, reps: card.reps + 1}
  const today = dayOf(t)
  const toReview = (ivl: number) => {
    r.type = "review"
    r.step = 0
    r.ivl = Math.min(ivl, SCHEDULER.maxIvl)
    r.due = dayStart(today + r.ivl)
  }

  if (card.type === "review") {
    if (grade === 1) {
      r.lapses = card.lapses + 1
      r.ease = Math.max(SCHEDULER.minEase, card.ease - 0.2)
      r.ivl = Math.max(1, Math.round(card.ivl * SCHEDULER.lapseMult))
      r.type = "relearning"
      r.step = 0
      r.due = t + (SCHEDULER.relearnSteps[0] ?? 10) * MINUTE
      return r
    }
    const delay = Math.max(0, today - dayOf(card.due))
    const hard = Math.max(card.ivl + 1, Math.round(card.ivl * SCHEDULER.hardFactor))
    const good = Math.max(hard + 1, Math.round((card.ivl + delay / 2) * card.ease))
    const easy = Math.max(good + 1, Math.round((card.ivl + delay) * card.ease * SCHEDULER.easyBonus))
    const ivl = grade === 2 ? hard : grade === 3 ? good : easy
    if (grade === 2) r.ease = Math.max(SCHEDULER.minEase, card.ease - 0.15)
    if (grade === 4) r.ease = card.ease + 0.15
    toReview(random ? fuzzInterval(ivl, random) : ivl)
    return r
  }

  const relearn = card.type === "relearning"
  const steps = relearn ? SCHEDULER.relearnSteps : SCHEDULER.learnSteps
  const step = card.type === "new" ? 0 : card.step
  const nextStep = steps[step + 1]
  r.type = relearn ? "relearning" : "learning"
  if (grade === 1) {
    r.step = 0
    r.due = t + (steps[0] ?? 1) * MINUTE
  } else if (grade === 2) {
    r.step = step
    r.due = t + hardDelay(steps, step) * MINUTE
  } else if (grade === 3 && nextStep !== undefined) {
    r.step = step + 1
    r.due = t + nextStep * MINUTE
  } else if (grade === 3) {
    toReview(relearn ? card.ivl : SCHEDULER.graduatingIvl)
  } else {
    toReview(relearn ? card.ivl + 1 : SCHEDULER.easyIvl)
  }
  return r
}
