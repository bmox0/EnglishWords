import {describe, expect, it} from "vitest"

import {NOTES} from "./data"
import {parseNotes, validateNotes} from "./notes"

describe("word data", () => {
  it("loads every data file", () => {
    expect(NOTES.length).toBeGreaterThanOrEqual(150)
  })

  it("is valid: unique ids, required fields, form lists for verbs", () => {
    expect(validateNotes(NOTES)).toEqual([])
  })
})

describe("validateNotes", () => {
  it("reports duplicates and missing verb forms", () => {
    const notes = parseNotes(
      [
        '{"id":"verb-go","pos":"verb","en":"go","ru":["идти"],"v2":["went"],"v3":["gone"],"tags":[]}',
        '{"id":"verb-go","pos":"verb","en":"go","ru":["идти"],"tags":[]}',
        '{"id":"noun-cat","pos":"noun","en":"cat","ru":[],"tags":[]}',
      ].join("\n"),
    )
    expect(validateNotes(notes)).toEqual([
      "note #2 (verb-go): duplicate id",
      "note #2 (verb-go): verbs need v2",
      "note #2 (verb-go): verbs need v3",
      "note #3 (noun-cat): ru must be a non-empty list of strings",
    ])
  })

  it("names the broken line", () => {
    expect(() => parseNotes('{"id":"a"}\n\n{oops', "extra.jsonl")).toThrow("extra.jsonl:3: invalid JSON")
  })
})
