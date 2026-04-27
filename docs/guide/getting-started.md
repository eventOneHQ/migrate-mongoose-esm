# Getting Started

## Prerequisites

- Node.js `>=20.19.0`
- A running MongoDB instance
- Mongoose (v7, v8, or v9) installed in your project

## Installation

`mongoose` is a peer dependency and must be installed alongside this package:

```sh
npm install @eventonehq/migrate-mongoose mongoose
```

## Quick Start

**1. Create your first migration:**

```sh
npx migrate create add_users -d mongodb://localhost:27017/mydb
```

**2. Edit the generated file in `./migrations/`:**

```javascript
// migrations/1234567890000-add_users.js
export async function up() {
  await someAsyncOperation()
}

export async function down() {
  // Optional rollback logic
}
```

**3. Run pending migrations:**

```sh
npx migrate up -d mongodb://localhost:27017/mydb
```

**4. Check migration status:**

```sh
npx migrate list -d mongodb://localhost:27017/mydb
```

::: tip
The connection URI must include the database name (e.g. `/mydb`). See [Configuration](./configuration) to avoid repeating it on every command.
:::

## Using Mongoose Models in Migrations

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
}
```

When using the [programmatic API](./programmatic), access models via `this` (the Mongoose connection passed to `Migrator`):

```javascript
export async function up() {
  // Equivalent to: connection.model('user')
  await this('user').create({ firstName: 'Ada', lastName: 'Lovelace' })
}
```
