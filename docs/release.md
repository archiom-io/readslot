# Release

1. Set the intended Semantic Version in `package.json` and update `CHANGELOG.md`.
2. Provide the production Chrome Extension OAuth client ID in the environment, and create it against the Chrome Web Store extension ID for the release build.
3. Run `pnpm check`, `pnpm test:e2e`, and `pnpm package`. The same gates can be run with the
   pinned Node 24 and pnpm 11.7.0 Docker workflow documented in [`docker.md`](docker.md).
4. Inspect `release/readslot-VERSION.zip`; the manifest must be at its root.
5. Verify the adjacent SHA-256 file and ensure no source maps, `.env`, tests, or credentials exist.
6. Load the unpacked release, complete the OAuth/manual browser checklist, and capture final screenshots.
7. Upload manually to the Chrome Web Store and submit only after reviewing every disclosure.
