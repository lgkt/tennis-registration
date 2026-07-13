import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const dbPath = process.env.DB_PATH || path.join(dataDir, 'registrations.db')
const databaseUrl = process.env.DATABASE_URL

export interface Statement {
  get(...params: any[]): Promise<any>
  all(...params: any[]): Promise<any[]>
  run(...params: any[]): Promise<{ lastInsertRowid?: number; changes?: number }>
}

export interface Db {
  prepare(sql: string): Statement
  exec(sql: string): Promise<void>
}

let dbInstance: Db | null = null
let initPromise: Promise<void> | null = null

const tableConflictColumns: Record<string, string[]> = {
  settings: ['key'],
  members: ['name'],
  class_cancellations: ['week_key', 'class_day'],
}

function extractTableName(sql: string): string | null {
  const match = sql.match(/INTO\s+(\w+)/i)
  return match ? match[1] : null
}

function convertPlaceholders(sql: string): string {
  let idx = 0
  return sql.replace(/\?/g, () => {
    idx++
    return `$${idx}`
  })
}

function convertInsertOrIgnore(sql: string): string {
  const tableName = extractTableName(sql)
  if (!tableName) return sql
  const conflictCols = tableConflictColumns[tableName]
  if (!conflictCols) return sql
  return sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO') + ` ON CONFLICT (${conflictCols.join(', ')}) DO NOTHING`
}

function convertInsertOrReplace(sql: string): string {
  const tableName = extractTableName(sql)
  if (!tableName) return sql
  const conflictCols = tableConflictColumns[tableName]
  if (!conflictCols) return sql

  const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i)
  const colMatch = sql.match(/INSERT\s+OR\s+REPLACE\s+INTO\s+\w+\s*\(([^)]+)\)/i)
  
  if (!colMatch || !valuesMatch) return sql

  const columns = colMatch[1].split(',').map(c => c.trim())
  const updateCols = columns.filter(c => !conflictCols.includes(c))
  const updateSet = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')

  return sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO') + 
    ` ON CONFLICT (${conflictCols.join(', ')}) DO UPDATE SET ${updateSet}`
}

function convertSqlForPg(sql: string): string {
  let result = sql
  if (/INSERT\s+OR\s+IGNORE/i.test(result)) {
    result = convertInsertOrIgnore(result)
  } else if (/INSERT\s+OR\s+REPLACE/i.test(result)) {
    result = convertInsertOrReplace(result)
  }
  return result
}

function convertDatetimeNow(sql: string): string {
  return sql.replace(/datetime\('now'\)/gi, 'NOW()')
}

class SqliteStatement implements Statement {
  private stmt: Database.Statement

  constructor(stmt: Database.Statement) {
    this.stmt = stmt
  }

  async get(...params: any[]): Promise<any> {
    return this.stmt.get(...params)
  }

  async all(...params: any[]): Promise<any[]> {
    return this.stmt.all(...params) as any[]
  }

  async run(...params: any[]): Promise<{ lastInsertRowid?: number; changes?: number }> {
    const result = this.stmt.run(...params)
    return {
      lastInsertRowid: result.lastInsertRowid as number,
      changes: result.changes,
    }
  }
}

class SqliteDb implements Db {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
  }

  prepare(sql: string): Statement {
    return new SqliteStatement(this.db.prepare(sql))
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql)
  }

  getRawDb(): Database.Database {
    return this.db
  }
}

class PgStatement implements Statement {
  private pool: pg.Pool
  private sql: string

  constructor(pool: pg.Pool, sql: string) {
    this.pool = pool
    this.sql = convertPlaceholders(convertSqlForPg(sql))
  }

  async get(...params: any[]): Promise<any> {
    const result = await this.pool.query(this.sql, params)
    return result.rows[0]
  }

  async all(...params: any[]): Promise<any[]> {
    const result = await this.pool.query(this.sql, params)
    return result.rows
  }

  async run(...params: any[]): Promise<{ lastInsertRowid?: number; changes?: number }> {
    const isInsert = /INSERT/i.test(this.sql)
    let sql = this.sql
    if (isInsert) {
      const tableName = extractTableName(sql)
      if (tableName && ['registrations', 'members', 'class_cancellations'].includes(tableName.toLowerCase())) {
        sql += ' RETURNING id'
      }
    }
    const result = await this.pool.query(sql, params)
    const changes = result.rowCount || 0
    const lastInsertRowid = result.rows[0]?.id
    return { lastInsertRowid, changes }
  }
}

