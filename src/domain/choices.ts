import {levenshtein, normalize} from "./check"
import {display, valuesOf} from "./notes"

import type {Field, Note} from "./notes"

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/** The -ed form a learner would guess for an irregular verb: go → goed, take → taked, try → tried. */
export function regularPast(verb: string): string {
  if (/e$/.test(verb)) return `${verb}d`
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ied`
  return `${verb}ed`
}

/**
 * Up to four options in random order: the correct answer and wrong ones that are easy to mix up.
 * Forms are confused with the other forms of the same verb and its -ed guess, English words with similar spelling.
 * Words that share a translation with the note (do / make) are never offered, so exactly one option is right.
 */
export function buildOptions(note: Note, given: Field, ask: Field, notes: Note[], random: () => number = Math.random): string[] {
  const correct = display(note, ask)
  const prompt = display(note, given)
  const accepted = new Set(valuesOf(note, ask).map(normalize))
  const wrong: string[] = []
  const add = (option: string) => {
    if (wrong.length >= 3 || !option || option === correct || option === prompt || wrong.includes(option)) return
    if (option.split(/ \/ |, /).every((part) => accepted.has(normalize(part)))) return
    wrong.push(option)
  }

  const others = notes.filter((o) => o.id !== note.id && !o.ru.some((r) => note.ru.includes(r)) && valuesOf(o, ask).length > 0)
  if (ask === "ru") {
    shuffle(others, random).forEach((o) => add(display(o, "ru")))
    return shuffle([correct, ...wrong], random)
  }

  if (ask === "v2" || ask === "v3") shuffle([note.en, ...(note.v2 ?? []), ...(note.v3 ?? []), regularPast(note.en)], random).forEach(add)
  if (ask === "v1" && given === "v2") note.v3?.forEach(add)
  if (ask === "v1" && given === "v3") note.v2?.forEach(add)
  const near = others
    .map((o) => ({o, distance: levenshtein(o.en, note.en) + random()}))
    .sort((a, b) => a.distance - b.distance)
    .map(({o}) => o)
  shuffle(near.slice(0, 8), random).forEach((o) => add(display(o, ask)))
  near.slice(8).forEach((o) => add(display(o, ask)))
  return shuffle([correct, ...wrong], random)
}
