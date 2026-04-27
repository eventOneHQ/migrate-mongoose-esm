# Configuration

Avoid repeating `--dbConnectionUri` and other flags on every command by using one of these approaches.

## Environment Variables

Prefix any option name with `MIGRATE_`:

```sh
export MIGRATE_dbConnectionUri=mongodb://localhost:27017/mydb
```

`.env` files are supported — variables are loaded automatically:

```sh
# .env
MIGRATE_dbConnectionUri=mongodb://localhost:27017/mydb
MIGRATE_migrationsDir=./migrations
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
Never hardcode connection URIs. Store `MIGRATE_dbConnectionUri` in environment variables or a config file excluded from version control.
:::

- **Add sensitive config files to `.gitignore`.** If `migrate.json` or `.env` contains a real connection URI, exclude it before committing.
- **Treat migration files as code.** They are executed directly by Node.js with full database access. Review them with the same scrutiny as application code.
- **Limit database user permissions.** The MongoDB user should have only the permissions needed to run migrations — avoid admin credentials.
