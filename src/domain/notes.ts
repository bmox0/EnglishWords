/** One word from `data/*.jsonl`. Verbs carry `v2` and `v3`; other parts of speech may omit them. */
export interface Note {
  id: string
  pos: string
  en: string
  ru: string[]
  v2?: string[]
  v3?: string[]
  irregular?: boolean
  tags: string[]
  hint?: string
}

/** A side of a note that can be shown or asked: the translation, the infinitive, or a verb form. */
export type Field = "ru" | "v1" | "v2" | "v3"

/** Parses JSONL text into notes; blank lines are skipped and a malformed line throws with its number. */
export function parseNotes(source: string, fileName = "data"): Note[] {
  return source.split("\n").flatMap((line, index) => {
    if (!line.trim()) return []
    try {
      return [JSON.parse(line) as Note]
    } catch {
      throw new Error(`${fileName}:${index + 1}: invalid JSON`)
    }
  })
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim() !== "")

const ID_PATTERN = /^[a-z]+(-[a-z0-9]+)+$/

/**
 * Returns a human-readable problem for every note that breaks the data format; empty means valid.
 * Besides field types it checks that ids look like `<pos>-<word>`, that a word is not listed twice,
 * and that words sharing a Russian translation all carry a hint, so an RU → EN question has one answer.
 */
export function validateNotes(notes: Note[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const words = new Map<string, string>()
  const byTranslation = new Map<string, Note[]>()
  notes.forEach((note, index) => {
    const where = `note #${index + 1} (${note?.id ?? "no id"})`
    const duplicate = typeof note?.id === "string" && seen.has(note.id)
    if (typeof note?.id !== "string" || !note.id.trim()) problems.push(`${where}: id must be a non-empty string`)
    else if (duplicate) problems.push(`${where}: duplicate id`)
    else if (!ID_PATTERN.test(note.id)) problems.push(`${where}: id must look like <pos>-<word> in lowercase, e.g. verb-get`)
    if (typeof note?.id === "string") seen.add(note.id)
    if (!duplicate) {
      const word = `${note.pos}:${typeof note.en === "string" ? note.en.toLowerCase() : ""}`
      if (words.has(word)) problems.push(`${where}: ${note.pos} "${note.en}" is already listed as ${words.get(word)}`)
      else words.set(word, note.id)
      if (isStringList(note.ru)) for (const ru of note.ru) byTranslation.set(ru, [...(byTranslation.get(ru) ?? []), note])
    }
    if (typeof note.pos !== "string" || !note.pos.trim()) problems.push(`${where}: pos must be a non-empty string`)
    if (typeof note.en !== "string" || !note.en.trim()) problems.push(`${where}: en must be a non-empty string`)
    if (!isStringList(note.ru)) problems.push(`${where}: ru must be a non-empty list of strings`)
    for (const key of ["v2", "v3"] as const) {
      if (note[key] !== undefined && !isStringList(note[key])) problems.push(`${where}: ${key} must be a non-empty list of strings`)
      if (note.pos === "verb" && note[key] === undefined) problems.push(`${where}: verbs need ${key}`)
    }
    if (note.irregular !== undefined && typeof note.irregular !== "boolean") problems.push(`${where}: irregular must be a boolean`)
    if (!Array.isArray(note.tags) || !note.tags.every((tag) => typeof tag === "string")) problems.push(`${where}: tags must be a list of strings`)
    if (note.hint !== undefined && typeof note.hint !== "string") problems.push(`${where}: hint must be a string`)
  })
  for (const [ru, shared] of byTranslation) {
    if (shared.length < 2) continue
    for (const note of shared.filter((n) => !n.hint?.trim())) {
      const others = shared.filter((n) => n !== note).map((n) => n.en)
      problems.push(`${note.id}: shares the translation "${ru}" with ${others.join(", ")}, so it needs a hint`)
    }
  }
  return problems
}

/** Whether the note has past forms to drill. */
export function hasForms(note: Note): boolean {
  return !!note.v2?.length && !!note.v3?.length
}

/** Accepted answers for a field. */
export function valuesOf(note: Note, field: Field): string[] {
  if (field === "ru") return note.ru
  if (field === "v1") return [note.en]
  return note[field] ?? []
}

/** A field as it is printed: translations joined by commas, form variants by slashes. */
export function display(note: Note, field: Field): string {
  return valuesOf(note, field).join(field === "ru" ? ", " : " / ")
}
