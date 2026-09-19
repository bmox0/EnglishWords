# English Verbs

Learn English verbs by typing them: the translation in both directions and the past forms, spaced out with Anki's SM-2 algorithm.

**Live:** https://bmox0.github.io/EnglishWords/

## Features

- **Dictation.** Each question asks one thing: a translation, the infinitive, or one past form. You type the answer or pick it from four options. Typos count as "almost", and a verb that shares the translation (`make` for делать) gets another try instead of a miss.
- **Verb table.** The table shows every verb with its forms, translation and progress. It has search and filters: All, Today, Mistakes, Learning, New, Learned. The verb on the card is hidden; you can peek, but then the card gets Again.
- **Anki scheduling.** Each verb has separate cards that open one by one: EN → RU, then RU → EN, then forms, for every verb.
- **Type or pick.** By default the answer field has four options below it: type the answer, or pick an option when you know the word but not the exact translation asked. **Settings → Answers** can switch to typing only or picking only (handy on a phone). The wrong options are easy to confuse with the right one: other forms of the same verb, the `-ed` guess (`goed`), words spelled alike.
- **Placement test.** Go through a whole topic in one run. The saved answers count like answers on the cards.
- **After the daily plan.** **Learn 10 more cards** raises today's new-card limit. **Practice mistakes** drills up to 20 cards you got wrong without changing when they come back.
- **Anywhere.** Works on a phone (the table becomes a full-screen sheet) and has a light and a dark theme.
- **No account.** Progress stays in your browser and can be exported to a file.

## Keys

| Key   | When                                                 |
| ----- | ---------------------------------------------------- |
| Enter | check the answer, then go to the next card           |
| 1–4   | pick an option, or change the grade after the answer |
| Esc   | close the table on a phone                           |
| 0     | "Don't know" in the placement test                   |

An empty typed answer means "don't remember".

## How cards are scheduled

Cards follow Anki's v3 defaults: learning steps of 1 and 10 minutes, then 1 day (4 days on Easy); ease starts at 250%; a day starts at 4:00. **Settings** controls how many new cards appear per day (20 by default).

- **Automatic grades.** Every answer is graded on its own: Again for a miss, "don't know" or a peek; Hard for a typo or a right answer slower than 12 s when picking (20 s when typing); Good otherwise. Easy is never given automatically. Keys 1–4 change the grade, and tapping an option again after the answer goes to the next card.
- **Unlocking.** A new word starts with EN → RU. RU → EN opens the day after EN → RU is learned, and forms open the day after RU → EN. Opened cards use the daily new-card limit before new words do.
- **No siblings back to back.** Cards of the same word never come one right after another.

## Placement test

The stopwatch button opens the test. Choose the skills (EN → RU, RU → EN, V1 → V2, V1 → V3) and how many words each skill takes: all, 100, 50 or 20 from the top of the list. The next question comes right away, without feedback. Questions follow **Settings → Answers**.

The test is not a separate mode: it is a fast way to answer many cards at once. **Save answers** adds every answer to the history, the same as an answer on the card. Each answer gets the automatic grade (Good, Hard or Again), the card moves on by the scheduler, and the answer shows up under **Today** in the table. V1 → V2 and V1 → V3 both answer the forms card, which is graded once by the worse of the two. You can stop early and save what you have answered.

## Progress

Progress lives in `localStorage` under `english-words:v1`, so each browser and device has its own. **Settings → Export / Import** moves it between devices or backs it up.

Progress is stored per card id (`<word id>:<kind>`), so adding, reordering or removing words never loses what you have learned.

## Adding words

Words live in `data/<NN>-<set>.jsonl`, one JSON object per line, for example `data/01-150-verbs.jsonl`. Files load in number order and new words are introduced in that order, so a new set takes the next number (`data/02-phrasal-verbs.jsonl`). The set name doubles as the words' tag.

<!-- prettier-ignore -->
```jsonl
{"id": "verb-get", "pos": "verb", "en": "get", "ru": ["получать"], "v2": ["got"], "v3": ["got", "gotten"], "irregular": true, "tags": ["150-verbs"], "hint": "разг.: доставать, добывать"}
```

| Field       | Required | Notes                                                                                                        |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `id`        | yes      | `<pos>-<word>` in lowercase. Progress is attached to it, so it never changes once studied.                   |
| `pos`       | yes      | Part of speech: `verb`, `noun`, `adjective`, …                                                               |
| `en`        | yes      | The English word; the infinitive (without "to") for verbs.                                                   |
| `ru`        | yes      | Translations. Any of them is accepted as an answer, so list the common ones.                                 |
| `v2`, `v3`  | verbs    | Past simple and past participle; every accepted variant goes in the list (`["was", "were"]`).                |
| `irregular` | no       | `true` when a form is not built with -ed, -d, -ied or a doubled consonant. The table dims the regular forms. |
| `hint`      | twins    | Required for words that share a Russian translation (`do` / `make`), shown next to the Russian prompt.       |
| `tags`      | yes      | Labels for the set; may be empty.                                                                            |

Words without `v2`/`v3` (nouns, adjectives) get only the two translation cards.

**From a spreadsheet:** `pnpm words:import words.xlsx --tag <set>` prints new lines. The first row must name the columns (`v1`/`en`, `перевод`/`ru`, `v2`, `v3`, optional `hint`). Words already in the deck are skipped, and words that need a hint are listed.

**With Claude Code:** the project skill `.claude/skills/add-words` handles the steps: drafting entries, hints for twins, validation, review and publishing. Ask for example "add these verbs: swim, fly, forgive".

`pnpm words:check` validates the data: JSON, required fields, id format, repeated words, hints for twins. The deploy runs it too, so a broken line never reaches the site.

## Development

```bash
pnpm install
pnpm dev        # local server
pnpm check      # typecheck + tests
pnpm build      # static site in dist/
```

Built with Vue 3, TypeScript, Vite and Vitest, with no runtime dependencies besides Vue. The code map and project rules are in [`CLAUDE.md`](CLAUDE.md).

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
