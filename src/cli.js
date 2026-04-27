#! /usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { Command } from 'commander'

const { version } = createRequire(import.meta.url)('../package.json')

import { Migrator } from './lib.js'

// get Env Variables from .env file
try {
  process.loadEnvFile()
} catch {
  /* noop */
}

function loadConfigAndEnv(configPath) {
  const envVarOptions = {}
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('MIGRATE_')) {
      const suffix = key.slice('MIGRATE_'.length)
      const camelKey = suffix
        .toLowerCase()
        .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      envVarOptions[camelKey] = process.env[key]
    }
  }

  let fileOptions = {}
  try {
    fileOptions = JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    /* noop */
  }

  return { ...fileOptions, ...envVarOptions }
}

function getConfigPath() {
  const args = process.argv.slice(2)
  const idx = args.indexOf('--config')
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  return 'migrate.json'
}

const configDefaults = loadConfigAndEnv(getConfigPath())

const program = new Command()

program
  .name('migrate')
  .version(version)
  .usage(
    '-d <mongo-uri> [[create|up|down <migration-name>]|list] [optional options]',
  )
  .option(
    '--config <path>',
    'filepath to an options configuration json file',
    'migrate.json',
  )
  .option(
    '--collection <name>',
    'The collection to use for the migrations',
    configDefaults.collection ?? 'migrations',
  )
  .option(
    '-d, --db-connection-uri <uri>',
    'The URI of the database connection',
    configDefaults.dbConnectionUri,
  )
  .option(
    '--md, --migrations-dir <path>',
    'The path to the migration files',
    configDefaults.migrationsDir ?? './migrations',
  )
  .option(
    '-t, --template-file <path>',
    'The template file to use when creating a migration',
    configDefaults.templateFile,
  )
  .option(
    '-c, --change-dir <path>',
    'Change current working directory before running anything',
    configDefaults.changeDir,
  )
  .option(
    '--typescript',
    'Create a TypeScript migration file (.ts)',
    configDefaults.typescript ?? false,
  )

program.hook('preAction', () => {
  const opts = program.opts()

  if (opts.changeDir) process.chdir(opts.changeDir)

  if (!opts.dbConnectionUri) {
    console.error(
      'You need to provide the Mongo URI to persist migration status.\nUse option --dbConnectionUri / -d to provide the URI.'
        .red,
    )
    process.exit(1)
  }
})

function createMigrator() {
  const opts = program.opts()
  return new Migrator({
    migrationsPath: resolve(opts.migrationsDir),
    templatePath: opts.templateFile,
    dbConnectionUri: opts.dbConnectionUri,
    collectionName: opts.collection,
    typescript: opts.typescript,
    cli: true,
  })
}

function handleResult(migrator, promise) {
  process.on('SIGINT', () => {
    migrator.close().then(() => {
      process.exit(0)
    })
  })

  promise
    .then(() => {
      process.exit(0)
    })
    .catch((err) => {
      console.warn(err.message.yellow)
      process.exit(1)
    })
}

let commandRan = false

program
  .command('list')
  .description('Lists all migrations and their current state.')
  .allowExcessArguments(false)
  .action(() => {
    commandRan = true
    const migrator = createMigrator()
    handleResult(migrator, migrator.list())
  })

program
  .command('create <migration-name>')
  .description('Creates a new migration file.')
  .allowExcessArguments(false)
  .action((migrationName) => {
    commandRan = true
    const migrator = createMigrator()
    const promise = migrator.create(migrationName).then((result) => {
      console.log(
        'Migration created. Run ' +
          `migrate up ${migrationName}`.cyan +
          ' to apply the migration.',
      )
      return result
    })
    handleResult(migrator, promise)
  })

program
  .command('up [migration-name]')
  .description(
    'Migrates all the migration files that have not yet been run in chronological order. ' +
      'Not including [migration-name] will run UP on all migrations that are in a DOWN state.',
  )
  .allowExcessArguments(false)
  .action((migrationName) => {
    commandRan = true
    const migrator = createMigrator()
    handleResult(migrator, migrator.run('up', migrationName))
  })

program
  .command('down <migration-name>')
  .description(
    'Rolls back migrations down to given name (if down function was provided)',
  )
  .allowExcessArguments(false)
  .action((migrationName) => {
    commandRan = true
    const migrator = createMigrator()
    handleResult(migrator, migrator.run('down', migrationName))
  })

program
  .command('prune')
  .description(
    'Allows you to delete extraneous migrations by removing extraneous local migration files/database migrations.',
  )
  .allowExcessArguments(false)
  .action(() => {
    commandRan = true
    const migrator = createMigrator()
    handleResult(migrator, migrator.prune())
  })

// Unknown command: show help and exit 0
program.on('command:*', () => {
  program.outputHelp()
  process.exit(0)
})

program.parse()

// No command provided
if (!commandRan) process.exit(1)
