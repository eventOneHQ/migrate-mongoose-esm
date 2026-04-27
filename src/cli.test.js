import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { MongoMemoryServer } from 'mongodb-memory-server'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(__dirname, 'cli.js')

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

let _seq = 0
function uniqueCollection() {
  return `cli_col_${Date.now()}_${++_seq}`
}

function makeTempDir() {
  const dir = join(
    tmpdir(),
    `cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Run the CLI as a child process.
 * Returns { exitCode, stdout, stderr }.
 */
async function runCLI(args, opts = {}) {
  // Strip any MIGRATE_* vars from the parent process so they don't
  // bleed into tests that don't want them.
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('MIGRATE_')),
  )

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI, ...args],
      {
        env: {
          ...cleanEnv,
          NO_COLOR: '1',
          FORCE_COLOR: '0',
          ...opts.env,
        },
        cwd: opts.cwd ?? process.cwd(),
      },
    )
    return { exitCode: 0, stdout, stderr }
  } catch (err) {
    return {
      exitCode: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    }
  }
}

/** Assemble the flags every real command needs. */
function base(migrationsDir, collection) {
  return [
    '-d',
    mongoUri,
    '--migrations-dir',
    migrationsDir,
    '--collection',
    collection,
  ]
}

// ---------------------------------------------------------------------------
// Error / bad-argument cases
// ---------------------------------------------------------------------------

describe('CLI – error cases', () => {
  it('exits non-zero when no command is provided', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
    ])
    expect(exitCode).not.toBe(0)
  })

  it('exits non-zero when -d (dbConnectionUri) is missing', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      '--migrations-dir',
      migrationsDir,
      '--collection',
      uniqueCollection(),
      'list',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('exits 0 and shows help for an unknown command', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode, stdout, stderr } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'unknownCommand',
    ])
    expect(exitCode).toBe(0)
    expect(stdout + stderr).toMatch(/Usage/i)
  })
})

// ---------------------------------------------------------------------------
// list command
// ---------------------------------------------------------------------------

describe('CLI – list', () => {
  it('exits 0 with an empty migrations folder', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'list',
    ])
    expect(exitCode).toBe(0)
  })

  it('shows migrations after they are created', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    await runCLI([...base(migrationsDir, col), 'create', 'list-migration'])

    const { exitCode, stdout } = await runCLI([
      ...base(migrationsDir, col),
      'list',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('list-migration')
  })

  it('exits non-zero when extra arguments are provided', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'list',
      'extra-arg',
    ])
    expect(exitCode).not.toBe(0)
  })
})

// ---------------------------------------------------------------------------
// create command
// ---------------------------------------------------------------------------

describe('CLI – create', () => {
  it('exits 0 and creates a migration file on disk', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'create',
      'my-new-migration',
    ])
    expect(exitCode).toBe(0)
    const files = readdirSync(migrationsDir)
    expect(files.some((f) => f.endsWith('-my-new-migration.js'))).toBe(true)
  })

  it('prints a follow-up instruction after creation', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode, stdout } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'create',
      'create-msg-check',
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Migration created')
  })

  it('exits non-zero when no migration name is given', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'create',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('exits non-zero when too many arguments are provided', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'create',
      'foo',
      'bar',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('migration file contains the default up/down template', async () => {
    const migrationsDir = makeTempDir()
    await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'create',
      'template-check',
    ])
    const files = readdirSync(migrationsDir)
    const file = files.find((f) => f.endsWith('-template-check.js'))
    const { readFileSync } = await import('fs')
    const content = readFileSync(join(migrationsDir, file), 'utf-8')
    expect(content).toContain('export async function up')
    expect(content).toContain('export async function down')
  })
})

// ---------------------------------------------------------------------------
// up command
// ---------------------------------------------------------------------------

describe('CLI – up', () => {
  it('exits non-zero when there are no pending migrations', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'up',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('runs all pending up migrations and exits 0', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    await runCLI([...base(migrationsDir, col), 'create', 'run-up-all'])
    const { exitCode } = await runCLI([...base(migrationsDir, col), 'up'])
    expect(exitCode).toBe(0)
  })

  it('marks migrations as UP after running', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    await runCLI([...base(migrationsDir, col), 'create', 'up-state-check'])
    await runCLI([...base(migrationsDir, col), 'up'])

    const { stdout } = await runCLI([...base(migrationsDir, col), 'list'])
    expect(stdout).toMatch(/UP/i)
  })

  it('runs only the named migration', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    await runCLI([...base(migrationsDir, col), 'create', 'named-up'])
    const { exitCode } = await runCLI([
      ...base(migrationsDir, col),
      'up',
      'named-up',
    ])
    expect(exitCode).toBe(0)
  })

  it('exits non-zero when named migration does not exist', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'up',
      'does-not-exist',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('exits non-zero when too many arguments are provided', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'up',
      'foo',
      'bar',
    ])
    expect(exitCode).not.toBe(0)
  })
})

// ---------------------------------------------------------------------------
// down command
// ---------------------------------------------------------------------------

describe('CLI – down', () => {
  it('runs down on a migration that was run up and exits 0', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    await runCLI([...base(migrationsDir, col), 'create', 'run-down'])
    await runCLI([...base(migrationsDir, col), 'up'])
    const { exitCode } = await runCLI([
      ...base(migrationsDir, col),
      'down',
      'run-down',
    ])
    expect(exitCode).toBe(0)
  })

  it('marks migrations as DOWN after running down', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    await runCLI([...base(migrationsDir, col), 'create', 'down-state-check'])
    await runCLI([...base(migrationsDir, col), 'up'])
    await runCLI([...base(migrationsDir, col), 'down', 'down-state-check'])

    const { stdout } = await runCLI([...base(migrationsDir, col), 'list'])
    expect(stdout).toMatch(/DOWN/i)
  })

  it('exits non-zero when no migration name is given', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'down',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('exits non-zero when too many arguments are provided', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'down',
      'foo',
      'bar',
    ])
    expect(exitCode).not.toBe(0)
  })

  it('exits non-zero when named migration does not exist', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'down',
      'does-not-exist',
    ])
    expect(exitCode).not.toBe(0)
  })
})

// ---------------------------------------------------------------------------
// prune command
// ---------------------------------------------------------------------------

describe('CLI – prune', () => {
  it('exits 0 when there is nothing to prune', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'prune',
    ])
    expect(exitCode).toBe(0)
  })

  it('removes database-only migrations and exits 0', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    // Create a migration (file + DB record) then delete the file manually
    await runCLI([...base(migrationsDir, col), 'create', 'orphan-migration'])
    const files = readdirSync(migrationsDir)
    const orphanFile = join(
      migrationsDir,
      files.find((f) => f.endsWith('-orphan-migration.js')),
    )
    const { unlinkSync } = await import('fs')
    unlinkSync(orphanFile)

    const { exitCode } = await runCLI([...base(migrationsDir, col), 'prune'])
    expect(exitCode).toBe(0)
  })

  it('exits non-zero when extra arguments are provided', async () => {
    const migrationsDir = makeTempDir()
    const { exitCode } = await runCLI([
      ...base(migrationsDir, uniqueCollection()),
      'prune',
      'extra-arg',
    ])
    expect(exitCode).not.toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

describe('CLI – configuration', () => {
  it('--change-dir changes the working directory before resolving paths', async () => {
    // baseDir will be the "project root" the CLI should chdir into
    const baseDir = makeTempDir()
    // The migrations dir is a subdirectory of baseDir
    const migsDir = join(baseDir, 'migs')
    mkdirSync(migsDir, { recursive: true })
    const col = uniqueCollection()

    // Run from a completely different cwd; use --change-dir to point to baseDir
    // and --migrations-dir to the relative subdirectory name
    const { exitCode } = await runCLI(
      [
        '-d',
        mongoUri,
        '--migrations-dir',
        'migs',
        '--collection',
        col,
        '--change-dir',
        baseDir,
        'list',
      ],
      { cwd: tmpdir() },
    )
    expect(exitCode).toBe(0)
  })

  it('--change-dir creates migrations dir if it does not exist', async () => {
    const { exitCode } = await runCLI(
      [
        '-d',
        mongoUri,
        '--migrations-dir',
        'nonexistent-migs',
        '--collection',
        uniqueCollection(),
        '--change-dir',
        tmpdir(),
        'list',
      ],
      { cwd: tmpdir() },
    )
    expect(exitCode).toBe(0)
  })

  it('reads options from a migrate.json config file', async () => {
    const projectDir = makeTempDir()
    const migsDir = join(projectDir, 'migrations')
    mkdirSync(migsDir, { recursive: true })
    const col = uniqueCollection()

    writeFileSync(
      join(projectDir, 'migrate.json'),
      JSON.stringify({
        dbConnectionUri: mongoUri,
        migrationsDir: migsDir,
        collection: col,
      }),
    )

    // Run without -d; the config file provides it
    const { exitCode } = await runCLI(
      ['--config', join(projectDir, 'migrate.json'), 'list'],
      { cwd: projectDir },
    )
    expect(exitCode).toBe(0)
  })

  it('reads MIGRATE_* environment variables', async () => {
    const migrationsDir = makeTempDir()
    const col = uniqueCollection()

    // Pass the URI via env var instead of -d flag
    const { exitCode } = await runCLI(
      ['--migrations-dir', migrationsDir, '--collection', col, 'list'],
      { env: { MIGRATE_DB_CONNECTION_URI: mongoUri } },
    )
    expect(exitCode).toBe(0)
  })
})
