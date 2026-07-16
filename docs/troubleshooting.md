# Troubleshooting

- **Calendar is not configured:** rebuild with `READSLOT_GOOGLE_OAUTH_CLIENT_ID=578077198252-8a2knumc5t19autrgprq1g2fi0sdvu11.apps.googleusercontent.com`.
- **Sign-in is denied:** confirm the OAuth client uses the current extension ID `lbmgjokmljcgnhalhkbdfmomifkcedmp` and the account is a test user.
- **Calendar reconnects after Disconnect:** update to the latest build. ReadSlot now remembers an explicit disconnect locally and only reconnects after you click **Connect Google**. The success message confirms that local queue items were intentionally retained.
- **Calendar is read-only:** select a calendar with writer or owner access.
- **No suggestions:** add queued items, expand allowed days/hours, or increase the planning horizon.
- **A saved page has a weak estimate:** dynamic/paywalled pages may expose little readable text; set planned minutes manually.
- **Restricted page cannot be saved:** Chrome blocks scripting on `chrome://` pages and some built-in viewers; paste the URL into the queue.
