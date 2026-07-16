# ReadSlot

**Schedule what you save.**

Save useful content, find realistic time, and confirm reading blocks in Google Calendar.

ReadSlot is a free, local-first Manifest V3 extension. Saved links, notes, estimates, and
reading history stay in the browser. ReadSlot reads Calendar availability only after the user
connects Google, and it never creates an event without explicit confirmation.

## Development

Requirements: Node 24 and pnpm 11.

```sh
pnpm install
READSLOT_GOOGLE_OAUTH_CLIENT_ID=578077198252-8a2knumc5t19autrgprq1g2fi0sdvu11.apps.googleusercontent.com pnpm build
pnpm check
```

Load `dist/` from `chrome://extensions` with Developer mode enabled. Calendar features are
disabled until `READSLOT_GOOGLE_OAUTH_CLIENT_ID` is supplied during the build; see
[`docs/oauth.md`](docs/oauth.md). The current development OAuth client is tied to the extension ID
`lbmgjokmljcgnhalhkbdfmomifkcedmp`.

The maintained development baseline is in
[`docs/PROJECT_KNOWLEDGE.md`](docs/PROJECT_KNOWLEDGE.md), with the complete product and delivery
specification in
[`docs/ReadSlot_Complete_Blueprint.md`](docs/ReadSlot_Complete_Blueprint.md).

## Privacy and permissions

ReadSlot has no backend, advertising, analytics, or remote executable code. See
[`PRIVACY.md`](PRIVACY.md) for data handling and [`docs/permissions.md`](docs/permissions.md)
for each requested browser permission.

## Attribution

ReadSlot is based in product direction on [Reading Block](https://github.com/zarazhangrui/reading-block)
by Zara Zhang, licensed under MIT. ReadSlot replaces automatic booking with ranked suggestions
and explicit confirmation.

## License

MIT. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