class PgDb implements Db {
  pool: pg.Pool

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ 
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
  }

  prepare(sql: string): Statement {
    return new PgStatement(this.pool, sql)
  }

  async exec(sql: string): Promise<void> {
    const converted = convertDatetimeNow(sql)
    await this.pool.query(converted)
  }
}

export function getDb(): Db {
  if (!dbInstance) {
    if (databaseUrl) {
      dbInstance = new PgDb(databaseUrl)
    } else {
      fs.mkdirSync(dataDir, { recursive: true })
      dbInstance = new SqliteDb(dbPath)
    }
    initPromise = initDb()
  }
  return dbInstance
}

export function waitDbReady(): Promise<void> {
  getDb()
  return initPromise!
}

function isPostgres(): boolean {
  return !!databaseUrl
}

async function initDb() {
  const db = getDb()

  if (isPostgres()) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL,
        class_day VARCHAR(20) NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
        class_date VARCHAR(50),
        source VARCHAR(50) NOT NULL DEFAULT 'CNCC',
        created_at VARCHAR(50) NOT NULL DEFAULT NOW(),
        week_key VARCHAR(20) NOT NULL
      );
    `)

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week ON registrations(week_key)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week_day ON registrations(week_key, class_day)`)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        source VARCHAR(50) NOT NULL DEFAULT 'CNCC'
      );
    `)

    const columnsToAdd = [
      { table: 'registrations', column: 'class_date', type: 'VARCHAR(50)' },
      { table: 'registrations', column: 'source', type: 'VARCHAR(50)', default: "'CNCC'" },
      { table: 'registrations', column: 'check_in_type', type: 'VARCHAR(50)' },
      { table: 'registrations', column: 'check_in_time', type: 'VARCHAR(50)' },
      { table: 'registrations', column: 'reject_reason', type: 'TEXT' },
    ]

    for (const col of columnsToAdd) {
      try {
        const defaultSql = col.default ? ` DEFAULT ${col.default}` : ''
        await db.exec(`ALTER TABLE ${col.table} ADD COLUMN IF NOT EXISTS ${col.column} ${col.type}${defaultSql}`)
      } catch {
      }
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS class_cancellations (
        id SERIAL PRIMARY KEY,
        week_key VARCHAR(20) NOT NULL,
        class_day VARCHAR(20) NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
        reason TEXT NOT NULL,
        created_at VARCHAR(50) NOT NULL DEFAULT NOW(),
        UNIQUE(week_key, class_day)
      );
    `)
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        class_day TEXT NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
        class_date TEXT,
        source TEXT NOT NULL DEFAULT 'CNCC',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        week_key TEXT NOT NULL
      );
    `)

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week ON registrations(week_key)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week_day ON registrations(week_key, class_day)`)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT 'CNCC'
      );
    `)

    const sqliteDb = (db as SqliteDb).getRawDb()
    const alterStatements = [
      'ALTER TABLE registrations ADD COLUMN class_date TEXT',
      'ALTER TABLE registrations ADD COLUMN source TEXT NOT NULL DEFAULT \'CNCC\'',
      'ALTER TABLE registrations ADD COLUMN check_in_type TEXT',
      'ALTER TABLE registrations ADD COLUMN check_in_time TEXT',
      'ALTER TABLE registrations ADD COLUMN reject_reason TEXT',
    ]

    for (const stmt of alterStatements) {
      try {
        sqliteDb.exec(stmt)
      } catch {
      }
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS class_cancellations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_key TEXT NOT NULL,
        class_day TEXT NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(week_key, class_day)
      );
    `)
  }

  await db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
    .run('notification_text', '1.本年网球课报名仅限预约制，不欢迎临时上课。\n2.一般来说，每周一9:00-周二17:00开放报名当周课程，可选周二和周三，为了保证自由度，可多选，为了保证上课质量，每天都名额限制，所以为了让更多人参与，大家尽量单选。\n3.预约后，请在上课时找小组长签到，也可以在主页面最下方发起签到申请。\n4.天气有变，可能会取消课程，请提前关注天气预报。')
  
  await db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
    .run('multi_day_enabled', 'true')
}

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb()
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb()
  await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getBeijingTimeString(): string {
  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)
  return `${beijingTime.getFullYear()}/${String(beijingTime.getMonth() + 1).padStart(2, '0')}/${String(beijingTime.getDate()).padStart(2, '0')} ${String(beijingTime.getHours()).padStart(2, '0')}:${String(beijingTime.getMinutes()).padStart(2, '0')}`
}

