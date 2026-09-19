---
name: add-words
description: Add words to the English Verbs deck in data/*.jsonl. Use when the user gives words, verbs or phrases to add ("add these verbs", "добавь слова"), sends a spreadsheet of words, or wants a new word set.
---

# Add words

Every word is one **entry**: a line in `data/*.jsonl`. Progress is keyed by the entry id, so ids are forever: never rename, reorder or reuse an existing id.

## Steps

1. **Learn the format.** Read `README.md` → "Adding words" (fields, id scheme, how cards are built). Then list what exists: `cat data/*.jsonl`.
   Done when you know which file each new word will go to and have checked every requested word against existing `en` values.

2. **Draft the entries.** Take the branch that matches the input:
   - **Words in chat**: write one entry per word yourself.
     - `en` is the base form without "to".
     - `ru` holds the 1–3 translations a learner would type, most common first. Every listed translation is accepted as an answer, so a missing common synonym means the learner's right answer gets marked wrong.
     - For verbs, `v2` and `v3` list every accepted variant (`["learned", "learnt"]`).
     - Set `irregular: true` when any form is not the verb plus -ed, -d, -ied or a doubled final consonant.
     - `tags` names the set, e.g. `["phrasal-verbs"]`.
   - **Spreadsheet**: run `pnpm words:import <file.xlsx> --tag <set>` (add `--pos <pos>` for non-verbs). New entries go to stdout. Existing ids are skipped, and words that need a hint are reported on stderr. Fix translations the sheet got wrong.

   Done when every requested word has an entry, or a stated reason why not (already in the deck, meaning unclear: ask).

3. **Resolve twins.** Twins are words that share a Russian translation (`do` / `make`: делать). Every twin needs a short Russian `hint` that tells it apart ("выполнять действие" / "изготавливать, создавать"). That includes an existing twin that has no hint yet: add one to its line and change nothing else.
   Done when `pnpm words:check` reports no "needs a hint" problem.

4. **Place the entries.**
   - A new set goes into a new file `data/<set>.jsonl`. Files load in name order, and new words are introduced in that order.
   - Words that extend an existing set are appended to the end of that file.
   - Keep the key order and spacing of the existing lines (`pnpm words:import` prints them that way).

   Done when the new lines are at the end of their files, and the existing lines differ only by hints added in step 3 (`git diff data/` shows nothing else).

5. **Check.** Run `pnpm words:check`.
   Done when it passes.

6. **Review with the user.** Show a table of the new entries (en | ru | v2 | v3 | irregular | hint) and point out the translations and hints you wrote yourself. Apply their corrections and repeat step 5.
   Done when the user confirms the entries.

7. **Publish, if the user wants it.** Commit only the data files: `feat(data): add <n> <set> words`. Push to `main`; the GitHub Actions deploy runs the tests and publishes the site. See `CLAUDE.md` → "Deploy" for the push account.
   Done when the deploy run for the commit is green, or the user chose to keep the change local.
