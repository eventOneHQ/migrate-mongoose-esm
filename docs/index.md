---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'migrate-mongoose'
  text: 'A migration framework for Mongoose'
  tagline: Database migrations that live in MongoDB — no local state files, no fragile lock mechanisms.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: CLI Reference
      link: /guide/cli
    - theme: alt
      text: View on GitHub
      link: https://github.com/eventOneHQ/migrate-mongoose-esm

features:
  - title: MongoDB-backed state
    details: Migration status stored in a MongoDB collection — no local lock files. Works in ephemeral and containerized environments.
  - title: Model access in migrations
    details: Import and use your Mongoose models directly inside migration files.
  - title: Flexible configuration
    details: Configure via CLI flags, environment variables, .env files, or a JSON config file.
  - title: Async/await support
    details: Migrations are fully Promise-based with async/await.
  - title: Programmatic API
    details: Use Migrator directly in scripts, CI pipelines, or test suites.
  - title: Prune stale migrations
    details: Remove DB entries for migration files that no longer exist on disk.
---