export function getWeekKey(date: Date = new Date()): string {
  const now = new Date(date);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function getClassDate(classDay: string, weekKey?: string): string {
  let now = new Date();
  if (weekKey) {
    const [year, weekStr] = weekKey.split('-W');
    const weekNum = parseInt(weekStr, 10);
    const startOfYear = new Date(parseInt(year,10), 0, 1);
    const daysToMonday = startOfYear.getDay() === 1 ? 0 : startOfYear.getDay() === 0 ? -6 : 1 - startOfYear.getDay();
    const firstMonday = new Date(startOfYear);
    firstMonday.setDate(startOfYear.getDate() + daysToMonday + (weekNum -1) *7);
    now = firstMonday;
  }
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000);

  const dayOfWeek = beijingTime.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(beijingTime);
  monday.setDate(monday.getDate() + daysToMonday);

  const target = new Date(monday);
  target.setDate(monday.getDate() + (classDay === 'tuesday' ? 1 : 2));

  return `${target.getFullYear()}/${target.getMonth() + 1}/${target.getDate()}`;
}

export function getWeekDates(weekKey?: string) {
  let now = new Date();
  if (weekKey) {
    const [year, weekStr] = weekKey.split('-W');
    const weekNum = parseInt(weekStr, 10);
    const startOfYear = new Date(parseInt(year,10), 0,1);
    const daysToMonday = startOfYear.getDay() ===1 ?0 : startOfYear.getDay() ===0 ? -6 :1-startOfYear.getDay();
    const firstMonday = new Date(startOfYear);
    firstMonday.setDate(startOfYear.getDate() + daysToMonday + (weekNum -1)*7);
    now = firstMonday;
  }
  const beijingOffset = 8*60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(now.getTime() + (localOffset+beijingOffset)*60*1000);
  const dayOfWeek = beijingTime.getDay();
  const daysToMonday = dayOfWeek === 0 ?-6: 1-dayOfWeek;
  const monday = new Date(beijingTime);
  monday.setDate(monday.getDate() + daysToMonday);

  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate()+1);
  const wednesday = new Date(monday);
  wednesday.setDate(monday.getDate()+2);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() +6);
  const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  const getWeekNumber = (d: Date) => {
    const startYear = new Date(d.getFullYear(), 0,1);
    const days = Math.floor((d.getTime() - startYear.getTime())/(24*60*60*1000));
    return Math.ceil((days + startYear.getDay()+1)/7);
  };
  return {
    year: monday.getFullYear(),
    weekNum: getWeekNumber(monday),
    tuesday: fmt(tuesday),
    wednesday: fmt(wednesday),
    monday: fmt(monday),
    sunday: fmt(sunday)
  };
}

export function isRegistrationOpen(): boolean {
  const now = new Date();
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000);

  const day = beijingTime.getDay()
  const hour = beijingTime.getHours()
  return (day === 1 && hour >= 9) || (day === 2 && hour < 17)
}

export function getNextOpenTime(): string {
  const now = new Date();
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000);

  const day = beijingTime.getDay()
  let daysUntilMonday: number

  if (day === 0) {
    daysUntilMonday = 1
  } else if (day === 1) {
    daysUntilMonday = 0
  } else {
    daysUntilMonday = (8 - day) % 7
  }

  const nextOpen = new Date(beijingTime);
  nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
  nextOpen.setHours(9, 0, 0, 0);

  const result = new Date(nextOpen.getTime() - (localOffset + beijingOffset) * 60 * 1000);
  return result.toISOString();
}

export function getCloseTime(): string {
  const now = new Date();
  const beijingOffset = 8 * 60;
  const localOffset = now.getTimezoneOffset();
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000);

  const day = beijingTime.getDay()
  let daysUntilTuesday: number

  if (day <= 2) {
    daysUntilTuesday = 2 - day
  } else {
    daysUntilTuesday = 9 - day
  }

  const closeDate = new Date(beijingTime);
  closeDate.setDate(closeDate.getDate() + daysUntilTuesday);
  closeDate.setHours(17, 0, 0, 0);

  const result = new Date(closeDate.getTime() - (localOffset + beijingOffset) * 60 * 1000);
  return result.toISOString();
}
