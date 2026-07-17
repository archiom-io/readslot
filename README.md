# ReadSlot

**Schedule what you save.**

Save useful content, find realistic time, and confirm reading blocks in Google Calendar.

ReadSlot is a free, privacy-focused Manifest V3 extension. Saved links, notes, estimates, and
reading history stay in the browser. ReadSlot reads Calendar availability only after the user
connects Google, and it never creates an event without explicit confirmation.

## Development

Requirements: Node 24 and pnpm 11.

```sh
pnpm install
cp .env.example .env.local
pnpm build
pnpm check
```

To use the pinned toolchain without changing host Node or pnpm versions, follow the
[`Docker development guide`](docs/docker.md).

Load `dist/` from `chrome://extensions` with Developer mode enabled. Calendar features are
configured from the ignored `.env.local` file during normal development builds; see
[`docs/oauth.md`](docs/oauth.md). Release builds still require the production client ID to be
supplied explicitly. The current development OAuth client is tied to the extension ID
`lbmgjokmljcgnhalhkbdfmomifkcedmp`.

The maintained development baseline is in
[`docs/PROJECT_KNOWLEDGE.md`](docs/PROJECT_KNOWLEDGE.md), with the complete product and delivery
specification in
[`docs/ReadSlot_Complete_Blueprint.md`](docs/ReadSlot_Complete_Blueprint.md).

Clicking the toolbar icon opens a page preview without saving it. Choose **Save for later** to add
it to the local queue, or **Save & choose time** to continue with item-specific Calendar
suggestions. Context-menu and keyboard captures remain immediate.

## Privacy and permissions

ReadSlot has no backend, advertising, analytics, or remote executable code. See
[`PRIVACY.md`](PRIVACY.md) for data handling and [`docs/permissions.md`](docs/permissions.md)
for each requested browser permission.

The host-ready OAuth verification website and complete submission tutorial are in the
[OAuth verification website folder](oauth-verification-site/README.md).

## Attribution

ReadSlot is based in product direction on [Reading Block](https://github.com/zarazhangrui/reading-block)
by Zara Zhang, licensed under MIT. ReadSlot replaces automatic booking with ranked suggestions
and explicit confirmation.

## License

MIT. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
