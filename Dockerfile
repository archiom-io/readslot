FROM node:24-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:${PATH}

RUN apt-get update \
  && apt-get install --yes --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update \
  && apt-get install --yes --no-install-recommends zip \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && corepack prepare pnpm@11.7.0 --activate \
  && node --version \
  && pnpm --version

WORKDIR /workspace

CMD ["pnpm", "--version"]
