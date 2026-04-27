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
  cli: false, // set true to enable console output
})
```

## Methods

```javascript
await migrator.create('my-migration-name') // Create a new migration file
await migrator.run('up') // Run all pending migrations
await migrator.run('up', 'my-migration-name') // Run up to a specific migration
await migrator.run('down', 'my-migration-name') // Roll back to a specific migration

const migrations = await migrator.list() // [{ name, filename, state }, ...]
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

See [Getting Started — Using Mongoose Models](./getting-started#using-mongoose-models-in-migrations) for the import-based approach.
