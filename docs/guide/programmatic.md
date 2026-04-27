# Programmatic API

Use `Migrator` directly in scripts, CI pipelines, or test suites.

## Setup

```javascript
import { Migrator } from '@eventonehq/migrate-mongoose'

const migrator = new Migrator({
  migrationsPath: './migrations', // default: './migrations'
  templatePath: './template.js', // optional
  dbConnectionUri: 'mongodb://localhost:27017/mydb', // required if no connection
  connection: mongooseConnection, // required if no dbConnectionUri
  collectionName: 'migrations', // default: 'migrations'
  typescript: false, // set true to generate .ts migration files
  cli: false, // set true to enable console output
})
```

## Methods

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `create(name)` | `Promise<string>` | Creates a migration file; returns the file path |
| `run(direction, [name])` | `Promise<void>` | Runs migrations up or down; throws on failure |
| `list()` | `Promise<Migration[]>` | Returns all migrations with their state |
| `sync()` | `Promise<void>` | Imports disk migrations missing from the database |
| `prune()` | `Promise<void>` | Removes DB entries with no matching file on disk |
| `setMongooseConnection(conn)` | `void` | Swaps the active Mongoose connection |
| `close()` | `Promise<void>` | Closes the underlying DB connection |

```javascript
await migrator.create('my-migration-name') // Create a new migration file
await migrator.run('up') // Run all pending migrations
await migrator.run('up', 'my-migration-name') // Run up to a specific migration
await migrator.run('down', 'my-migration-name') // Roll back to a specific migration

const migrations = await migrator.list()
// [
//   { name: 'add_users',    filename: '1450107140857-add_users.js',    state: 'up'   },
//   { name: 'add_products', filename: '1461351953091-add_products.js', state: 'down' },
// ]

await migrator.sync() // Sync filesystem migrations into DB
await migrator.prune() // Remove DB entries with no matching file

migrator.setMongooseConnection(anotherConnection) // Swap the Mongoose connection
await migrator.close() // Close the underlying DB connection
```

## Accessing Models

When migrations are run via the programmatic API, `this` inside a migration function refers to a model accessor bound to the Mongoose connection passed to `Migrator`:

```javascript
// migrations/1459287720919-my-migration.js
export async function up() {
  // Equivalent to: connection.model('user')
  await this('user').create({ firstName: 'Ada', lastName: 'Lovelace' })
}
```

See [Migration Files — `this` Binding](./migration-files#this-binding-programmatic-api) for details, and [Migration Files — Importing Models](./migration-files#importing-mongoose-models) for the import-based approach.

## Using an Existing Connection

If your application already has a Mongoose connection open, pass it instead of a URI to avoid opening a second connection:

```javascript
import mongoose from 'mongoose'
import { Migrator } from '@eventonehq/migrate-mongoose'

await mongoose.connect('mongodb://localhost:27017/myapp')

const migrator = new Migrator({
  migrationsPath: './migrations',
  connection: mongoose.connection,
})

await migrator.run('up')
await migrator.close()
```

## Running Migrations in Tests

A common pattern is to apply migrations before tests and roll them back afterwards:

```javascript
import { Migrator } from '@eventonehq/migrate-mongoose'
import { afterAll, beforeAll } from 'vitest'

let migrator

beforeAll(async () => {
  migrator = new Migrator({
    migrationsPath: './migrations',
    dbConnectionUri: process.env.TEST_DB_URI,
  })
  await migrator.run('up')
})

afterAll(async () => {
  await migrator.run('down', 'first_migration')
  await migrator.close()
})
```
