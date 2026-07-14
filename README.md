# Family Bible Study

Private React companion for the Lock To Hang family’s weekly Bible study.

## What it provides

- a weekly reading program sourced from jw.org in Malagasy;
- four family participation roles: `Mpitarika`, `Mpampifandray`, `Mpamaly sy Mpisafidy`, and `Mpandray anjara`;
- a rotating activity selector designed for Arielle and Gaëlle;
- a printable role-card preview;
- a versioned weekly-result source file at `src/data/latest-week.json`.

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

No credentials, API keys, or tokens belong in this repository.
