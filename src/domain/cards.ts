import {hasForms} from "./notes"
import {freshState} from "./scheduler"

import type {Note} from "./notes"
import type {CardState} from "./scheduler"

/** What a card drills: English to Russian, Russian to English, or the verb forms. */
export type CardKind = "en_ru" | "ru_en" | "forms"

/** A scheduled card; its id `<note id>:<kind>` keeps progress attached when words are added or reordered. */
export interface Card extends CardState {
  id: string
  kind: CardKind
  note: Note
}

export type Maturity = "new" | "learn" | "young" | "mature"

/** The kinds of cards a note produces: every note with forms gets a forms card. */
export function cardKinds(note: Note): CardKind[] {
  return hasForms(note) ? ["en_ru", "ru_en", "forms"] : ["en_ru", "ru_en"]
}

/** All cards for the notes, restoring saved progress by card id and starting the rest as new. */
export function buildCards(notes: Note[], saved: Record<string, CardState>): Card[] {
  return notes.flatMap((note) =>
    cardKinds(note).map((kind) => {
      const id = `${note.id}:${kind}`
      return {...freshState(), ...saved[id], id, kind, note}
    }),
  )
}

const PREREQUISITE: Record<CardKind, CardKind | null> = {en_ru: null, ru_en: "en_ru", forms: "ru_en"}

/** The sibling that must be learned before this kind opens: RU → EN waits for EN → RU, forms wait for RU → EN. */
export function prerequisiteOf(kind: CardKind): CardKind | null {
  return PREREQUISITE[kind]
}

/** Whether a card has left the learning steps at least once; relearning keeps its interval, so it still counts. */
export function hasGraduated(card: CardState): boolean {
  return card.ivl > 0
}

/** Whether a card can be shown: a new card stays locked until its prerequisite sibling has graduated. */
export function isUnlocked(card: Card, siblings: Card[]): boolean {
  if (card.type !== "new") return true
  const kind = prerequisiteOf(card.kind)
  const prerequisite = kind && siblings.find((c) => c.kind === kind)
  return !prerequisite || hasGraduated(prerequisite)
}

/** Cards grouped by note id. */
export function groupByNote(cards: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>()
  for (const card of cards) {
    const list = map.get(card.note.id)
    if (list) list.push(card)
    else map.set(card.note.id, [card])
  }
  return map
}

/** The saveable part of a card. */
export function stateOf(card: Card): CardState {
  const {type, step, due, ivl, ease, reps, lapses} = card
  return {type, step, due, ivl, ease, reps, lapses}
}

/** How well a card is known: reviews with an interval of 21 days or more count as mature, like in Anki. */
export function maturity(card: CardState): Maturity {
  if (card.type === "new") return "new"
  if (card.type === "learning" || card.type === "relearning") return "learn"
  return card.ivl >= 21 ? "mature" : "young"
}
