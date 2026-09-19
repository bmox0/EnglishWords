# English Verbs

A static Vue site for learning English verbs, live at https://bmox0.github.io/EnglishWords/. What it does and how to use it: `README.md`.

## Commands

```bash
pnpm dev             # dev server
pnpm check           # vue-tsc + all tests; run before every commit
pnpm words:check     # validate data/*.jsonl only
pnpm words:import    # spreadsheet → JSONL lines (see the add-words skill)
pnpm build           # static site in dist/
```

## Layout

- `src/domain/`: pure TypeScript, no Vue. Notes and validation, cards and unlocking, the SM-2 scheduler, the queue, answer checking, answer options, the placement test and storage. Tests sit next to the code as `*.test.ts`.
- `src/store/study.ts`: the reactive study state built on the domain. It picks the current card and persists after every action.
- `src/components/`: `StudyPane` (left dictation), `VerbTable` (right table or phone sheet), `SettingsDialog`, `PlacementTest`, and small pieces.
- `src/composables/`: `useTheme` (light/dark) and `useMediaQuery`.
- `src/styles.css`: every style. Colour tokens live on `:root` and `:root.dark`.
- `data/<NN>-<set>.jsonl`: the words, loaded in number order. Adding words goes through the `add-words` skill in `.claude/skills/`.
- `scripts/xlsx-to-jsonl.mjs`: the spreadsheet importer, with no dependencies.

## Invariants

- Progress is keyed by card id `<note id>:<kind>`. Never rename or reuse a note id, or learners lose progress.
- localStorage keys: `english-words:v1` holds progress and settings, `english-words:dark` holds the theme. The origin `bmox0.github.io` is shared with other sites, so every key keeps the `english-words:` prefix. A change to the saved shape needs a new version and a migration in `src/domain/storage.ts`.
- The UI is in English; only translations and hints are Russian.
- Scheduling follows Anki's SM-2 defaults (`SCHEDULER` in `src/domain/scheduler.ts`). Any change there needs a test in `scheduler.test.ts` or `queue.test.ts`.

## Style

- Prettier: no semicolons, double quotes, width 150, no bracket spacing (`pnpm format`).
- The font is Iosevka Charon at weights 300 (body), 400 and 500. Do not add heavier weights.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`: typecheck, tests, build, then GitHub Pages.

The repo belongs to the `bmox0` account. The local git config rewrites `git@github.com:` to the `github.com-bmox0` SSH host, so a plain `git push` works. The active `gh` account is a different one, so run `gh` as bmox0 without switching: `GH_TOKEN=$(gh auth token --user bmox0) gh run list -R bmox0/EnglishWords`.
