# Getting Started

## Prerequisites

- Node.js `>=20.19.0`
- A running MongoDB instance
- Mongoose (v7, v8, or v9) installed in your project

::: warning ESM only
`@eventonehq/migrate-mongoose` is an ES module. Your project must have `"type": "module"` in `package.json`, or migration files must use the `.mjs` extension. It cannot be `require()`'d in a CommonJS context.
:::

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

For details on the migration file format, model imports, and naming conventions, see [Migration Files](./migration-files).
