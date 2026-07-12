# ADR 0004: Local Verification Before Push

Status: Accepted, 2026-07-13.

GitHub Actions CI, CodeQL, and release workflows are disabled for the current development phase.
Before pushing, maintainers run `pnpm check` and `pnpm test:e2e` locally. Release candidates also
follow the manual checks and packaging steps in `docs/release.md`.

This keeps the repository free of failing or unnecessary automation while the product remains in
local beta development. npm Dependabot stays enabled for update visibility. CI may be restored in
a later ADR when hosted automation provides enough value to justify its maintenance and security
surface.
