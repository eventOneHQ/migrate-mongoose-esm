# Troubleshooting

## Connection URI must include the database name

The `-d` / `MIGRATE_DB_CONNECTION_URI` value must end with a database name:

```sh
# Correct
mongodb://localhost:27017/mydb

# Missing database name — will fail
mongodb://localhost:27017
```

Without a database name, the migrator has nowhere to store state and the command will error.

## ESM-only package

`@eventonehq/migrate-mongoose` is an ES module. To use it, your project must either:

- Have `"type": "module"` in `package.json`, or
- Use the `.mjs` extension for migration files and any files that import from the package

Attempting to `require()` this package in a CommonJS context throws:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported
```

## Model connection timing

When importing models in a migration file, the connection must be established before any model operations run. Use top-level `await` in your models entry point:

```javascript
// models/index.js
import { connect } from 'mongoose'
import { UserModel } from './user.model.js'

await connect(process.env.MIGRATE_DB_CONNECTION_URI) // top-level await

export { UserModel }
```

If `connect()` is not awaited before a model is used, you may see a `MongoNotConnectedError` or a buffering timeout.

## Migrations stuck in `DOWN` after pulling from source control

New migration files on disk are automatically detected and imported into the database with a state of `DOWN` on the next command. If the state doesn't update, run `npx migrate list` to trigger a sync.

If entries from deleted files are cluttering the state, remove them with:

```sh
npx migrate prune
```

## Migration ran but `list` still shows `DOWN`

This happens when the migration threw an error. Check that your `up` function returns a resolved promise — any uncaught rejection aborts the migration and leaves it in `down` state. Run the command again with a terminal that shows stderr to see the full error.

## `migrate` command not found

Make sure the package is installed and use `npx`:

```sh
npx migrate list
```

Or add a script to `package.json`:

```json
{
  "scripts": {
    "migrate": "migrate"
  }
}
```
