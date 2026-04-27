# Migration Files

Each migration is a JavaScript module that exports `up` and `down` functions.

## File Format

```javascript
// migrations/1234567890000-migration-name.js
export async function up() {
  // Forward migration logic
}

export async function down() {
  // Rollback logic (optional but recommended)
}
```

Both functions must be `async` (or return a `Promise`). Throwing an error or returning a rejected promise aborts the migration and leaves it in a `down` state.

## Naming Convention

Migration files are named with a Unix timestamp prefix followed by a hyphen-separated name:

```
1450107140857-add_users.js
```

The timestamp determines execution order — migrations always run in ascending timestamp order. `migrate create <name>` generates the correct filename automatically; avoid renaming files after they have been applied.

## Importing Mongoose Models

`@eventonehq/migrate-mongoose` opens its own independent MongoDB connection for state tracking, so it makes no assumptions about your application's connection setup. Import your models directly:

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

Connect to MongoDB and re-export your models so migrations can import them:

```javascript
import { connect } from 'mongoose'
import { UserModel } from './user.model.js'

await connect('mongodb://localhost:27017/mydb')

export { UserModel }
```

**`migrations/1459287720919-my-migration.js`**

```javascript
import { UserModel } from '../models/index.js'

export async function up() {
  await UserModel.create({ firstName: 'Ada', lastName: 'Lovelace' })
}

export async function down() {
  await UserModel.deleteOne({ firstName: 'Ada' })
}
```

::: tip
Use the same URI in `models/index.js` that you configure for the migrator, or read it from the same environment variable (`MIGRATE_DB_CONNECTION_URI`) so they stay in sync.
:::

## `this` Binding (Programmatic API)

When using the [programmatic API](./programmatic), `this` inside a migration function is a model accessor bound to the Mongoose connection passed to `Migrator`:

```javascript
// migrations/1459287720919-my-migration.js
export async function up() {
  // Equivalent to: connection.model('user')
  await this('user').create({ firstName: 'Ada', lastName: 'Lovelace' })
}
```

This is only available when running via the programmatic API with a `connection` option. When running via the CLI, import models directly as shown above.

## TypeScript Migration Files

Pass `--typescript` (or set `typescript: true` in `migrate.json`) to generate `.ts` migration files instead of `.js`:

```sh
npx migrate create add_users --typescript
```

The generated file uses TypeScript types:

```typescript
import type { Connection } from 'mongoose'

export async function up(this: Connection): Promise<void> {
  // Write migration here
}

export async function down(this: Connection): Promise<void> {
  // Write migration here
}
```

::: tip Running TypeScript migrations
`@eventonehq/migrate-mongoose` does not transpile TypeScript itself. Run `migrate` under a TypeScript-capable runtime such as [`tsx`](https://github.com/privatenumber/tsx):

```json
// package.json
{
  "scripts": {
    "migrate": "tsx node_modules/.bin/migrate"
  }
}
```
:::

## Custom Templates

To use a custom template for generated migration files, set `templateFile` in your config or pass `-t` on the CLI:

```json
{
  "templateFile": "./migration-template.js"
}
```

The template is copied verbatim (with the timestamp prefix added to the filename) when `migrate create` is run. It must export `up` and `down` functions.
