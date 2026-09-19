import {readdirSync} from "node:fs"
import {describe, expect, it} from "vitest"

import {NOTES} from "./data"
import {parseNotes, validateNotes} from "./notes"

describe("word data", () => {
  it("loads every data file", () => {
    expect(NOTES.length).toBeGreaterThanOrEqual(150)
  })

  it("names files <NN>-<set>.jsonl, so sets load in a stable order", () => {
    const files = readdirSync("data").filter((f) => f.endsWith(".jsonl"))
    expect(files.filter((f) => !/^\d{2}-[a-z0-9-]+\.jsonl$/.test(f))).toEqual([])
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

  it("reports malformed ids, repeated words and shared translations without a hint", () => {
    const notes = parseNotes(
      [
        '{"id":"Verb_Go","pos":"verb","en":"go","ru":["идти"],"v2":["went"],"v3":["gone"],"tags":[]}',
        '{"id":"verb-go-2","pos":"verb","en":"Go","ru":["ехать"],"v2":["went"],"v3":["gone"],"tags":[]}',
        '{"id":"verb-do","pos":"verb","en":"do","ru":["делать"],"v2":["did"],"v3":["done"],"tags":[],"hint":"выполнять действие"}',
        '{"id":"verb-make","pos":"verb","en":"make","ru":["делать"],"v2":["made"],"v3":["made"],"tags":[]}',
      ].join("\n"),
    )
    expect(validateNotes(notes)).toEqual([
      "note #1 (Verb_Go): id must look like <pos>-<word> in lowercase, e.g. verb-get",
      'note #2 (verb-go-2): verb "Go" is already listed as Verb_Go',
      'verb-make: shares the translation "делать" with do, so it needs a hint',
    ])
  })

  it("names the broken line", () => {
    expect(() => parseNotes('{"id":"a"}\n\n{oops', "extra.jsonl")).toThrow("extra.jsonl:3: invalid JSON")
  })
})
