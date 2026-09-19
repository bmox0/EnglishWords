# English Verbs

Learn English verbs by typing them: the translation in both directions and the past forms, spaced out with Anki's SM-2 algorithm.

**Live:** https://bmox0.github.io/EnglishWords/

## Features

- **Dictation.** Each question asks one thing: a translation, the infinitive, or one past form. You type the answer or pick it from four options. Typos count as "almost", and a verb that shares the translation (`make` for делать) gets another try instead of a miss.
- **Verb table.** The table shows every verb with its forms, translation and progress. It has search and filters: All, Today, Mistakes, Learning, New, Learned. The verb on the card is hidden; you can peek, but then the grade offered is Again.
- **Anki scheduling.** Each verb has separate cards that open one by one: EN → RU, then RU → EN, then forms (irregular verbs only by default).
- **Mixed answers.** About 40% of answers are picked from four options and 60% are typed, balanced over the day. The wrong options are easy to confuse with the right one: other forms of the same verb, the `-ed` guess (`goed`), words spelled alike.
- **Placement test.** It checks what you already know, so study time goes to the rest.
- **After the daily plan.** **Learn 10 more cards** raises today's new-card limit. **Practice mistakes** drills up to 20 cards you got wrong without changing when they come back.
- **Anywhere.** Works on a phone (the table becomes a full-screen sheet) and has a light and a dark theme.
- **No account.** Progress stays in your browser and can be exported to a file.

## Keys

| Key   | When                                              |
| ----- | ------------------------------------------------- |
| Enter | check the answer, then accept the suggested grade |
| 1–4   | pick an option, or choose another grade           |
| Esc   | close the table on a phone                        |
| 0     | "Don't know" in the placement test                |

An empty typed answer means "don't remember".

## How cards are scheduled

Cards follow Anki's v3 defaults: learning steps of 1 and 10 minutes, then 1 day (4 days on Easy); ease starts at 250%; a day starts at 4:00. **Settings** controls how many new cards appear per day (20 by default).

- **Unlocking.** A new word starts with EN → RU. RU → EN opens the day after EN → RU is learned, and forms open the day after RU → EN. Opened cards use the daily new-card limit before new words do.
- **No siblings back to back.** Cards of the same word never come one right after another.
- **Answer modes.** **Settings → Answers** switches between the 40/60 mix, always typing and always picking. The first look at a brand-new word is always picked.

## Placement test

The stopwatch button opens the test. Choose the skills (EN → RU, RU → EN, V1 → V2, V1 → V3), and every word is asked once. The next question comes right away, without feedback. Questions follow **Settings → Answers**.

| Result | Rule                                                        | What happens to the card        |
| ------ | ----------------------------------------------------------- | ------------------------------- |
| Known  | right within 4 s (8 s when typing)                          | review in 7–21 days, spread out |
| Unsure | right but slower, or typed with a typo                      | review in 2–4 days              |
| New    | wrong, "Don't know", or slower than 12 s (20 s when typing) | starts over as new              |

V1 → V2 and V1 → V3 both rate the forms card, which takes the worse result. **Apply to progress** replaces the state of every tested card. You can stop early and apply what you have answered.

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
| `irregular` | no       | `true` when a form is not built with -ed, -d, -ied or a doubled consonant. Irregular verbs get a forms card. |
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
