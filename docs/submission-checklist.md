# Store Submission Checklist

- [ ] Manifest/package version is greater than the version currently published in the Store.
- [ ] Production OAuth client matches the reserved Store extension ID.
- [ ] OAuth consent screen, support email, authorized domains, and test instructions are final.
- [ ] `pnpm check`, E2E, manual OAuth, accessibility, and security checks pass.
- [ ] Release ZIP and checksum were produced by `pnpm package`.
- [ ] ZIP contains no `.env`, source maps, tests, Git data, credentials, or development permissions.
- [ ] Icon, screenshots, description, privacy policy, support URL, and single-purpose statement match behavior.
- [ ] Reviewer can capture, connect, generate, edit, explicitly confirm, review, disconnect, export, and delete.
- [ ] Maintainer manually approves upload and publication.
- [ ] Exact submitted ZIP and SHA-256 checksum are archived outside the ignored local `release/` directory.
