# ReadSlot Development Guide

Read `docs/PROJECT_KNOWLEDGE.md` and the relevant section of
`docs/ReadSlot_Complete_Blueprint.md` before changing the project.

## Current state

The repository contains the version 0.9.0 beta implementation. Real Google Calendar verification
and the production release ZIP remain blocked on environment-specific Chrome Extension OAuth
client IDs. Do not add placeholder credentials to tracked files or weaken release validation.

## Naming

- Product and extension name: **ReadSlot**
- Repository/package slug: `readslot`
- Tagline: **Schedule what you save.**
- Use **Reading Block** only for upstream MIT attribution.
- Default Calendar title pattern: `ReadSlot — N items`

## Guardrails

- Calendar suggestions may be automatic; event creation requires explicit user confirmation.
- Keep saved content local unless the user explicitly exports it or confirms a Calendar event containing it.
- Do not add a backend, paid API, AI dependency, telemetry, remote executable code, browser permission, host permission, or OAuth scope without explicit approval and documentation.
- Treat Calendar creation as idempotent and recheck availability within 30 seconds before creation.
- Keep domain logic independent of Chrome and Google APIs through typed adapters.
- Use strict TypeScript, validate untrusted inputs, sanitize captured page data, and test timezone/DST behavior.
- Never expose tokens, private Calendar data, signing material, saved private URLs, or release credentials in code, tests, logs, screenshots, or prompts.

## Working practice

- Make small, issue-scoped, reviewable changes.
- Preserve upstream MIT license and notices if code is imported.
- Add or update tests with behavior changes.
- Record material architectural decisions under `docs/adr/` once that directory exists.
- Update `docs/PROJECT_KNOWLEDGE.md` when a settled decision changes the project baseline.
- Update the blueprint when product requirements or acceptance criteria change.
