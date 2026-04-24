<div align="center">

# @eventonehq/migrate-mongoose

**A migration framework for Mongoose**

[![npm version](https://img.shields.io/npm/v/@eventonehq/migrate-mongoose?style=flat-square&color=crimson)](https://www.npmjs.com/package/@eventonehq/migrate-mongoose)
[![npm downloads](https://img.shields.io/npm/dm/@eventonehq/migrate-mongoose?style=flat-square)](https://www.npmjs.com/package/@eventonehq/migrate-mongoose)
[![Node.js](https://img.shields.io/node/v/@eventonehq/migrate-mongoose?style=flat-square)](https://nodejs.org)
[![Mongoose](https://img.shields.io/badge/mongoose-v7%20%7C%20v8%20%7C%20v9-880000?style=flat-square)](https://mongoosejs.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

</div>

---

> Seamlessly manage database migrations in projects already using Mongoose. Migration state is stored directly in MongoDB — no fragile local state files, no lock-in.

---

## Why migrate-mongoose?

Most migration frameworks fall short in one or more ways:

| Problem | migrate-mongoose |
|---|---|
| Local state files break on ephemeral filesystems (e.g. Heroku, containers) | Stores state in **MongoDB** |
| No access to your app's models inside migrations | Full access to **Mongoose models** |
| Inflexible configuration | Config via **CLI flags, env vars, or config file** |
| Document-level migration requires app code changes | Simple **global migration state** — run once, done |

**Key features:**

- Stores migration state in MongoDB — works anywhere your DB does
- Full access to Mongoose models inside migration files
- Promise-based migrations (async/await)
- Flexible config: CLI flags, `.env`, or `migrate.json`
- Prune stale migrations that no longer exist on the filesystem
- Programmatic API for use in your own scripts or test suites

---

## Table of Contents

- [Installation](#installation)
- [CLI Usage](#cli-usage)
  - [Commands](#commands)
  - [Options](#options)
  - [Examples](#examples)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Config File](#config-file)
  - [Override Order](#override-order)
- [Migration Files](#migration-files)
- [Using Mongoose Models in Migrations](#using-mongoose-models-in-migrations)
- [Programmatic Usage](#programmatic-usage)
- [Notes](#notes)
- [Peer Dependencies](#peer-dependencies)
- [Contributing](#contributing)

---

## Installation

Install locally in your project alongside Mongoose:

```sh
npm install @eventonehq/migrate-mongoose mongoose
```

Then run commands with npx:

```sh
npx migrate [command] [options]
```

---

## CLI Usage

```sh
npx migrate -d <mongo-uri> [command] [migration-name] [options]
```

### Commands

| Command | Description |
|---|---|
| `list` | Lists all migrations and their current state |
| `create <name>` | Creates a new migration file |
| `up [name]` | Runs all pending migrations. If `[name]` is given, runs up to that migration only |
| `down <name>` | Rolls back all migrations down to the specified migration |
| `prune` | Removes DB entries for migrations that no longer exist on the filesystem |

### Options

| Flag | Description | Default |
|---|---|---|
| `-d, --dbConnectionUri` | MongoDB connection URI | *(required)* |
| `--collection` | Collection name for storing migration state | `"migrations"` |
| `--md, --migrations-dir` | Path to migration files | `"./migrations"` |
| `-t, --template-file` | Custom template file for new migrations | — |
| `-c, --change-dir` | Change working directory before running | — |
| `--autosync` | Auto-add filesystem migrations to DB without prompting | `false` |
| `--config` | Path to a JSON config file | `"migrate.json"` |
| `-h, --help` | Show help | — |

### Examples

```sh
npx migrate list -d mongodb://localhost/mydb
npx migrate create add_users -d mongodb://localhost/mydb
npx migrate up add_users -d mongodb://localhost/mydb
npx migrate down add_users -d mongodb://localhost/mydb
npx migrate prune -d mongodb://localhost/mydb
npx migrate list --config migrate.json
```

---

## Configuration

Avoid repeating `--dbConnectionUri` (and other flags) on every command using one of the approaches below.

### Environment Variables

Prefix any option name with `MIGRATE_`:

```sh
export MIGRATE_dbConnectionUri=mongodb://localhost:27017/mydb
```

`.env` files are supported — all variables are loaded automatically:

```sh
# .env
MIGRATE_dbConnectionUri=mongodb://localhost:27017/mydb
```

### Config File

By default, migrate-mongoose looks for a `migrate.json` in the current directory:

```json
{
  "dbConnectionUri": "mongodb://localhost:27017/mydb",
  "migrationsDir": "./migrations"
}
```

To use a custom path:

```sh
npx migrate list --config somePath/myCustomConfigFile.json
```

### Override Order

```
CLI flags  >  Environment variables  >  Config file
```

---

## Migration Files

Create a new migration file with:

```sh
npx migrate create some-migration-name
```

Each file exports `up` and optionally `down` functions:

**`migrations/1562460744403-some-migration-name.js`**

```javascript
export async function up() {
  // Throw an error to signal failure and halt the migration
  if (condition) {
    throw new Error('Migration failed: could not complete')
  }

  await someAsyncOperation()
}

export async function down() {
  // Optional: implement rollback logic here
}
```

---

## Using Mongoose Models in Migrations

Import your models directly — migrate-mongoose opens its own independent MongoDB connection for tracking state and makes no assumptions about your app's connection setup.

**`models/user.model.js`**

```javascript
import { Schema, model } from 'mongoose'

const UserSchema = new Schema({
  firstName: String,
  lastName: String,
})

export const UserModel = model('user', UserSchema)
```

**`models/index.js`**

```javascript
import { connect } from 'mongoose'
import { UserModel } from './user.model.js'

connect('mongodb://localhost:27017/mydb')

export { UserModel }
```

**`migrations/1459287720919-my-migration.js`**

```javascript
import { UserModel } from '../models/index.js'

export async function up() {
  await UserModel.create({ firstName: 'Ada', lastName: 'Lovelace' })

  const users = await UserModel.find()
  // do something with users...
}
```

When using the **programmatic API**, access models via the connection passed to `Migrator` using `this`:

```javascript
export async function up() {
  // Equivalent to: connection.model('user')
  await this('user').create({ firstName: 'Ada', lastName: 'Lovelace' })
}
```

---

## Programmatic Usage

```javascript
import { Migrator } from '@eventonehq/migrate-mongoose'

const migrator = new Migrator({
  migrationsPath: './migrations',               // default: './migrations'
  templatePath: './template.js',                // optional
  dbConnectionUri: 'mongodb://localhost:27017/mydb', // required if no connection
  connection: mongooseConnection,               // required if no dbConnectionUri
  collectionName: 'migrations',                 // default: 'migrations'
  autosync: false,                              // default: false
  cli: false,                                   // set to true to enable console output (default: false)
})

await migrator.create('my-migration-name')        // Create a new migration file
await migrator.run('up')                          // Run all pending migrations
await migrator.run('up', 'my-migration-name')     // Run up to a specific migration
await migrator.run('down', 'my-migration-name')   // Roll back to a specific migration

const migrations = await migrator.list()          // [{ name, filename, state }, ...]
await migrator.sync()                             // Sync filesystem migrations into DB
await migrator.prune()                            // Remove DB entries with no matching file

migrator.setMongooseConnection(anotherConnection) // Swap the Mongoose connection
await migrator.close()                            // Close the underlying DB connection
```

---

## Notes

The `--dbConnectionUri` / `-d` value **must include the database name**:

```sh
npx migrate list -d mongodb://localhost:27017/mydb
#                                              ^^^^
```

---

## Peer Dependencies

`mongoose` must be installed separately. Supported versions: **v7, v8, v9** (`>= 7 < 10`).

```sh
npm install mongoose
```

---

## Examples

See the [`examples/`](./examples) directory for runnable examples covering:

- [`command-line/`](./examples/command-line) — CLI usage walkthrough
- [`config-file-usage/`](./examples/config-file-usage) — Using a `migrate.json` config file
- [`programmatic-usage/`](./examples/programmatic-usage) — Using the JavaScript API directly

---

## Contributing

1. Open an issue to discuss the proposed change
2. Submit a pull request — it will be reviewed and iterated on together
3. Once approved, it will be merged and the package version bumped
