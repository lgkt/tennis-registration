import Database from 'better-sqlite3'
import pg from 'pg'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { encryptField, fieldHash, isEncryptionEnabled } from './crypto.js'

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
let initRejected = false

const tableConflictColumns: Record<string, string[]> = {
  settings: ['key'],
  // 加密后 name 是随机密文，唯一性由 name_hash 保证
  members: ['name_hash'],
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

  // 查询级重试：遇到 57P03（数据库启动中）或连接错误时自动等待重试，避免单次查询失败导致 500 或进程崩溃
  private async queryWithRetry<T>(fn: () => Promise<T>, maxRetries = 5, baseDelay = 800): Promise<T> {
    let lastError: unknown
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        const msg = err instanceof Error ? err.message : String(err)
        // 57P03: 数据库启动中；连接类错误也重试
        const shouldRetry = msg.includes('the database system is starting up')
          || msg.includes('Connection terminated')
          || msg.includes('ECONNRESET')
          || msg.includes('connect ECONNREFUSED')
          || msg.includes('timeout')
        if (shouldRetry && i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, baseDelay * (i + 1)))
          continue
        }
        throw err
      }
    }
    throw lastError
  }

  async get(...params: any[]): Promise<any> {
    return this.queryWithRetry(async () => {
      const result = await this.pool.query(this.sql, params)
      return result.rows[0]
    })
  }

  async all(...params: any[]): Promise<any[]> {
    return this.queryWithRetry(async () => {
      const result = await this.pool.query(this.sql, params)
      return result.rows
    })
  }

  async run(...params: any[]): Promise<{ lastInsertRowid?: number; changes?: number }> {
    return this.queryWithRetry(async () => {
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
    })
  }
}

