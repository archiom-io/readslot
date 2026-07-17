# Troubleshooting

- **Calendar is not configured:** confirm `.env.local` contains the development
  `READSLOT_GOOGLE_OAUTH_CLIENT_ID`, run `pnpm build`, and reload the extension from
  `chrome://extensions`.
- **Sign-in is denied:** confirm the OAuth client uses the current extension ID `lbmgjokmljcgnhalhkbdfmomifkcedmp` and the account is a test user.
- **Google access could not be revoked:** ReadSlot still disconnects locally. Remove ReadSlot from [Google Account connections](https://myaccount.google.com/connections), then retry connecting only when needed.
- **Calendar is read-only:** select a calendar with writer or owner access.
- **No suggestions:** add queued items, expand allowed days/hours, or increase the planning horizon.
- **A saved page has a weak estimate:** dynamic/paywalled pages may expose little readable text; set planned minutes manually.
- **Restricted page cannot be saved:** Chrome blocks scripting on `chrome://` pages and some built-in viewers; paste the URL into the queue.
