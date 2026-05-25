import { Router, type Request, type Response } from 'express'
import { getDb, getWeekKey, isRegistrationOpen, getNextOpenTime } from '../db.js'

const router = Router()

router.get('/status', (req: Request, res: Response): void => {
  const db = getDb()
  const weekKey = getWeekKey()
  const open = isRegistrationOpen()

  const tuesdayCount = db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, 'tuesday') as { count: number }

  const wednesdayCount = db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, 'wednesday') as { count: number }

  res.json({
    tuesday: tuesdayCount.count,
    wednesday: wednesdayCount.count,
    isOpen: open,
    nextOpenTime: open ? null : getNextOpenTime(),
  })
})

router.post('/register', (req: Request, res: Response): void => {
  const { name, classDay } = req.body

  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: '请输入姓名' })
    return
  }

  if (!['tuesday', 'wednesday'].includes(classDay)) {
    res.status(400).json({ success: false, message: '请选择上课日' })
    return
  }

  if (!isRegistrationOpen()) {
    res.status(403).json({ success: false, message: '报名未开放' })
    return
  }

  const db = getDb()
  const weekKey = getWeekKey()

  const count = db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, classDay) as { count: number }

  if (count.count >= 10) {
    res.status(400).json({ success: false, message: '该上课日名额已满' })
    return
  }

  const result = db.prepare(
    'INSERT INTO registrations (name, phone, class_day, week_key) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), '', classDay, weekKey)

  const registration = db.prepare(
    'SELECT * FROM registrations WHERE id = ?'
  ).get(result.lastInsertRowid) as {
    id: number
    name: string
    phone: string
    class_day: string
    created_at: string
  }

  res.json({
    success: true,
    message: '报名成功',
    registration: {
      id: registration.id,
      name: registration.name,
      classDay: registration.class_day,
      createdAt: registration.created_at,
    },
  })
})

router.get('/registrations', (req: Request, res: Response): void => {
  const week = (req.query.week as string) || getWeekKey()
  const db = getDb()

  const registrations = db.prepare(
    'SELECT * FROM registrations WHERE week_key = ? ORDER BY class_day, created_at'
  ).all(week) as Array<{
    id: number
    name: string
    phone: string
    class_day: string
    created_at: string
    week_key: string
  }>

  res.json({
    registrations: registrations.map(r => ({
      id: r.id,
      name: r.name,
      classDay: r.class_day,
      createdAt: r.created_at,
      weekKey: r.week_key,
    })),
  })
})

router.post('/export-all', (req: Request, res: Response): void => {
  const { password } = req.body
  const exportPassword = process.env.EXPORT_PASSWORD || 'tennis2024'

  if (!password || password !== exportPassword) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  const db = getDb()

  const registrations = db.prepare(
    'SELECT * FROM registrations ORDER BY week_key, class_day, created_at'
  ).all() as Array<{
    name: string
    class_day: string
    created_at: string
    week_key: string
  }>

  const dayMap: Record<string, string> = {
    tuesday: '周二',
    wednesday: '周三',
  }

  const header = '姓名,上课日,报名日期,所属周'
  const rows = registrations.map(r =>
    `${r.name},${dayMap[r.class_day] || r.class_day},${r.created_at},${r.week_key}`
  ).join('\n')

  const bom = '\uFEFF'
  const csv = `${bom}${header}\n${rows}`

  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="tennis-all-registrations-${ts}.csv"`)
  res.send(csv)
})

router.get('/export', (req: Request, res: Response): void => {
  const week = (req.query.week as string) || getWeekKey()
  const db = getDb()

  const registrations = db.prepare(
    'SELECT * FROM registrations WHERE week_key = ? ORDER BY class_day, created_at'
  ).all(week) as Array<{
    name: string
    class_day: string
    created_at: string
  }>

  const dayMap: Record<string, string> = {
    tuesday: '周二',
    wednesday: '周三',
  }

  const header = '姓名,上课日,报名时间'
  const rows = registrations.map(r =>
    `${r.name},${dayMap[r.class_day] || r.class_day},${r.created_at}`
  ).join('\n')

  const bom = '\uFEFF'
  const csv = `${bom}${header}\n${rows}`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="tennis-registrations-${week}.csv"`)
  res.send(csv)
})

export default router