class PgDb implements Db {
  pool: pg.Pool

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // 连接池配置：提高容错性
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    // 关键：pg-pool 在空闲连接被服务端关闭时会抛 'error' 事件
    // 如果没有监听器，Node 会将其作为 unhandledError 杀掉进程
    this.pool.on('error', (err: Error) => {
      console.error('PG pool idle connection error (ignored):', err.message)
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
  // 如果上一次初始化失败了，重置状态允许下次请求重新初始化（dbInstance 保留，pool 仍可复用）
  if (initPromise && initRejected) {
    initRejected = false
    initPromise = initDb()
  }
  getDb()
  return initPromise!
}

function isPostgres(): boolean {
  return !!databaseUrl
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 10, delay: number = 1000): Promise<T> {
  let lastError: Error | undefined
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (lastError.message.includes('the database system is starting up')) {
        console.log(`Database still starting up, retry ${i + 1}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
      } else {
        throw lastError
      }
    }
  }
  throw lastError || new Error('Database initialization failed after retries')
}

async function initDb() {
  const db = getDb()

  if (isPostgres()) {
    try {
      await retryWithBackoff(async () => {
        await db.exec('SELECT 1')
      })

    await db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        name_hash VARCHAR(64),
        phone VARCHAR(255) NOT NULL,
        phone_hash VARCHAR(64),
        class_day VARCHAR(20) NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
        class_date VARCHAR(50),
        source VARCHAR(50) NOT NULL DEFAULT '1',
        created_at VARCHAR(50) NOT NULL DEFAULT NOW(),
        week_key VARCHAR(20) NOT NULL
      );
    `)

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week ON registrations(week_key)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week_day ON registrations(week_key, class_day)`)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        name_hash VARCHAR(64),
        source VARCHAR(50) NOT NULL DEFAULT '1'
      );
    `)

    const columnsToAdd = [
      { table: 'registrations', column: 'class_date', type: 'VARCHAR(50)' },
      { table: 'registrations', column: 'source', type: 'VARCHAR(50)', default: "'1'" },
      { table: 'registrations', column: 'check_in_type', type: 'VARCHAR(50)' },
      { table: 'registrations', column: 'check_in_time', type: 'VARCHAR(50)' },
      { table: 'registrations', column: 'reject_reason', type: 'TEXT' },
      { table: 'registrations', column: 'name_hash', type: 'VARCHAR(64)' },
      { table: 'registrations', column: 'phone_hash', type: 'VARCHAR(64)' },
      { table: 'members', column: 'name_hash', type: 'VARCHAR(64)' },
    ]

    for (const col of columnsToAdd) {
      try {
        const defaultSql = col.default ? ` DEFAULT ${col.default}` : ''
        await db.exec(`ALTER TABLE ${col.table} ADD COLUMN IF NOT EXISTS ${col.column} ${col.type}${defaultSql}`)
      } catch {
      }
    }

    // 加密支持：hash 查询列索引；members 唯一性从 name 迁移到 name_hash（加密后同一明文密文随机，name 上的 UNIQUE 失去意义）
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_name_hash ON registrations(name_hash)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_phone_hash ON registrations(phone_hash)`)
    try {
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_name_hash_unique ON members(name_hash)`)
    } catch (e) {
      console.error('创建 members(name_hash) 唯一索引失败（可能存在历史重名数据）', e)
    }
    try {
      const uniqConstraints = await db.prepare(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'members'::regclass AND contype = 'u'`).all() as any[]
      for (const c of uniqConstraints) {
        if (c?.conname && typeof c.def === 'string' && /\(\s*name\s*\)/i.test(c.def)) {
          await db.exec(`ALTER TABLE members DROP CONSTRAINT IF EXISTS "${c.conname}"`)
          console.log(`已删除 members 旧唯一约束 ${c.conname}（唯一性改由 name_hash 保证）`)
        }
      }
    } catch (e) {
      console.error('清理 members.name 旧唯一约束失败', e)
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
    } catch (err) {
      initRejected = true
      throw err
    }
  } else {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_hash TEXT,
        phone TEXT NOT NULL,
        phone_hash TEXT,
        class_day TEXT NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
        class_date TEXT,
        source TEXT NOT NULL DEFAULT '1',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        week_key TEXT NOT NULL
      );
    `)

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week ON registrations(week_key)`)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_week_day ON registrations(week_key, class_day)`)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_hash TEXT,
        source TEXT NOT NULL DEFAULT '1'
      );
    `)

    const sqliteDb = (db as SqliteDb).getRawDb()
    const alterStatements = [
      'ALTER TABLE registrations ADD COLUMN class_date TEXT',
      'ALTER TABLE registrations ADD COLUMN source TEXT NOT NULL DEFAULT \'1\'',
      'ALTER TABLE registrations ADD COLUMN check_in_type TEXT',
      'ALTER TABLE registrations ADD COLUMN check_in_time TEXT',
      'ALTER TABLE registrations ADD COLUMN reject_reason TEXT',
      'ALTER TABLE registrations ADD COLUMN name_hash TEXT',
      'ALTER TABLE registrations ADD COLUMN phone_hash TEXT',
      'ALTER TABLE members ADD COLUMN name_hash TEXT',
    ]

    for (const stmt of alterStatements) {
      try {
        sqliteDb.exec(stmt)
      } catch {
      }
    }

    // 旧库迁移：members 若带 name UNIQUE 表级约束，SQLite 无法直接删除，需重建表
    try {
      const membersTableSql = sqliteDb.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'members'`).get() as { sql?: string } | undefined
      if (membersTableSql?.sql && /name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(membersTableSql.sql)) {
        sqliteDb.exec(`DROP TABLE IF EXISTS members_new`)
        sqliteDb.exec(`
          CREATE TABLE members_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            name_hash TEXT,
            source TEXT NOT NULL DEFAULT '1'
          );
        `)
        sqliteDb.exec(`INSERT INTO members_new (id, name, name_hash, source) SELECT id, name, name_hash, source FROM members`)
        sqliteDb.exec(`DROP TABLE members`)
        sqliteDb.exec(`ALTER TABLE members_new RENAME TO members`)
        console.log('members 表已重建：唯一性约束从 name 迁移到 name_hash')
      }
    } catch (e) {
      console.error('members 表重建失败', e)
    }

    sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_name_hash ON registrations(name_hash)`)
    sqliteDb.exec(`CREATE INDEX IF NOT EXISTS idx_registrations_phone_hash ON registrations(phone_hash)`)
    try {
      sqliteDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_name_hash_unique ON members(name_hash)`)
    } catch (e) {
      console.error('创建 members(name_hash) 唯一索引失败（可能存在历史重名数据）', e)
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

  if (isPostgres()) {
    for (const stmt of [
      `ALTER TABLE registrations ALTER COLUMN source SET DEFAULT '1'`,
      `ALTER TABLE members ALTER COLUMN source SET DEFAULT '1'`,
    ]) {
      try {
        await db.exec(stmt)
      } catch {
      }
    }
  }

  // 姓名加密迁移（幂等，每次启动执行）：
  // 1) 先补齐 name_hash/phone_hash（无论是否配置密钥，查询与去重都依赖 hash 列）
  // 2) 配置了 NAME_ENCRYPTION_KEY 时，把存量明文加密为 enc:v1: 格式；未配置时保持明文（兼容模式）
  try {
    if (isEncryptionEnabled()) {
      const plainRegs = await db.prepare(`SELECT id, name, phone FROM registrations WHERE name NOT LIKE 'enc:v1:%'`).all() as any[]
      let regCount = 0
      for (const row of plainRegs) {
        try {
          await db.prepare(`UPDATE registrations SET name = ?, name_hash = ?, phone = ?, phone_hash = ? WHERE id = ?`)
            .run(encryptField(row.name), fieldHash(row.name), encryptField(row.phone), fieldHash(row.phone), row.id)
          regCount++
        } catch (e) {
          console.error(`registrations 加密迁移失败 id=${row.id}`, e)
        }
      }
      const plainMembers = await db.prepare(`SELECT id, name FROM members WHERE name NOT LIKE 'enc:v1:%'`).all() as any[]
      let memberCount = 0
      for (const row of plainMembers) {
        try {
          await db.prepare(`UPDATE members SET name = ?, name_hash = ? WHERE id = ?`).run(encryptField(row.name), fieldHash(row.name), row.id)
          memberCount++
        } catch (e) {
          console.error(`members 加密迁移失败 id=${row.id}`, e)
        }
      }
      if (regCount > 0 || memberCount > 0) {
        console.log(`姓名加密迁移完成：registrations ${regCount} 行，members ${memberCount} 行`)
      }
    } else {
      const noHashRegs = await db.prepare(`SELECT id, name, phone FROM registrations WHERE name_hash IS NULL AND name NOT LIKE 'enc:v1:%'`).all() as any[]
      for (const row of noHashRegs) {
        const nHash = fieldHash(row.name)
        if (!nHash) continue
        try {
          await db.prepare(`UPDATE registrations SET name_hash = ?, phone_hash = ? WHERE id = ?`).run(nHash, fieldHash(row.phone), row.id)
        } catch (e) {
          console.error(`registrations hash 回填失败 id=${row.id}`, e)
        }
      }
      const noHashMembers = await db.prepare(`SELECT id, name FROM members WHERE name_hash IS NULL AND name NOT LIKE 'enc:v1:%'`).all() as any[]
      for (const row of noHashMembers) {
        const nHash = fieldHash(row.name)
        if (!nHash) continue
        try {
          await db.prepare(`UPDATE members SET name_hash = ? WHERE id = ?`).run(nHash, row.id)
        } catch (e) {
          console.error(`members hash 回填失败 id=${row.id}`, e)
        }
      }
    }
  } catch (e) {
    console.error('数据加密/hash 迁移失败', e)
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
  // 转换为北京时间后再计算周次，避免 UTC 导致周一提前切换
  const beijingOffset = 8 * 60;
  const localOffset = date.getTimezoneOffset();
  const beijingTime = new Date(date.getTime() + (localOffset + beijingOffset) * 60 * 1000);
  const now = new Date(beijingTime);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  // 周一为一周开始，周日归到当前周（旧算法把周日算到下一周）
  const weekNum = Math.floor((days + (startOfYear.getDay() + 6) % 7) / 7) + 1;
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
