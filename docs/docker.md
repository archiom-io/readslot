# Docker development

ReadSlot's Docker tooling pins Node.js 24 and pnpm 11.7.0 and includes Debian Chromium plus the
release archiver, so checks, browser tests, and packaging do not depend on host tooling versions.

## Prerequisite

Install Docker Desktop, or Docker Engine with the Compose plugin, and start its Docker daemon.

## First run

```sh
docker compose build
docker compose run --rm readslot pnpm --version
docker compose run --rm readslot pnpm install --frozen-lockfile
```

The version command must print `11.7.0`. Dependencies and the pnpm store live in named Docker
volumes rather than the host's `node_modules` directory.

## Project checks and builds

```sh
docker compose run --rm readslot pnpm check
docker compose run --rm readslot pnpm test:e2e
docker compose run --rm readslot pnpm package
```

Because the repository is mounted at `/workspace`, `dist/` and `release/` are written back to the
working tree. Load the unpacked extension and perform real OAuth testing in Chrome on the host.

For a development build that reads the ignored `.env.local` file already present in the mounted
repository, run:

```sh
docker compose run --rm readslot pnpm build
```

Release packaging requires the production Chrome Extension OAuth client ID described in
[`oauth.md`](oauth.md). Never add a client secret; a Chrome extension uses only its OAuth client ID.

## Cleanup

```sh
docker compose down
```

To intentionally discard the dependency cache as well:

```sh
docker compose down --volumes
```
