import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
const dbPath = path.join(dataDir, 'registrations.db')

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
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      week_key TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_week ON registrations(week_key);
    CREATE INDEX IF NOT EXISTS idx_registrations_week_day ON registrations(week_key, class_day);
  `)
}

export function getWeekKey(date: Date = new Date()): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function isRegistrationOpen(): boolean {
  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)
  return beijingTime.getDay() === 1 && beijingTime.getHours() >= 9
}

export function getNextOpenTime(): string {
  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)

  const dayOfWeek = beijingTime.getDay()
  let daysUntilMonday: number

  if (dayOfWeek === 0) {
    daysUntilMonday = 1
  } else if (dayOfWeek === 1) {
    if (beijingTime.getHours() < 9) {
      daysUntilMonday = 0
    } else {
      daysUntilMonday = 7
    }
  } else {
    daysUntilMonday = 8 - dayOfWeek
  }

  const nextOpen = new Date(beijingTime)
  nextOpen.setDate(nextOpen.getDate() + daysUntilMonday)
  nextOpen.setHours(9, 0, 0, 0)

  const result = new Date(nextOpen.getTime() - (localOffset + beijingOffset) * 60 * 1000)
  return result.toISOString()
}