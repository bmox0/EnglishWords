#!/usr/bin/env node
import {readdirSync, readFileSync} from "node:fs"
import {join} from "node:path"
import {inflateRawSync} from "node:zlib"

const USAGE = `Converts a spreadsheet of words into data/*.jsonl lines.

Usage: node scripts/xlsx-to-jsonl.mjs <file.xlsx> [--tag <tag>] [--pos <pos>] [--sheet <n>]

The first row holds the headers; columns are matched by name, in any order:
  en    v1, infinitive, en, english, word
  ru    перевод, translation, ru, russian
  v2    v2, past simple
  v3    v3, past participle
  hint  hint, подсказка
Rows with both v2 and v3 become verbs; other rows need --pos (noun, adjective, ...).
New lines go to stdout; skipped rows and words that need a hint go to stderr.`

const END = String.raw`(?=$|[\s(:])`
const HEADERS = {
  en: new RegExp(`^(v1|infinitive|en|english|word)${END}`, "i"),
  ru: new RegExp(`^(перевод|translation|ru|russian)${END}`, "i"),
  v2: new RegExp(`^(v2|past simple)${END}`, "i"),
  v3: new RegExp(`^(v3|past participle)${END}`, "i"),
  hint: new RegExp(`^(hint|подсказка)${END}`, "i"),
}

function parseArgs(argv) {
  const args = {file: null, tag: null, pos: null, sheet: 1}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--tag") args.tag = argv[++i]
    else if (arg === "--pos") args.pos = argv[++i]
    else if (arg === "--sheet") args.sheet = Number(argv[++i])
    else if (arg === "--help" || arg === "-h") args.help = true
    else args.file = arg
  }
  return args
}

function unzip(buffer) {
  let end = buffer.length - 22
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error("not an .xlsx file (no zip directory found)")
  const files = new Map()
  let offset = buffer.readUInt32LE(end + 16)
  for (let i = buffer.readUInt16LE(end + 10); i > 0; i--) {
    const method = buffer.readUInt16LE(offset + 10)
    const size = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const local = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength)
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28)
    const data = buffer.subarray(start, start + size)
    files.set(name, method === 8 ? inflateRawSync(data) : data)
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
  }
  return files
}

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function textOf(xml) {
  return decode([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""))
}

function columnIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A"
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
}

function readRows(files, sheet) {
  const shared = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
  const xml = files.get(`xl/worksheets/sheet${sheet}.xml`)?.toString("utf8")
  if (!xml) throw new Error(`sheet ${sheet} not found`)
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells = []
    for (const cell of row[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, body = ""] = cell
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      const type = attrs.match(/t="(\w+)"/)?.[1]
      cells[columnIndex(ref)] = type === "s" ? (shared[Number(value)] ?? "") : type === "inlineStr" ? textOf(body) : decode(value ?? "")
    }
    return cells.map((c) => (c ?? "").trim())
  })
}

function regularForms(verb) {
  const forms = new Set([`${verb}ed`, `${verb}${verb.at(-1)}ed`])
  if (verb.endsWith("e")) forms.add(`${verb}d`)
  if (/[^aeiou]y$/.test(verb)) forms.add(`${verb.slice(0, -1)}ied`)
  return forms
}

const split = (text, pattern) =>
  text
    .split(pattern)
    .map((s) => s.trim())
    .filter(Boolean)

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

function serialize(entry) {
  const value = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v))
  return `{${Object.entries(entry)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${JSON.stringify(k)}: ${value(v)}`)
    .join(", ")}}`
}

function existingNotes() {
  const dir = join(import.meta.dirname, "..", "data")
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) =>
      readFileSync(join(dir, f), "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => ({...JSON.parse(line), file: `data/${f}`})),
    )
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.file) {
    console.error(USAGE)
    process.exit(args.help ? 0 : 1)
  }

  const [header = [], ...rows] = readRows(unzip(readFileSync(args.file)), args.sheet)
  const columns = Object.fromEntries(Object.entries(HEADERS).map(([key, pattern]) => [key, header.findIndex((h) => pattern.test(h))]))
  if (columns.en < 0 || columns.ru < 0) throw new Error(`need an English and a Russian column, found headers: ${header.join(" | ")}`)

  const existing = existingNotes()
  const byId = new Map(existing.map((n) => [n.id, n]))
  const byRu = new Map()
  const added = []

  rows.forEach((row, index) => {
    const cell = (key) => (columns[key] >= 0 ? (row[columns[key]] ?? "") : "")
    const en = cell("en").replace(/^to\s+/i, "")
    if (!en) return
    const v2 = split(cell("v2"), /\s*[/,]\s*/)
    const v3 = split(cell("v3"), /\s*[/,]\s*/)
    const pos = v2.length && v3.length ? "verb" : args.pos
    if (!pos) {
      console.error(`row ${index + 2} (${en}): no v2/v3, pass --pos to add it`)
      return
    }
    const id = `${pos}-${slug(en)}`
    if (byId.has(id)) {
      console.error(`skip ${id}: already in ${byId.get(id).file}`)
      return
    }
    const regular = regularForms(en.toLowerCase())
    const entry = {
      id,
      pos,
      en,
      ru: split(cell("ru"), /\s*[/,;]\s*/),
      v2: pos === "verb" ? v2 : undefined,
      v3: pos === "verb" ? v3 : undefined,
      irregular: pos === "verb" ? ![...v2, ...v3].every((f) => regular.has(f.toLowerCase())) : undefined,
      tags: args.tag ? [args.tag] : [],
      hint: cell("hint") || undefined,
    }
    byId.set(id, {...entry, file: "this sheet"})
    added.push(entry)
  })

  for (const note of [...existing, ...added]) {
    for (const ru of note.ru) byRu.set(ru, [...(byRu.get(ru) ?? []), note])
  }
  for (const entry of added) {
    const twins = entry.ru.flatMap((ru) => (byRu.get(ru) ?? []).filter((n) => n.id !== entry.id).map((n) => `${n.en} (${ru})`))
    if (twins.length && !entry.hint) console.error(`needs a hint: ${entry.id} shares a translation with ${[...new Set(twins)].join(", ")}`)
  }

  for (const entry of added) console.log(serialize(entry))
  console.error(`${added.length} new ${added.length === 1 ? "word" : "words"}`)
}

main()
