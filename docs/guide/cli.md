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
| `prune`         | Removes DB entries for migrations that no longer exist on the filesystem          |

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

## Examples

```sh
npx migrate list -d mongodb://localhost/mydb
npx migrate create add_users -d mongodb://localhost/mydb
npx migrate up -d mongodb://localhost/mydb
npx migrate up add_users -d mongodb://localhost/mydb
npx migrate down add_users -d mongodb://localhost/mydb
npx migrate prune -d mongodb://localhost/mydb
npx migrate list --config migrate.json
```
