# Configuration

Avoid repeating `--db-connection-uri` and other flags on every command by using one of these approaches.

## Options Reference

| Option | CLI flag | Environment variable | Config file key | Default |
| ------ | -------- | -------------------- | --------------- | ------- |
| MongoDB connection URI | `-d, --db-connection-uri` | `MIGRATE_DB_CONNECTION_URI` | `dbConnectionUri` | _(required)_ |
| Migrations directory | `--md, --migrations-dir` | `MIGRATE_MIGRATIONS_DIR` | `migrationsDir` | `./migrations` |
| State collection name | `--collection` | `MIGRATE_COLLECTION` | `collection` | `migrations` |
| Migration template file | `-t, --template-file` | `MIGRATE_TEMPLATE_FILE` | `templateFile` | — |
| Change working directory | `-c, --change-dir` | `MIGRATE_CHANGE_DIR` | `changeDir` | — |
| Config file path | `--config` | — | — | `migrate.json` |

## Environment Variables

Prefix the uppercase underscore-separated option name with `MIGRATE_`:

```sh
export MIGRATE_DB_CONNECTION_URI=mongodb://localhost:27017/mydb
```

`.env` files are supported — variables are loaded automatically:

```sh
# .env
MIGRATE_DB_CONNECTION_URI=mongodb://localhost:27017/mydb
MIGRATE_MIGRATIONS_DIR=./migrations
```

## Config File

By default, `@eventonehq/migrate-mongoose` looks for `migrate.json` in the current directory:

```json
{
  "dbConnectionUri": "mongodb://localhost:27017/mydb",
  "migrationsDir": "./migrations"
}
```

To use a custom path:

```sh
npx migrate list --config path/to/myconfig.json
```

## Override Order

```
CLI flags  >  Environment variables  >  Config file
```

## Security

::: warning
Never hardcode connection URIs. Store `MIGRATE_DB_CONNECTION_URI` in environment variables or a config file excluded from version control.
:::

- **Add sensitive config files to `.gitignore`.** If `migrate.json` or `.env` contains a real connection URI, exclude it before committing.
- **Treat migration files as code.** They are executed directly by Node.js with full database access. Review them with the same scrutiny as application code.
- **Limit database user permissions.** The MongoDB user should have only the permissions needed to run migrations — avoid admin credentials.
