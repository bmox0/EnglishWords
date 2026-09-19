import {hasForms} from "./notes"
import {freshState} from "./scheduler"

import type {Note} from "./notes"
import type {CardState} from "./scheduler"

/** What a card drills: English to Russian, Russian to English, or the verb forms. */
export type CardKind = "en_ru" | "ru_en" | "forms"

/** Which verbs get a forms card. */
export type FormsFor = "irregular" | "all"

/** A scheduled card; its id `<note id>:<kind>` keeps progress attached when words are added or reordered. */
export interface Card extends CardState {
  id: string
  kind: CardKind
  note: Note
}

export type Maturity = "new" | "learn" | "young" | "mature"

/** The kinds of cards a note produces. */
export function cardKinds(note: Note, formsFor: FormsFor): CardKind[] {
  const kinds: CardKind[] = ["en_ru", "ru_en"]
  if (hasForms(note) && (formsFor === "all" || note.irregular)) kinds.push("forms")
  return kinds
}

/** All cards for the notes, restoring saved progress by card id and starting the rest as new. */
export function buildCards(notes: Note[], formsFor: FormsFor, saved: Record<string, CardState>): Card[] {
  return notes.flatMap((note) =>
    cardKinds(note, formsFor).map((kind) => {
      const id = `${note.id}:${kind}`
      return {...freshState(), ...saved[id], id, kind, note}
    }),
  )
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
