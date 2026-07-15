# Family Bible Study

Private React companion for the Lock To Hang family’s weekly Bible study.

Live site: `https://angelolockdev.github.io/family-bible-study/`

## What it provides

- a weekly reading program sourced from jw.org in Malagasy;
- four family participation roles: `Mpitarika`, `Mpampifandray`, `Mpamaly sy Mpisafidy`, and `Mpandray anjara`;
- a rotating activity selector designed for Arielle and Gaëlle;
- a printable role-card preview;
- a versioned weekly-result source file at `src/data/latest-week.json`.
- a dedicated Malagasy JW preaching-preparation study with an opening, question, scripture, response guidance, next step, and practice exercise at `src/data/preaching-study.json`.
- automatic GitHub Pages deployment after each validated content update.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm test
npm run build
```

## Weekly cron contract

The Sunday Bible cron updates `src/data/latest-week.json` with the next week’s jw.org-based program, validates it as JSON, commits it, pushes it to `main`, then publishes the same summary to Slack.

The Friday preaching cron follows the same single-source pattern for `src/data/preaching-study.json`: it researches jw.org, validates the app, commits the structured result, and publishes the matching briefing to Slack. GitHub Pages redeploys automatically after the push.

No credentials, API keys, or tokens belong in this repository.
