import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

import mongoose from 'mongoose'

// Inline ANSI color helpers
const ansiColors = { red: 31, yellow: 33, cyan: 36, green: 32 }
for (const [color, code] of Object.entries(ansiColors)) {
  Object.defineProperty(String.prototype, color, {
    configurable: true,
    get() {
      return `\x1b[${code}m${this}\x1b[39m`
    },
  })
}

import { MigrationModelFactory } from './db.js'

const migrationTemplate = `/**
 * Make any changes you need to make to the database here
 */
export async function up () {
  // Write migration here
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down () {
  // Write migration here
}
`

const migrationTemplateTs = `import type { Connection } from 'mongoose'

/**
 * Make any changes you need to make to the database here
 */
export async function up (this: Connection): Promise<void> {
  // Write migration here
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down (this: Connection): Promise<void> {
  // Write migration here
}
`

/**
 * Migrator class
 */
export class Migrator {
  /**
   * Create a migrator
   *
   * @param {Object} opts Options
   * @param {string} [opts.templatePath] Path of the template file to use when creating a migration
   * @param {string} [opts.migrationsPath=./migrations] The path to the migration files directory
   * @param {string} opts.dbConnectionUri The URI of the database connection (optional if `connection` is specified)
   * @param {string} [opts.collectionName=migrations] The collection to use for the migrations
   * @param {boolean} [opts.typescript=false] Generate TypeScript migration files (.ts)
   * @param {boolean} [opts.cli=false] Adds logging
   * @param {mongoose.Connection} [opts.connection] A mongoose connection to use
   */
  constructor({
    templatePath,
    migrationsPath = './migrations',
    dbConnectionUri,
    collectionName = 'migrations',
    typescript = false,
    cli = false,
    connection,
  }) {
    this.typescript = typescript
    const defaultTemplate = typescript ? migrationTemplateTs : migrationTemplate
    this.template = templatePath
      ? readFileSync(templatePath, 'utf-8')
      : defaultTemplate
    this.migrationPath = resolve(migrationsPath)
    this.connection = connection || mongoose.createConnection(dbConnectionUri)
    this.collection = collectionName
    this.cli = cli
    this.migrationModel = MigrationModelFactory(collectionName, this.connection)
  }

  /**
   * CLI logger
   *
   * @param {string} logString
   * @param {boolean} force
   *
   * @private
   */
  log(logString, force = false) {
    if (force || this.cli) {
      console.log(logString)
    }
  }

  /**
   * Use your own Mongoose connection object (so you can use `this('modelname')`)
   * @param {mongoose.Connection} connection Mongoose connection
   */
  setMongooseConnection(connection) {
    this.migrationModel = MigrationModelFactory(this.collection, connection)
    return this
  }

  /**
   * Close the underlying connection to mongo
   * @returns {Promise} A promise that resolves when connection is closed
   */
  close() {
    return this.connection ? this.connection.close() : Promise.resolve()
  }

  /**
   * Create a new migration
   * @param {string} migrationName Name of the migration
   * @returns {Promise<Migration>} A promise of the Migration created
   */
  async create(migrationName) {
    try {
      const existingMigration = await this.migrationModel.findOne({
        name: migrationName,
      })

      if (existingMigration) {
        throw new Error(
          `There is already a migration with name '${migrationName}' in the database`
            .red,
        )
      }

      await this.sync()
      const now = Date.now()
      const ext = this.typescript ? 'ts' : 'js'
      const newMigrationFile = `${now}-${migrationName}.${ext}`
      mkdirSync(this.migrationPath, { recursive: true })
      writeFileSync(join(this.migrationPath, newMigrationFile), this.template)

      // create instance in db
      const migrationCreated = await this.migrationModel.create({
        name: migrationName,
        createdAt: now,
      })

      this.log(`Created migration ${migrationName} in ${this.migrationPath}.`)
      return migrationCreated
    } catch (error) {
      this.log(error.stack)
      fileRequired(error)
    }
  }

  /**
   * Runs migrations up to or down to a given migration name
   *
   * @param migrationName Name of the migration
   * @param direction Run direction
   *
   * @returns {Promise<Migration[]>} A promise of the Migrations run
   *
   * @example
   * // Migrate Up
   * await migrator.run('up', migrationName)
   *
   * // Migrate Down
   * await migrator.run('down', migrationName)
   */
  async run(direction = 'up', migrationName, ...args) {
    await this.sync()

    if (direction !== 'up' && direction !== 'down') {
      throw new Error(
        `The '${direction}' is not supported, use the 'up' or 'down' direction`,
      )
    }

    const untilMigration = migrationName
      ? await this.migrationModel.findOne({ name: migrationName })
      : await this.migrationModel
          .findOne()
          .sort({ createdAt: direction === 'up' ? -1 : 1 })

    if (!untilMigration) {
      if (migrationName) {
        throw new ReferenceError(
          'Could not find that migration in the database',
        )
      } else throw new Error('There are no pending migrations.')
    }

    const isUp = direction === 'up'
    const query = isUp
      ? { createdAt: { $lte: untilMigration.createdAt }, state: 'down' }
      : { createdAt: { $gte: untilMigration.createdAt }, state: 'up' }

    const migrationsToRun = await this.migrationModel
      .find(query)
      .sort({ createdAt: isUp ? 1 : -1 })

    if (!migrationsToRun.length) {
      this.log('There are no migrations to run'.yellow)
      this.log("Current Migrations' Statuses: ")
      if (this.cli) await this.list()
    }

    const migrationsRan = []

    for (const migration of migrationsToRun) {
      const migrationFilePath = join(this.migrationPath, migration.filename)
      const migrationFunctions = await import(migrationFilePath)

      if (!migrationFunctions[direction]) {
        throw new Error(
          `The "${direction}" export is not defined in ${migration.filename}.`
            .red,
        )
      }

      try {
        await new Promise((resolve, reject) => {
          const callPromise = migrationFunctions[direction].call(
            this.connection.model.bind(this.connection),
            function callback(err) {
              if (err) return reject(err)
              resolve()
            },
            ...args,
          )

          if (callPromise && typeof callPromise.then === 'function') {
            callPromise.then(resolve).catch(reject)
          }
        })

        this.log(
          (isUp ? `UP:   ` : `DOWN: `)[isUp ? 'green' : 'red'] +
            ` ${migration.filename} `,
        )

        await this.migrationModel
          .where({ name: migration.name })
          .updateMany({ $set: { state: direction } })
        migrationsRan.push(migration.toJSON())
      } catch (err) {
        this.log(
          `Failed to run migration ${migration.name} due to an error.`.red,
        )
        this.log(
          'Not continuing. Make sure your data is in consistent state'.red,
        )
        throw err instanceof Error ? err : new Error(err)
      }
    }

    if (
      migrationsToRun.length > 0 &&
      migrationsRan.length === migrationsToRun.length
    ) {
      this.log('All migrations finished successfully.'.green)
    }
    return migrationsRan
  }

