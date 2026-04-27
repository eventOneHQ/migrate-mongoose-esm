# CLI Usage Example

This walkthrough shows a typical migration workflow using the CLI. See the [CLI Reference](../guide/cli) for the full list of commands and options.

## Setup

Install the package and start with a `migrate.json` config file so you don't have to pass `--dbConnectionUri` every time:

```json
// migrate.json
{
  "dbConnectionUri": "mongodb://localhost:27017/myapp",
  "migrationsDir": "./migrations"
}
```

## Create a Migration

```sh
npx migrate create add_users
```

This generates a timestamped file in your migrations directory:

```
migrations/
  1450107140857-add_users.js
```

Edit the file to define your `up` and `down` logic:

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

## List Migration Status

Before running anything, check the current state:

```sh
npx migrate list
```

```
DOWN: 1450107140857-add_users.js
```

`DOWN` means the migration has not been applied yet.

## Run Pending Migrations

Apply all pending migrations:

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

## Roll Back a Migration

To undo migrations down to (and including) a specific one:

```sh
npx migrate down add_users
```

::: tip
`down <name>` rolls back **all** migrations that ran after `<name>`, and then rolls back `<name>` itself. It does not roll back only that single migration in isolation.
:::

## Sync and Prune

When you pull new migration files from source control, `migrate-mongoose` detects them automatically on the next command and imports them into the database with a state of `DOWN`.

To remove database entries for migration files that have been deleted from disk:

```sh
npx migrate prune
```
