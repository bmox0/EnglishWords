import {parseNotes} from "./notes"

import type {Note} from "./notes"

const files = import.meta.glob<string>("../../data/*.jsonl", {query: "?raw", import: "default", eager: true})

/** Every note from every `data/*.jsonl` file, files in name order and lines in file order. */
export const NOTES: Note[] = Object.keys(files)
  .sort()
  .flatMap((path) => parseNotes(files[path] ?? "", path.replace(/^.*\//, "")))