  /**
   * Returns migration files on disk cross-referenced with the database.
   * @returns {{ migrationsInFolder: Array<{createdAt: number, filename: string, existsInDatabase: boolean}>, migrationsInDatabase: Array }}
   * @private
   */
  async _getMigrationFiles() {
    mkdirSync(this.migrationPath, { recursive: true })
    const filesInMigrationFolder = readdirSync(this.migrationPath)
    const migrationsInDatabase = await this.migrationModel.find({})
    const migrationsInFolder = filesInMigrationFolder
      .filter((file) => /\d{13,}-.+\.(js|ts)$/.test(file))
      .map((filename) => {
        const createdAt = parseInt(filename.split('-')[0])
        const existsInDatabase = migrationsInDatabase.some(
          (m) => filename === m.filename,
        )
        return { createdAt, filename, existsInDatabase }
      })
    return { migrationsInFolder, migrationsInDatabase }
  }

  /**
   * Looks at the file system migrations and imports any migrations that are
   * on the file system but missing in the database into the database
   *
   * This functionality is opposite of `prune()`
   */
  async sync() {
    try {
      const { migrationsInFolder } = await this._getMigrationFiles()
      const filesNotInDb = migrationsInFolder
        .filter((file) => !file.existsInDatabase)
        .map((f) => f.filename)

      this.log('Synchronizing database with file system migrations...')

      return Promise.all(
        filesNotInDb.map(async (migrationToImport) => {
          const filePath = join(this.migrationPath, migrationToImport)
          const separatorIndex = migrationToImport.indexOf('-')
          const timestamp = migrationToImport.slice(0, separatorIndex)
          const migrationName = migrationToImport.slice(
            separatorIndex + 1,
            migrationToImport.lastIndexOf('.'),
          )

          this.log(
            `Adding migration ${filePath} into database from file system. State is ` +
              'DOWN'.red,
          )
          const createdMigration = await this.migrationModel.create({
            name: migrationName,
            createdAt: timestamp,
          })
          return createdMigration.toJSON()
        }),
      )
    } catch (error) {
      this.log(
        'Could not synchronise migrations in the migrations folder up to the database.'
          .red,
      )
      throw error
    }
  }

  /**
   * Opposite of `sync()`.
   * Removes files in migration directory which don't exist in database.
   */
  async prune() {
    try {
      const { migrationsInFolder, migrationsInDatabase } =
        await this._getMigrationFiles()

      const dbMigrationsNotOnFs = migrationsInDatabase.filter(
        (m) => !migrationsInFolder.find((f) => f.filename === m.filename),
      )

      if (dbMigrationsNotOnFs.length) {
        const names = dbMigrationsNotOnFs.map((m) => m.name)
        this.log(
          'Removing migration(s) ' +
            `${names.join(', ')}`.cyan +
            ' from database',
        )
        await this.migrationModel.deleteMany({ name: { $in: names } })
      }

      return dbMigrationsNotOnFs.map((m) => m.toJSON())
    } catch (error) {
      this.log('Could not prune extraneous migrations from database.'.red)
      throw error
    }
  }

  /**
   * Lists the current migrations and their statuses
   * @returns {Promise<Array<Migration>>}
   * @example
   * [
   *   {
   *     name: 'my-migration',
   *     filename: '149213223424_my-migration.js',
   *     state: 'up'
   *   },
   *   {
   *     name: 'add-cows',
   *     filename: '149213223453_add-cows.js',
   *     state: 'down'
   *   }
   * ]
   */
  async list() {
    await this.sync()
    const migrations = await this.migrationModel.find().sort({ createdAt: 1 })
    if (!migrations.length) this.log('There are no migrations to list.'.yellow)
    return migrations.map((m) => {
      this.log(
        `${m.state === 'up' ? 'UP:  \t' : 'DOWN:\t'}`[
          m.state === 'up' ? 'green' : 'red'
        ] + ` ${m.filename}`,
      )
      return m.toJSON()
    })
  }
}

function fileRequired(error) {
  if (error && error.code === 'ENOENT') {
    throw new ReferenceError(`Could not find any files at path '${error.path}'`)
  }
}
