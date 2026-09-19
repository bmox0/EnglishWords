# English Verbs

Learn English verbs by typing: the translation both ways and the past forms, scheduled with Anki's SM-2 algorithm.

**Live:** https://bmox0.github.io/EnglishWords/

- Left: a dictation. Each question asks one thing — the translation, the infinitive, or one past form. Press Enter to check, then Enter again to accept the suggested grade (or 1–4 for another one).
- Right: the verb table with search, filters and per-verb progress. The verb on the card is hidden; clicking it lets you peek, and the grade offered becomes Again.
- On a phone the table opens as a full-screen sheet from the **Table** button.

## Progress

Progress lives in the browser's `localStorage` under the key `english-words:v1`, so every browser and device has its own. Use **Settings → Export / Import** to back it up or move it between devices.

Progress is stored per card id (`<word id>:<kind>`), so adding, reordering or removing words never loses what was already learned.

## Adding words

Words live in `data/*.jsonl`, one JSON object per line. Every file in `data/` is loaded, in file-name order, so a new set can go into a new file (for example `data/200-verbs.jsonl`). New words are introduced after the existing ones, within the daily limit of new cards.

```json
{
  "id": "verb-get",
  "pos": "verb",
  "en": "get",
  "ru": ["получать"],
  "v2": ["got"],
  "v3": ["got", "gotten"],
  "irregular": true,
  "tags": ["150-verbs"],
  "hint": "разг.: доставать, добывать"
}
```

| Field       | Required | Notes                                                                                                             |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`        | yes      | Unique and stable: progress is attached to it. Use `<pos>-<word>`. Never rename an id of a word you have studied. |
| `pos`       | yes      | Part of speech: `verb`, `noun`, `adjective`, …                                                                    |
| `en`        | yes      | The English word; the infinitive for verbs.                                                                       |
| `ru`        | yes      | Translations. Any of them is accepted as an answer.                                                               |
| `v2`, `v3`  | verbs    | Past simple and past participle; variants go in the list (`["was", "were"]`).                                     |
| `irregular` | no       | Irregular verbs get a forms card. Settings can turn forms on for all verbs.                                       |
| `hint`      | no       | Shown next to the Russian prompt to tell apart words with the same translation (`do` / `make`).                   |
| `tags`      | yes      | Free-form labels; may be empty.                                                                                   |

Each word has an EN → RU card and an RU → EN card; verbs with forms also get a forms card that asks one random form each time. Words without `v2`/`v3` (nouns, adjectives) only get the two translation cards.

The cards of a word open one by one: a new word starts with EN → RU, RU → EN opens the day after EN → RU is learned, and forms open the day after RU → EN. Opened cards take the daily new-card limit before new words do. Each card keeps its own SM-2 interval, and cards of the same word never come back to back.

`pnpm test` validates every data file (JSON, required fields, unique ids), and the deploy runs the tests first, so a broken line never reaches the site.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm check      # typecheck + tests
pnpm build      # static site in dist/
```

Stack: Vue 3, TypeScript, Vite, Vitest. Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
