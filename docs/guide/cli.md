# CLI Reference

```sh
npx migrate -d <mongo-uri> [command] [migration-name] [options]
```

## Commands

| Command         | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `list`          | Lists all migrations and their current state                                      |
| `create <name>` | Creates a new migration file                                                      |
| `up [name]`     | Runs all pending migrations. If `[name]` is given, runs up to that migration only |
| `down <name>`   | Rolls back all migrations down to the specified migration                         |
| `prune`         | Removes DB entries for migrations no longer on disk. Run this after deleting migration files — otherwise deleted files leave orphaned entries in the database that never resolve. |

## Options

All options can also be set via environment variables or a config file — see the [Configuration reference](./configuration#options-reference) for the full mapping.

| Flag                     | Description                                 | Default          |
| ------------------------ | ------------------------------------------- | ---------------- |
| `-d, --db-connection-uri`  | MongoDB connection URI                      | _(required)_     |
| `--collection`           | Collection name for storing migration state | `"migrations"`   |
| `--md, --migrations-dir` | Path to migration files                     | `"./migrations"` |
| `-t, --template-file`    | Custom template file for new migrations     | —                |
| `-c, --change-dir`       | Change working directory before running     | —                |
| `--config`               | Path to a JSON config file                  | `"migrate.json"` |
| `-h, --help`             | Show help                                   | —                |

## Walkthrough

The examples below assume a `migrate.json` config file is present so `--db-connection-uri` is not needed on every command. See [Configuration](./configuration) for setup.

### Create a Migration

```sh
npx migrate create add_users
```

This generates a timestamped file in your migrations directory:

```
migrations/
  1450107140857-add_users.js
```

Edit the file to define `up` and `down` logic:

```javascript
// migrations/1450107140857-add_users.js
import { UserModel } from '../models/index.js'

export async function up() {
  await UserModel.create([
    { firstName: 'Ada', lastName: 'Lovelace' },
    { firstName: 'Grace', lastName: 'Hopper' },
  ])
}

export async function down() {
  await UserModel.deleteMany({ firstName: { $in: ['Ada', 'Grace'] } })
}
```

See [Migration Files](./migration-files) for details on the file format and importing models.

### Check Status

```sh
npx migrate list
```

```
DOWN: 1450107140857-add_users.js
```

`DOWN` means the migration has not been applied yet.

### Run Pending Migrations

```sh
npx migrate up
```

To run only up to a specific migration (inclusive):

```sh
npx migrate up add_users
```

Running `list` afterwards shows the updated state:

```
UP: 1450107140857-add_users.js
```

### Roll Back a Migration

```sh
npx migrate down add_users
```

::: tip
`down <name>` rolls back **all** migrations that ran after `<name>`, and then rolls back `<name>` itself. It does not roll back only that single migration in isolation.
:::

### Sync and Prune

When you pull new migration files from source control, `migrate-mongoose` detects them automatically on the next command and imports them into the database with a state of `DOWN`.

To remove database entries for migration files that have been deleted from disk:

```sh
npx migrate prune
```
