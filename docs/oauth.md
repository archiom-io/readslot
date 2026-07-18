# Google OAuth Setup

ReadSlot uses a public OAuth client of type **Chrome Extension**. It never uses a client secret.

For the current development setup, use the Chrome extension ID `lbmgjokmljcgnhalhkbdfmomifkcedmp` when creating the OAuth client.

1. Create a Google Cloud project and enable Google Calendar API.
2. Configure the OAuth consent screen and development test users.
3. Load the development build and copy its Chrome extension ID.
4. Create a Chrome Extension OAuth client associated with that ID.
5. Copy `.env.example` to the ignored `.env.local` file and run `pnpm build`. Normal local
   builds load the development client automatically.
6. Reload `dist/` and use Settings → Connect Google.

Requested scopes:

- `calendar.calendarlist.readonly`: list calendars and their access roles.
- `calendar.events.freebusy`: read availability without event details.
- `calendar.events`: create, reconcile, update, and detect removal of confirmed ReadSlot events.

Chrome Identity manages access-token caching. ReadSlot never writes tokens to IndexedDB or
browser settings. **Disconnect and revoke access** sends the current access token directly to
Google's OAuth revocation endpoint, then removes it from Chrome's token cache. If Google cannot be
reached, ReadSlot still disconnects locally and directs the user to Google Account connections to
finish revocation. Production requires a separate OAuth client associated with the Chrome Web Store
extension ID. Release builds do not load the development `.env.local` automatically; provide the
production Store client ID explicitly.

The public homepage, privacy policy, terms, and support pages are live at
[archiom.io/apps/readslot](https://archiom.io/apps/readslot) — privacy, terms, and support at
`/privacy`, `/terms`, and `/support`. The source templates, paste-ready scope justifications,
verification video script, and production submission walkthrough are maintained in the
[OAuth verification website folder](../oauth-verification-site/README.md); update both together
whenever Calendar behavior, scopes, or data handling changes.

The public repository and issue tracker live in the Archiom organization:
[`archiom-io/readslot`](https://github.com/archiom-io/readslot).
