# Programmatic Usage Example

Use `Migrator` directly when you need to run migrations from application code, scripts, or test suites — without invoking the CLI.

See the [Programmatic API](../guide/programmatic) reference for the full method list.

## Basic Setup

```javascript
import { Migrator } from '@eventonehq/migrate-mongoose'

const migrator = new Migrator({
  migrationsPath: './migrations',
  dbConnectionUri: 'mongodb://localhost:27017/myapp',
  collectionName: 'migrations', // optional, default: 'migrations'
  cli: true, // optional: enables console output
})
```

## Running Migrations

```javascript
// Run all pending migrations
await migrator.run('up')

// Run up to (and including) a specific migration
await migrator.run('up', 'add_users')

// Roll back to (and including) a specific migration
await migrator.run('down', 'add_users')
```

## Creating Migrations

```javascript
await migrator.create('add_users')
// Creates: ./migrations/1450107140857-add_users.js
```

## Listing Migration State

```javascript
const migrations = await migrator.list()
console.log(migrations)
/*
[
  { name: 'add_users',    filename: '1450107140857-add_users.js',    state: 'up'   },
  { name: 'add_products', filename: '1461351953091-add_products.js', state: 'down' },
]
*/
```

## Sync and Prune

```javascript
// Import migrations from disk that are missing in the database
await migrator.sync()

// Remove database entries for migration files that no longer exist on disk
await migrator.prune()
```

## Using an Existing Mongoose Connection

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
await migrator.close() // closes the underlying connection when done
```

Inside migrations, models on that connection are accessible via `this`:

```javascript
// migrations/1450107140857-add_users.js
export async function up() {
  // this('ModelName') is equivalent to connection.model('ModelName')
  await this('user').create({ firstName: 'Ada', lastName: 'Lovelace' })
}

export async function down() {
  await this('user').deleteOne({ firstName: 'Ada' })
}
```

## Running Migrations in Tests

A common pattern is to apply and then roll back migrations around your test suite:

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
