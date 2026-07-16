# Google OAuth Setup

ReadSlot uses a public OAuth client of type **Chrome Extension**. It never uses a client secret.

For the current development setup, use the Chrome extension ID `lbmgjokmljcgnhalhkbdfmomifkcedmp` when creating the OAuth client.

1. Create a Google Cloud project and enable Google Calendar API.
2. Configure the OAuth consent screen and development test users.
3. Load the development build and copy its Chrome extension ID.
4. Create a Chrome Extension OAuth client associated with that ID.
5. Build with `READSLOT_GOOGLE_OAUTH_CLIENT_ID=578077198252-8a2knumc5t19autrgprq1g2fi0sdvu11.apps.googleusercontent.com`.
6. Reload `dist/` and use Settings → Connect Google.

Requested scopes:

- `calendar.calendarlist.readonly`: list calendars and their access roles.
- `calendar.events.freebusy`: read availability without event details.
- `calendar.events`: create, reconcile, update, and detect removal of confirmed ReadSlot events.

Chrome Identity manages access-token caching. ReadSlot never writes tokens to IndexedDB or
browser settings. Production requires a separate OAuth client associated with the Chrome Web
Store extension ID.
