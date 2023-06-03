### Example of using the library programmatically

```javascript
import { Migrator } from '@eventonehq/migrate-mongoose'

const migrator = new Migrator({
  migrationsPath: '/path/to/migrations/', // Path to migrations directory
  templatePath: '', // The template to use when creating migrations needs up and down functions exposed
  dbConnectionUri: 'mongodb://localhost/db', // mongo url
  collectionName: 'myMigrations', // collection name to use for migrations (defaults to 'migrations')
  autosync: true // if making a CLI app, set this to false to prompt the user, otherwise true
})

const migrationName = 'myNewMigration'

// Create a new migration
await migrator.create(migrationName)

// Migrate Up
await migrator.run('up', migrationName)

// Migrate Down
await migrator.run('down', migrationName)

// List Migrations
/*
Example return val

Promise which resolves with
[
 { name: 'my-migration', filename: '149213223424_my-migration.js', state: 'up' },
 { name: 'add-cows', filename: '149213223453_add-cows.js', state: 'down' }
]

*/
const migrations = await migrator.list()

// Prune extraneous migrations from file system
await migrator.prune()

// Synchronize DB with latest migrations from file system
/*
Looks at the file system migrations and imports any migrations that are
on the file system but missing in the database into the database

This functionality is opposite of prune()
*/
await migrator.sync()
```
