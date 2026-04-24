import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { Migrator } from './lib.js'
import { MigrationModelFactory } from './db.js'

// ---------------------------------------------------------------------------
// Shared in-memory MongoDB server
// ---------------------------------------------------------------------------

let mongoServer
let mongoUri

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  mongoUri = mongoServer.getUri()
})

afterAll(async () => {
  await mongoServer.stop()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh temp directory for each test so tests don't interfere.
 */
function makeTempMigrationsDir() {
  const dir = join(
    tmpdir(),
    `migrate-mongoose-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Write a real migration file into a directory so that sync / run can use it.
 */
function writeMigrationFile(dir, filename, content) {
  const defaultContent = `
export async function up() {}
export async function down() {}
`
  writeFileSync(join(dir, filename), content ?? defaultContent)
}

/**
 * Build a Migrator with a fresh migrations dir.
 * Returns { migrator, migrationsPath, connection }.
 */
async function makeAutoMigrator(overrides = {}) {
  const migrationsPath = makeTempMigrationsDir()
  const connection = mongoose.createConnection(mongoUri)
  await connection.asPromise()

  const migrator = new Migrator({
    migrationsPath,
    connection,
    ...overrides,
  })

  return { migrator, migrationsPath, connection }
}

// ---------------------------------------------------------------------------
// MigrationModelFactory
// ---------------------------------------------------------------------------

describe('MigrationModelFactory', () => {
  let connection

  beforeAll(async () => {
    connection = mongoose.createConnection(mongoUri)
    await connection.asPromise()
  })

  afterAll(async () => {
    await connection.close()
  })

  it('creates a model that can persist migrations', async () => {
    const Model = MigrationModelFactory('test_model_basic', connection)
    const doc = await Model.create({
      name: 'test-migration',
      createdAt: new Date(),
    })
    expect(doc.name).toBe('test-migration')
    expect(doc.state).toBe('down')
    await Model.deleteMany({})
  })

  it('defaults state to "down"', async () => {
    const Model = MigrationModelFactory('test_model_state', connection)
    const doc = await Model.create({
      name: 'state-test',
      createdAt: new Date(),
    })
    expect(doc.state).toBe('down')
    await Model.deleteMany({})
  })

  it('generates filename virtual correctly', async () => {
    const Model = MigrationModelFactory('test_model_virtual', connection)
    const createdAt = new Date(1700000000000)
    const doc = await Model.create({ name: 'my-migration', createdAt })
    expect(doc.filename).toBe('1700000000000-my-migration.js')
    await Model.deleteMany({})
  })

  it('toJSON removes _id, id and __v', async () => {
    const Model = MigrationModelFactory('test_model_json', connection)
    const doc = await Model.create({ name: 'json-test', createdAt: new Date() })
    const json = doc.toJSON()
    expect(json._id).toBeUndefined()
    expect(json.id).toBeUndefined()
    expect(json.__v).toBeUndefined()
    expect(json.name).toBe('json-test')
    await Model.deleteMany({})
  })

  it('accepts a custom collection name', async () => {
    const Model = MigrationModelFactory('custom_collection_xyz', connection)
    expect(Model.collection.name).toBe('custom_collection_xyz')
    await Model.deleteMany({})
  })
})

// ---------------------------------------------------------------------------
// Migrator – constructor
// ---------------------------------------------------------------------------

describe('Migrator constructor', () => {
  // Each test gets its own connection to avoid OverwriteModelError when
  // registering the default 'migrations' model name multiple times.
  let connections

  beforeEach(() => {
    connections = []
  })

  afterEach(async () => {
    await Promise.all(connections.map((c) => c.close()))
  })

  async function freshConnection() {
    const conn = mongoose.createConnection(mongoUri)
    await conn.asPromise()
    connections.push(conn)
    return conn
  }

  it('uses provided connection instead of creating a new one', async () => {
    const connection = await freshConnection()
    const migrationsPath = makeTempMigrationsDir()
    const migrator = new Migrator({
      migrationsPath,
      connection,
    })
    expect(migrator.connection).toBe(connection)
  })

  it('sets migrationsPath to resolved path', async () => {
    const connection = await freshConnection()
    const migrationsPath = makeTempMigrationsDir()
    const migrator = new Migrator({
      migrationsPath,
      connection,
    })
    expect(migrator.migrationPath).toBe(resolve(migrationsPath))
  })

  it('defaults collectionName to "migrations"', async () => {
    const connection = await freshConnection()
    const migrationsPath = makeTempMigrationsDir()
    const migrator = new Migrator({
      migrationsPath,
      connection,
    })
    expect(migrator.collection).toBe('migrations')
  })

  it('accepts a custom collectionName', async () => {
    const connection = await freshConnection()
    const migrationsPath = makeTempMigrationsDir()
    const migrator = new Migrator({
      migrationsPath,
      connection,
      collectionName: 'my_migrations',
    })
    expect(migrator.collection).toBe('my_migrations')
  })

  it('uses builtin template when no templatePath given', async () => {
    const connection = await freshConnection()
    const migrationsPath = makeTempMigrationsDir()
    const migrator = new Migrator({
      migrationsPath,
      connection,
    })
    expect(migrator.template).toContain('export async function up')
    expect(migrator.template).toContain('export async function down')
  })

  it('reads a custom template file when templatePath is given', async () => {
    const connection = await freshConnection()
    const migrationsPath = makeTempMigrationsDir()
    const templatePath = join(migrationsPath, 'template.js')
    writeFileSync(templatePath, '// custom template')
    const migrator = new Migrator({
      migrationsPath,
      connection,
      templatePath,
    })
    expect(migrator.template).toBe('// custom template')
  })

  it('creates a connection from dbConnectionUri when no connection is provided', () => {
    const migrationsPath = makeTempMigrationsDir()
    const migrator = new Migrator({
      migrationsPath,
      dbConnectionUri: mongoUri,
    })
    expect(migrator.connection).toBeDefined()
    connections.push(migrator.connection)
  })
})

// ---------------------------------------------------------------------------
// Migrator – close()
// ---------------------------------------------------------------------------

describe('Migrator.close()', () => {
  it('closes the connection', async () => {
    const migrationsPath = makeTempMigrationsDir()
    const conn = mongoose.createConnection(mongoUri)
    await conn.asPromise()
    const migrator = new Migrator({
      migrationsPath,
      connection: conn,
    })
    await migrator.close()
    // readyState 0 = disconnected
    expect(conn.readyState).toBe(0)
  })

  it('resolves when connection is falsy', async () => {
    const migrationsPath = makeTempMigrationsDir()
    const conn = mongoose.createConnection(mongoUri)
    await conn.asPromise()
    const migrator = new Migrator({
      migrationsPath,
      connection: conn,
    })
    migrator.connection = null
    await expect(migrator.close()).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Migrator – setMongooseConnection()
// ---------------------------------------------------------------------------

describe('Migrator.setMongooseConnection()', () => {
  it('updates the migration model to use the new connection', async () => {
    const { migrator, connection } = await makeAutoMigrator({
      collectionName: 'set_conn_migrations',
    })
    const conn2 = mongoose.createConnection(mongoUri)
    await conn2.asPromise()

    migrator.setMongooseConnection(conn2)

    // The model should now be backed by conn2
    expect(migrator.migrationModel.db).toBe(conn2)

    await migrator.close()
    await conn2.close()
    await connection.close()
  })

  it('returns the migrator for chaining', async () => {
    const { migrator, connection } = await makeAutoMigrator({
      collectionName: 'set_conn_chain',
    })
    const conn2 = mongoose.createConnection(mongoUri)
    await conn2.asPromise()

    const result = migrator.setMongooseConnection(conn2)
    expect(result).toBe(migrator)

    await migrator.close()
    await conn2.close()
    await connection.close()
  })
})

// ---------------------------------------------------------------------------
// Migrator – create()
// ---------------------------------------------------------------------------

describe('Migrator.create()', () => {
  let migrator, migrationsPath, connection

  beforeEach(async () => {
    ;({ migrator, migrationsPath, connection } = await makeAutoMigrator({
      collectionName: `create_test_${Date.now()}`,
    }))
  })

  afterEach(async () => {
    await migrator.migrationModel.deleteMany({})
    await migrator.close()
    rmSync(migrationsPath, { recursive: true, force: true })
  })

  it('creates a migration file on disk', async () => {
    await migrator.create('add-users')
    const files = readdirSync(migrationsPath)
    expect(files.some((f) => f.endsWith('-add-users.js'))).toBe(true)
  })

  it('writes the default template into the migration file', async () => {
    await migrator.create('template-check')
    const files = readdirSync(migrationsPath).filter((f) =>
      f.endsWith('-template-check.js'),
    )
    const { readFileSync } = await import('fs')
    const content = readFileSync(join(migrationsPath, files[0]), 'utf-8')
    expect(content).toContain('export async function up')
    expect(content).toContain('export async function down')
  })

  it('creates a migration record in the database', async () => {
    const doc = await migrator.create('db-record')
    expect(doc.name).toBe('db-record')
    expect(doc.state).toBe('down')
  })

  it('returns the created migration document', async () => {
    const doc = await migrator.create('return-value')
    expect(doc).toBeDefined()
    expect(doc.name).toBe('return-value')
  })

  it('returns undefined (does not throw) when a migration with that name already exists', async () => {
    // The library catches the duplicate error internally and returns undefined.
    await migrator.create('duplicate')
    const result = await migrator.create('duplicate')
    expect(result).toBeUndefined()
  })

  it('migration file uses a unix-ms timestamp prefix', async () => {
    const before = Date.now()
    await migrator.create('timestamp-test')
    const after = Date.now()
    const files = readdirSync(migrationsPath).filter((f) =>
      f.endsWith('-timestamp-test.js'),
    )
    const ts = parseInt(files[0].split('-')[0], 10)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

// ---------------------------------------------------------------------------
// Migrator – sync()
// ---------------------------------------------------------------------------

describe('Migrator.sync()', () => {
  let migrator, migrationsPath, connection

  beforeEach(async () => {
    ;({ migrator, migrationsPath, connection } = await makeAutoMigrator({
      collectionName: `sync_test_${Date.now()}`,
    }))
  })

  afterEach(async () => {
    await migrator.migrationModel.deleteMany({})
    await migrator.close()
    rmSync(migrationsPath, { recursive: true, force: true })
  })

  it('imports filesystem migrations missing from the database', async () => {
    const filename = '1700000000000-sync-me.js'
    writeMigrationFile(migrationsPath, filename)

    const imported = await migrator.sync()
    expect(imported).toHaveLength(1)
    expect(imported[0].name).toBe('sync-me')
  })

  it('does not duplicate migrations already in the database', async () => {
    const filename = '1700000000001-already-in-db.js'
    writeMigrationFile(migrationsPath, filename)

    await migrator.sync()
    const second = await migrator.sync()
    // Nothing new to import
    expect(second).toHaveLength(0)
  })

  it('ignores files that do not match the migration filename pattern', async () => {
    writeFileSync(join(migrationsPath, 'not-a-migration.js'), '// noop')
    const imported = await migrator.sync()
    expect(imported).toHaveLength(0)
  })

  it('handles an empty migrations folder gracefully', async () => {
    const imported = await migrator.sync()
    expect(imported).toHaveLength(0)
  })

  it('sets imported migration state to "down"', async () => {
    const filename = '1700000000002-state-down.js'
    writeMigrationFile(migrationsPath, filename)

    const [imported] = await migrator.sync()
    expect(imported.state).toBe('down')
  })

  it('stores the correct name (without timestamp and extension)', async () => {
    const filename = '1700000000003-parse-name.js'
    writeMigrationFile(migrationsPath, filename)

    const [imported] = await migrator.sync()
    expect(imported.name).toBe('parse-name')
  })
})

// ---------------------------------------------------------------------------
// Migrator – list()
// ---------------------------------------------------------------------------

describe('Migrator.list()', () => {
  let migrator, migrationsPath, connection

  beforeEach(async () => {
    ;({ migrator, migrationsPath, connection } = await makeAutoMigrator({
      collectionName: `list_test_${Date.now()}`,
    }))
  })

  afterEach(async () => {
    await migrator.migrationModel.deleteMany({})
    await migrator.close()
    rmSync(migrationsPath, { recursive: true, force: true })
  })

  it('returns an empty array when there are no migrations', async () => {
    const list = await migrator.list()
    expect(list).toEqual([])
  })

  it('returns all migrations sorted by createdAt ascending', async () => {
    await migrator.migrationModel.create([
      { name: 'first', createdAt: new Date(1000), state: 'up' },
      { name: 'second', createdAt: new Date(2000), state: 'down' },
    ])
    // Write corresponding files so sync doesn't try to add them
    writeMigrationFile(migrationsPath, '1000-first.js')
    writeMigrationFile(migrationsPath, '2000-second.js')

    const list = await migrator.list()
    expect(list[0].name).toBe('first')
    expect(list[1].name).toBe('second')
  })

  it('returns plain objects (via toJSON)', async () => {
    await migrator.migrationModel.create({
      name: 'plain-object',
      createdAt: new Date(3000),
    })
    writeMigrationFile(migrationsPath, '3000-plain-object.js')

    const [item] = await migrator.list()
    expect(item._id).toBeUndefined()
    expect(item.name).toBe('plain-object')
  })
})

// ---------------------------------------------------------------------------
// Migrator – prune()
// ---------------------------------------------------------------------------

describe('Migrator.prune()', () => {
  let migrator, migrationsPath, connection

  beforeEach(async () => {
    ;({ migrator, migrationsPath, connection } = await makeAutoMigrator({
      collectionName: `prune_test_${Date.now()}`,
    }))
  })

  afterEach(async () => {
    await migrator.migrationModel.deleteMany({})
    await migrator.close()
    rmSync(migrationsPath, { recursive: true, force: true })
  })

  it('removes database entries that have no corresponding file', async () => {
    // Only in DB, no file on disk
    await migrator.migrationModel.create({
      name: 'ghost',
      createdAt: new Date(1700000010000),
    })

    const removed = await migrator.prune()
    expect(removed).toHaveLength(1)
    expect(removed[0].name).toBe('ghost')

    const remaining = await migrator.migrationModel.find({})
    expect(remaining).toHaveLength(0)
  })

  it('does not remove database entries that have a file', async () => {
    const filename = '1700000020000-keep-me.js'
    writeMigrationFile(migrationsPath, filename)
    await migrator.migrationModel.create({
      name: 'keep-me',
      createdAt: new Date(1700000020000),
    })

    const removed = await migrator.prune()
    expect(removed).toHaveLength(0)
    const remaining = await migrator.migrationModel.find({})
    expect(remaining).toHaveLength(1)
  })

  it('returns an empty array when nothing needs pruning', async () => {
    const removed = await migrator.prune()
    expect(removed).toEqual([])
  })

  it('returns the pruned migration docs', async () => {
    await migrator.migrationModel.create({
      name: 'orphan',
      createdAt: new Date(1700000030000),
    })

    const [doc] = await migrator.prune()
    expect(doc.name).toBe('orphan')
  })
})

// ---------------------------------------------------------------------------
// Migrator – run()
// ---------------------------------------------------------------------------

describe('Migrator.run()', () => {
  let migrator, migrationsPath, connection

  beforeEach(async () => {
    ;({ migrator, migrationsPath, connection } = await makeAutoMigrator({
      collectionName: `run_test_${Date.now()}`,
    }))
  })

  afterEach(async () => {
    await migrator.migrationModel.deleteMany({})
    await migrator.close()
    rmSync(migrationsPath, { recursive: true, force: true })
  })

  it('throws for an unsupported direction', async () => {
    await expect(migrator.run('sideways')).rejects.toThrow(/not supported/i)
  })

  it('throws when there are no pending migrations', async () => {
    await expect(migrator.run('up')).rejects.toThrow(
      /There are no pending migrations/i,
    )
  })

  it('throws ReferenceError when named migration is not in the database', async () => {
    await expect(migrator.run('up', 'nonexistent')).rejects.toThrow(
      /Could not find that migration in the database/i,
    )
  })

  it('runs all pending up migrations and marks them as "up"', async () => {
    // Create two migration files with no-op up/down
    const ts1 = 1700001000000
    const ts2 = 1700002000000
    const file1 = `${ts1}-up-first.js`
    const file2 = `${ts2}-up-second.js`
    writeMigrationFile(migrationsPath, file1)
    writeMigrationFile(migrationsPath, file2)

    // Import them via sync
    await migrator.sync()

    const ran = await migrator.run('up')
    expect(ran).toHaveLength(2)

    const docs = await migrator.migrationModel.find({})
    expect(docs.every((d) => d.state === 'up')).toBe(true)
  })

  it('runs only the specified migration up', async () => {
    const ts1 = 1700003000000
    const ts2 = 1700004000000
    writeMigrationFile(migrationsPath, `${ts1}-named-first.js`)
    writeMigrationFile(migrationsPath, `${ts2}-named-second.js`)
    await migrator.sync()

    const ran = await migrator.run('up', 'named-first')
    expect(ran).toHaveLength(1)
    expect(ran[0].name).toBe('named-first')
  })

  it('runs down migrations and marks them as "down"', async () => {
    const ts = 1700005000000
    writeMigrationFile(migrationsPath, `${ts}-to-down.js`)
    await migrator.sync()

    // First run up
    await migrator.run('up')

    // Then run down
    const ran = await migrator.run('down', 'to-down')
    expect(ran).toHaveLength(1)

    const doc = await migrator.migrationModel.findOne({ name: 'to-down' })
    expect(doc.state).toBe('down')
  })

  it('throws when a migration file is missing the direction export', async () => {
    const ts = 1700006000000
    const filename = `${ts}-missing-export.js`
    // Write a file with only up, no down
    writeFileSync(
      join(migrationsPath, filename),
      'export async function up() {}',
    )
    await migrator.sync()
    await migrator.run('up')

    // Now try to run down – file has no down export
    await expect(migrator.run('down', 'missing-export')).rejects.toThrow(
      /down.*export is not defined/i,
    )
  })

  it('propagates errors thrown inside a migration function', async () => {
    const ts = 1700007000000
    const filename = `${ts}-throws.js`
    writeFileSync(
      join(migrationsPath, filename),
      `export async function up() { throw new Error('migration failed') }
       export async function down() {}`,
    )
    await migrator.sync()

    await expect(migrator.run('up', 'throws')).rejects.toThrow(
      /migration failed/,
    )
  })

  it('returns the ran migrations as plain objects', async () => {
    const ts = 1700008000000
    writeMigrationFile(migrationsPath, `${ts}-plain-run.js`)
    await migrator.sync()

    const [ran] = await migrator.run('up')
    expect(ran._id).toBeUndefined()
    expect(ran.name).toBe('plain-run')
  })

  it('returns an empty array when all migrations are already up', async () => {
    const ts = 1700009000000
    writeMigrationFile(migrationsPath, `${ts}-already-up.js`)
    await migrator.sync()

    await migrator.run('up')
    // Running up again finds nothing to do and returns []
    const result = await migrator.run('up')
    expect(result).toEqual([])
  })

  it('runs up migrations in ascending createdAt order', async () => {
    const order = []
    const ts1 = 1700010000000
    const ts2 = 1700010000001
    writeFileSync(
      join(migrationsPath, `${ts1}-order-first.js`),
      `export async function up() { globalThis.__migrationOrder = (globalThis.__migrationOrder||[]); globalThis.__migrationOrder.push('first') }
       export async function down() {}`,
    )
    writeFileSync(
      join(migrationsPath, `${ts2}-order-second.js`),
      `export async function up() { globalThis.__migrationOrder = (globalThis.__migrationOrder||[]); globalThis.__migrationOrder.push('second') }
       export async function down() {}`,
    )
    await migrator.sync()
    globalThis.__migrationOrder = []
    await migrator.run('up')
    expect(globalThis.__migrationOrder).toEqual(['first', 'second'])
  })
})

// ---------------------------------------------------------------------------
// Migrator – log() (private but testable via cli flag)
// ---------------------------------------------------------------------------

describe('Migrator log()', () => {
  it('does not log when cli=false', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { migrator, connection } = await makeAutoMigrator({
      cli: false,
      collectionName: `log_test_${Date.now()}`,
    })
    migrator.log('should not appear')
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
    await migrator.close()
    await connection.close()
  })

  it('logs when cli=true', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const migrationsPath = makeTempMigrationsDir()
    const conn = mongoose.createConnection(mongoUri)
    await conn.asPromise()
    const migrator = new Migrator({
      migrationsPath,
      connection: conn,
      cli: true,
      collectionName: `log_cli_test_${Date.now()}`,
    })
    migrator.log('hello from cli')
    expect(consoleSpy).toHaveBeenCalledWith('hello from cli')
    consoleSpy.mockRestore()
    await migrator.close()
  })

  it('logs when force=true even if cli=false', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { migrator, connection } = await makeAutoMigrator({
      cli: false,
      collectionName: `log_force_${Date.now()}`,
    })
    migrator.log('forced message', true)
    expect(consoleSpy).toHaveBeenCalledWith('forced message')
    consoleSpy.mockRestore()
    await migrator.close()
    await connection.close()
  })
})
