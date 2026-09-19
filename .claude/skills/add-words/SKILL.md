---
name: add-words
description: Add words to the English Verbs deck in data/*.jsonl. Use when the user gives words, verbs or phrases to add ("add these verbs", "добавь слова"), sends a spreadsheet of words, or wants a new word set.
---

# Add words

Every word is one **entry**: a line in `data/<NN>-<set>.jsonl`. Progress is keyed by the entry id, so ids are forever: never rename, reorder or reuse an existing id.

## Steps

1. **Learn the format.** Read `README.md` → "Adding words" (fields, id scheme, file naming, how cards are built). Then read the deck: `ls data` and `cat data/*.jsonl`.
   Done when every requested word is checked against the existing `en` values.

2. **Pick the set.** The set gives both the file and the tag.
   - The user named a set: use its file, or create `data/<next NN>-<set>.jsonl` if it is new.
   - The user named no set: use `added`, in `data/<NN>-added.jsonl`, created with the next number if missing.

   Done when you know the file path and the tag.

3. **Draft the entries.** Take the branch that matches the input:
   - **Words in chat**: write one entry per word yourself.
     - `pos` is the part of speech. `id` is `<pos>-<en>`, in lowercase with spaces as hyphens.
     - `en` is the base form without "to".
     - `ru` holds the 1–3 translations a learner would type, most common first. Every listed translation is accepted as an answer, so a missing common synonym means the learner's right answer gets marked wrong.
     - For verbs, `v2` and `v3` list every accepted variant (`["learned", "learnt"]`).
     - Set `irregular: true` when any form is not the verb plus -ed, -d, -ied or a doubled final consonant.
     - `tags` is `[<set>]`.
   - **Spreadsheet**: run `pnpm words:import <file.xlsx> --tag <set>` (add `--pos <pos>` for non-verbs). New entries go to stdout. Existing ids are skipped, and words that need a hint are reported on stderr. Fix translations the sheet got wrong.

   Skip a word that is already in the deck and name it in the review. If a word's meaning is unclear, ask the user before drafting it.
   Done when every requested word has an entry or is on the skip list.

4. **Place the entries.** Append them to the end of the set's file, keeping the key order and spacing of the existing lines (`pnpm words:import` prints them that way).
   Done when the new lines sit at the end of the set's file and no existing line changed.

5. **Resolve twins and check.** Twins are words that share a Russian translation (`do` / `make`: делать). Run `pnpm words:check`. Every "needs a hint" problem names a twin: give it a short Russian `hint` that tells it apart ("выполнять действие" / "изготавливать, создавать"). This includes an existing twin in another file; add the hint to its line and change nothing else.
   Done when `pnpm words:check` passes.

6. **Review with the user.** Show a table of the new entries (en | ru | v2 | v3 | irregular | hint), the set, and the skip list. Point out the translations and hints you wrote yourself. Apply their corrections and repeat step 5.
   Done when the user confirms the entries.

7. **Publish, if the user wants it.** Commit only the data files: `feat(data): add <n> words to <set>`. Push to `main`; the GitHub Actions deploy runs the tests and publishes the site. See `CLAUDE.md` → "Deploy" for the push account.
   Done when the deploy run for the commit is green, or the user chose to keep the change local.
