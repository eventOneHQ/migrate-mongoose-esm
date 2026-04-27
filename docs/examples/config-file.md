# Config File Example

By default, `@eventonehq/migrate-mongoose` looks for `migrate.json` in the current directory. This lets you skip passing `--dbConnectionUri` and other flags on every command.

## Config File

```json
// migrate.json
{
  "dbConnectionUri": "mongodb://localhost:27017/myapp",
  "migrationsDir": "db/migrations"
}
```

::: warning
Never commit a `migrate.json` that contains a real connection URI. Add it to `.gitignore`.
:::

With this file in place, commands simplify from:

```sh
npx migrate --migrationsDir db/migrations -d mongodb://localhost:27017/myapp create my_migration
```

…to just:

```sh
npx migrate create my_migration
```

## Custom Config Path

If you need different configs for different environments, pass `--config` explicitly:

```sh
npx migrate up --config config/migrate.staging.json
```

## Project Structure

A project using a custom migrations directory might look like:

```
db/
  migrations/
    1450107140857-add_users.js
  models/
    index.js
    user.model.js
migrate.json
```

**`db/models/user.model.js`**

```javascript
import { Schema, model } from 'mongoose'

const UserSchema = new Schema({
  firstName: String,
  lastName: String,
})

export const UserModel = model('user', UserSchema)
```

**`db/models/index.js`**

Connect to MongoDB and re-export your models so migrations can import them:

```javascript
import { connect } from 'mongoose'
import { UserModel } from './user.model.js'

await connect('mongodb://localhost:27017/myapp')

export { UserModel }
```

**`db/migrations/1450107140857-add_users.js`**

```javascript
import { UserModel } from '../models/index.js'

export async function up() {
  await UserModel.create({ firstName: 'Ada', lastName: 'Lovelace' })
}

export async function down() {
  await UserModel.deleteOne({ firstName: 'Ada' })
}
```

## Override Order

When the same option is set in multiple places, the following precedence applies:

```
CLI flags  >  Environment variables  >  Config file
```

For example, you can keep a shared `migrate.json` for your team while overriding the URI locally via an environment variable:

```sh
# .env
MIGRATE_dbConnectionUri=mongodb://localhost:27017/myapp-local
```

See [Configuration](../guide/configuration) for the full list of options.
