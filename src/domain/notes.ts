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

/** Returns a human-readable problem for every note that breaks the data format; empty means valid. */
export function validateNotes(notes: Note[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  notes.forEach((note, index) => {
    const where = `note #${index + 1} (${note?.id ?? "no id"})`
    if (typeof note?.id !== "string" || !note.id.trim()) problems.push(`${where}: id must be a non-empty string`)
    else if (seen.has(note.id)) problems.push(`${where}: duplicate id`)
    else seen.add(note.id)
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
