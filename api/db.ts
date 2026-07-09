import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const dbPath = process.env.DB_PATH || path.join(dataDir, 'registrations.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(dataDir, { recursive: true })
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initDb()
  }
  return db
}

function initDb() {
  db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_registrations_week ON registrations(week_key);
    CREATE INDEX IF NOT EXISTS idx_registrations_week_day ON registrations(week_key, class_day);

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'CNCC'
    );
  `)

  try {
    db.exec('ALTER TABLE registrations ADD COLUMN class_date TEXT')
  } catch {
  }

  try {
    db.exec('ALTER TABLE registrations ADD COLUMN source TEXT NOT NULL DEFAULT \'CNCC\'')
  } catch {
  }

  try {
    db.exec('ALTER TABLE registrations ADD COLUMN class_date TEXT')
  } catch {
  }

  try {
    db.exec('ALTER TABLE registrations ADD COLUMN check_in_type TEXT')
  } catch {
  }

  try {
    db.exec('ALTER TABLE registrations ADD COLUMN check_in_time TEXT')
  } catch {
  }

  try {
    db.exec('ALTER TABLE registrations ADD COLUMN reject_reason TEXT')
  } catch {
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS class_cancellations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_key TEXT NOT NULL,
      class_day TEXT NOT NULL CHECK(class_day IN ('tuesday', 'wednesday')),
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(week_key, class_day)
    );
  `)

  // Default settings
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
    .run('notification_text', '1.本年网球课报名仅限预约制，不欢迎临时上课。\n2.一般来说，每周一9:00-周二17:00开放报名当周课程，可选周二和周三，为了保证自由度，可多选，为了保证上课质量，每天都名额限制，所以为了让更多人参与，大家尽量单选。\n3.预约后，请在上课时找小组长签到，也可以在主页面最下方发起签到申请。\n4.天气有变，可能会取消课程，请提前关注天气预报。')
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`)
    .run('multi_day_enabled', 'true')
}

export function getSetting(key: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
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
  // Open: Monday 9:00 ~ Tuesday 17:00 Beijing time
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
