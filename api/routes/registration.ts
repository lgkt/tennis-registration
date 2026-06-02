import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { getDb, getWeekKey, isRegistrationOpen, getNextOpenTime, getClassDate, getWeekDates, getSetting, setSetting } from '../db.js'

const router = Router()

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function getMaxOrDefault(key: string, defaultVal: number): number {
  const val = getSetting(key)
  return val ? parseInt(val, 10) || defaultVal : defaultVal
}

router.get('/status', (req: Request, res: Response): void => {
  const db = getDb()
  const weekKey = getWeekKey()
  const open = isRegistrationOpen()
  const forceOpen = getSetting('force_open') === 'true'
  const maxTuesday = getMaxOrDefault('max_tuesday', 10)
  const maxWednesday = getMaxOrDefault('max_wednesday', 10)
  const multiDayEnabled = getSetting('multi_day_enabled') === 'true'
  const weekDates = getWeekDates()
  const notificationText = getSetting('notification_text') || ''

  const tuesdayCount = db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, 'tuesday') as { count: number }

  const wednesdayCount = db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, 'wednesday') as { count: number }

  res.json({
    tuesday: tuesdayCount.count,
    wednesday: wednesdayCount.count,
    maxTuesday,
    maxWednesday,
    multiDayEnabled,
    isOpen: open || forceOpen,
    forceOpen: forceOpen,
    nextOpenTime: (open || forceOpen) ? null : getNextOpenTime(),
    weekDates: weekDates,
    notificationText,
  })
})

router.get('/check-member', (req: Request, res: Response): void => {
  try {
    const name = (req.query.name as string || '').trim()
    const db = getDb()
    const member = db.prepare('SELECT * FROM members WHERE name = ?').get(name) as { name: string; source: string } | undefined

    if (!member) {
      res.json({ isValid: false, message: '您不是网球小组成员，请联系网球小组组长' })
      return
    }

    const weekKey = getWeekKey()
    const existingDays = db.prepare(
      'SELECT class_day FROM registrations WHERE week_key = ? AND name = ?'
    ).all(weekKey, name.trim()) as Array<{ class_day: string }>

    res.json({
      isValid: true,
      message: '您是网球小组成员，请继续报名',
      source: member.source,
      existingRegistrations: existingDays.map(r => ({ classDay: r.class_day })),
    })
  } catch (error) {
    console.error('check-member error:', error)
    res.status(500).json({ isValid: false, message: '校验服务异常，请稍后重试' })
  }
})

router.post('/check-member', (req: Request, res: Response): void => {
  try {
    const name = (req.body.name || '').trim()
    if (!name) {
      res.status(400).json({ isValid: false, message: '请输入姓名' })
      return
    }
    const db = getDb()
    const member = db.prepare('SELECT * FROM members WHERE name = ?').get(name) as { name: string; source: string } | undefined

    if (!member) {
      res.json({ isValid: false, message: '您不是网球小组成员，请联系网球小组组长' })
      return
    }

    const weekKey = getWeekKey()
    const existingDays = db.prepare(
      'SELECT class_day FROM registrations WHERE week_key = ? AND name = ?'
    ).all(weekKey, name.trim()) as Array<{ class_day: string }>

    res.json({
      isValid: true,
      message: '您是网球小组成员，请继续报名',
      source: member.source,
      existingRegistrations: existingDays.map(r => ({ classDay: r.class_day })),
    })
  } catch (error) {
    console.error('check-member error:', error)
    res.status(500).json({ isValid: false, message: '校验服务异常，请稍后重试' })
  }
})

router.post('/registrations/clear', (req: Request, res: Response): void => {
  const { password, scope } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  const db = getDb()
  if (scope === 'week') {
    const weekKey = getWeekKey()
    db.prepare('DELETE FROM registrations WHERE week_key = ?').run(weekKey)
    res.json({ success: true, message: '本周报名记录已清空' })
  } else {
    db.prepare('DELETE FROM registrations').run()
    res.json({ success: true, message: '所有报名记录已清空' })
  }
})

router.post('/register', (req: Request, res: Response): void => {
  const { name, classDay, classDays } = req.body

  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: '请输入姓名' })
    return
  }

  const days = classDays || (classDay ? [classDay] : [])
  if (days.length === 0 || !days.every((d: string) => ['tuesday', 'wednesday'].includes(d))) {
    res.status(400).json({ success: false, message: '请选择上课日' })
    return
  }

  const open = isRegistrationOpen()
  const forceOpen = getSetting('force_open') === 'true'
  if (!open && !forceOpen) {
    res.status(403).json({ success: false, message: '报名未开放' })
    return
  }

  const db = getDb()
  const weekKey = getWeekKey()

  const member = db.prepare('SELECT * FROM members WHERE name = ?').get(name.trim()) as { name: string; source: string } | undefined
  if (!member) {
    res.status(403).json({ success: false, message: '您不是网球小组成员，请联系网球小组组长' })
    return
  }

  const maxTuesday = getMaxOrDefault('max_tuesday', 10)
  const maxWednesday = getMaxOrDefault('max_wednesday', 10)

  const multiDayEnabled = getSetting('multi_day_enabled') === 'true'
  if (!multiDayEnabled && days.length > 1) {
    res.status(400).json({ success: false, message: '当前仅允许单选上课日' })
    return
  }

  if (!multiDayEnabled) {
    const anyExisting = db.prepare(
      'SELECT id, class_day FROM registrations WHERE week_key = ? AND name = ? LIMIT 1'
    ).get(weekKey, name.trim()) as { id: number; class_day: string } | undefined

    if (anyExisting) {
      const existingLabel = anyExisting.class_day === 'tuesday' ? '周二' : '周三'
      const tryingLabel = days[0] === 'tuesday' ? '周二' : '周三'
      res.status(400).json({ success: false, message: `每周仅上一次课，当周已报名${existingLabel}不可再报${tryingLabel}` })
      return
    }
  }

  const results: Array<{ classDay: string; classDate: string; success: boolean; message?: string }> = []

  for (const day of days) {
    const existing = db.prepare(
      'SELECT id FROM registrations WHERE week_key = ? AND name = ? AND class_day = ? LIMIT 1'
    ).get(weekKey, name.trim(), day) as { id: number } | undefined

    if (existing) {
      const dayLabel = day === 'tuesday' ? '周二' : '周三'
      const dayDate = getClassDate(day, weekKey)
      results.push({ classDay: day, classDate: dayDate, success: false, message: `您当周已报名${dayLabel}（${dayDate}）` })
      continue
    }

    const maxCap = day === 'tuesday' ? maxTuesday : maxWednesday
    const count = db.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
    ).get(weekKey, day) as { count: number }

    if (count.count >= maxCap) {
      results.push({ classDay: day, classDate: '', success: false, message: '该上课日名额已满' })
      continue
    }

    const classDate = getClassDate(day)

    db.prepare(
      'INSERT INTO registrations (name, phone, class_day, class_date, source, week_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name.trim(), '', day, classDate, member.source, weekKey)

    results.push({ classDay: day, classDate, success: true })
  }

  const allSuccess = results.every(r => r.success)
  const anySuccess = results.some(r => r.success)

  if (!anySuccess) {
    res.status(400).json({
      success: false,
      message: results.map(r => r.message).filter(Boolean).join('；'),
      results,
    })
    return
  }

  const successDays = results.filter(r => r.success).map(r => r.classDay)

  res.json({
    success: true,
    message: allSuccess ? '报名成功' : '部分报名成功',
    classDays: successDays,
    results,
  })
})

router.get('/registrations', (req: Request, res: Response): void => {
  const week = (req.query.week as string) || getWeekKey()
  const sourceFilter = (req.query.source as string) || ''
  const sort = (req.query.sort as string) || ''
  const db = getDb()

  let sql = 'SELECT * FROM registrations WHERE week_key = ?'
  const params: any[] = [week]

  if (sourceFilter) {
    sql += ' AND source = ?'
    params.push(sourceFilter)
  }

  sql += ' ORDER BY '
  if (sort === 'source') {
    sql += 'source, class_day, created_at'
  } else {
    sql += 'class_day, created_at'
  }

  const registrations = db.prepare(sql).all(...params) as Array<{
    id: number
    name: string
    phone: string
    class_day: string
    class_date: string
    source: string
    created_at: string
    week_key: string
    check_in_type: string | null
    check_in_time: string | null
  }>

  res.json({
    registrations: registrations.map(r => ({
      id: r.id,
      name: r.name,
      classDay: r.class_day,
      classDate: r.class_date,
      source: r.source,
      createdAt: r.created_at,
      weekKey: r.week_key,
      checkInType: r.check_in_type || null,
      checkInTime: r.check_in_time || null,
    })),
  })
})

router.post('/check-in', (req: Request, res: Response): void => {
  const { password, id } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!id) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as any
  if (!registration) {
    res.status(404).json({ success: false, message: '报名记录不存在' })
    return
  }
  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)
  const timeStr = `${beijingTime.getFullYear()}/${String(beijingTime.getMonth() + 1).padStart(2, '0')}/${String(beijingTime.getDate()).padStart(2, '0')} ${String(beijingTime.getHours()).padStart(2, '0')}:${String(beijingTime.getMinutes()).padStart(2, '0')}`
  db.prepare('UPDATE registrations SET check_in_type = ?, check_in_time = ? WHERE id = ?').run('scheduled', timeStr, id)
  res.json({ success: true, message: '签到成功', checkInTime: timeStr })
})

router.post('/walk-in', (req: Request, res: Response): void => {
  const { password, name, source, classDay } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!name || !name.trim() || !source || !['CNCC', 'CFID', 'SQQ'].includes(source) || !['tuesday', 'wednesday'].includes(classDay)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const weekKey = getWeekKey()
  const classDate = getClassDate(classDay, weekKey)

  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)
  const timeStr = `${beijingTime.getFullYear()}/${String(beijingTime.getMonth() + 1).padStart(2, '0')}/${String(beijingTime.getDate()).padStart(2, '0')} ${String(beijingTime.getHours()).padStart(2, '0')}:${String(beijingTime.getMinutes()).padStart(2, '0')}`

  db.prepare(
    'INSERT INTO registrations (name, phone, class_day, class_date, source, week_key, check_in_type, check_in_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name.trim(), '', classDay, classDate, source, weekKey, 'walkin', timeStr)

  res.json({ success: true, message: '临时签到成功', checkInTime: timeStr })
})

router.post('/reschedule', (req: Request, res: Response): void => {
  const { password, id, newClassDay } = req.body

  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')

  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  if (!id || !newClassDay || !['tuesday', 'wednesday'].includes(newClassDay)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }

  const db = getDb()
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as any
  if (!registration) {
    res.status(404).json({ success: false, message: '报名记录不存在' })
    return
  }

  if (registration.class_day === newClassDay) {
    res.json({ success: true, message: '已为当前时间，无需调整' })
    return
  }

  const maxCap = newClassDay === 'tuesday' ? getMaxOrDefault('max_tuesday', 10) : getMaxOrDefault('max_wednesday', 10)
  const count = db.prepare('SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?').get(registration.week_key, newClassDay) as { count: number }
  if (count.count >= maxCap) {
    res.status(400).json({ success: false, message: '目标时间名额已满' })
    return
  }

  const newClassDate = getClassDate(newClassDay, registration.week_key)
  db.prepare('UPDATE registrations SET class_day = ?, class_date = ? WHERE id = ?').run(newClassDay, newClassDate, id)

  res.json({ success: true, message: '调课成功' })
})

router.get('/members', (req: Request, res: Response): void => {
  const sourceFilter = (req.query.source as string) || ''
  const sort = (req.query.sort as string) || ''
  const db = getDb()

  let sql = 'SELECT * FROM members'
  const params: any[] = []

  if (sourceFilter) {
    sql += ' WHERE source = ?'
    params.push(sourceFilter)
  }

  sql += ' ORDER BY '
  if (sort === 'source') {
    sql += 'source, name'
  } else if (sort === 'name') {
    sql += 'name'
  } else {
    sql += 'id'
  }

  const members = db.prepare(sql).all(...params) as Array<{ id: number; name: string; source: string }>
  res.json({ members: members })
})

router.post('/members/import', (req: Request, res: Response): void => {
  const { password, data } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  const db = getDb()
  const insert = db.prepare('INSERT OR REPLACE INTO members (name, source) VALUES (?, ?)')
  let successCount = 0
  for (const m of data || []) {
    if (m.name && m.source && ['CNCC', 'CFID', 'SQQ'].includes(m.source)) {
      insert.run(m.name.trim(), m.source)
      successCount++
    }
  }

  res.json({ success: true, successCount })
})

router.get('/members/export-template', (req: Request, res: Response): void => {
  const bom = '\uFEFF'
  const header = '姓名,来自'
  const csv = `${bom}${header}\n`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="members-template.csv"`)
  res.send(csv)
})

router.get('/members/export', (req: Request, res: Response): void => {
  const db = getDb()
  const members = db.prepare('SELECT * FROM members ORDER BY id').all() as Array<{ name: string; source: string }>
  const bom = '\uFEFF'
  const header = '姓名,来自'
  const rows = members.map(m => `${m.name},${m.source}`).join('\n')
  const csv = `${bom}${header}\n${rows}`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="members.csv"`)
  res.send(csv)
})

router.post('/members/delete', (req: Request, res: Response): void => {
  const { password, id } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  const db = getDb()
  db.prepare('DELETE FROM members WHERE id = ?').run(id)
  res.json({ success: true })
})

router.post('/members/add', (req: Request, res: Response): void => {
  const { password, name, source } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!name || !name.trim() || !source || !['CNCC', 'CFID', 'SQQ'].includes(source)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const existing = db.prepare('SELECT id FROM members WHERE name = ?').get(name.trim())
  if (existing) {
    res.status(400).json({ success: false, message: '该成员已存在' })
    return
  }
  db.prepare('INSERT INTO members (name, source) VALUES (?, ?)').run(name.trim(), source)
  res.json({ success: true, message: '成员已添加' })
})

router.post('/members/update', (req: Request, res: Response): void => {
  const { password, id, name, source } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!id || !name || !name.trim() || !source || !['CNCC', 'CFID', 'SQQ'].includes(source)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const dup = db.prepare('SELECT id FROM members WHERE name = ? AND id != ?').get(name.trim(), id)
  if (dup) {
    res.status(400).json({ success: false, message: '该姓名已被其他成员使用' })
    return
  }
  db.prepare('UPDATE members SET name = ?, source = ? WHERE id = ?').run(name.trim(), source, id)
  res.json({ success: true, message: '成员已更新' })
})

router.post('/export-all', (req: Request, res: Response): void => {
  const { password } = req.body

  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')

  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  const db = getDb()

  const registrations = db.prepare(
    'SELECT * FROM registrations ORDER BY week_key, class_day, created_at'
  ).all() as Array<{
    name: string
    class_day: string
    class_date: string
    source: string
    created_at: string
    week_key: string
    check_in_type: string | null
    check_in_time: string | null
  }>

  const dayMap: Record<string, string> = {
    tuesday: '周二',
    wednesday: '周三',
  }

  const checkInMap: Record<string, string> = {
    scheduled: '预约签到',
    walkin: '临时签到',
  }

  const header = '姓名,来自,上课日,上课日期,报名日期,所属周,签到类型,签到时间'
  const rows = registrations.map(r =>
    `${r.name},${r.source},${dayMap[r.class_day] || r.class_day},${r.class_date || ''},${r.created_at},${r.week_key},${checkInMap[r.check_in_type || ''] || ''},${r.check_in_time || ''}`
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
    class_date: string
    source: string
    created_at: string
    check_in_type: string | null
    check_in_time: string | null
  }>

  const dayMap: Record<string, string> = {
    tuesday: '周二',
    wednesday: '周三',
  }

  const checkInMap: Record<string, string> = {
    scheduled: '预约签到',
    walkin: '临时签到',
  }

  const header = '姓名,来自,上课日,上课日期,报名时间,签到类型,签到时间'
  const rows = registrations.map(r =>
    `${r.name},${r.source},${dayMap[r.class_day] || r.class_day},${r.class_date || ''},${r.created_at},${checkInMap[r.check_in_type || ''] || ''},${r.check_in_time || ''}`
  ).join('\n')

  const bom = '\uFEFF'
  const csv = `${bom}${header}\n${rows}`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="tennis-registrations-${week}.csv"`)
  res.send(csv)
})

router.get('/statistics', (req: Request, res: Response): void => {
  const year = (req.query.year as string) || new Date().getFullYear().toString()
  const checkInFilter = (req.query.checkInType as string) || ''
  const sortBy = (req.query.sortBy as string) || ''
  const db = getDb()

  const allowedSort = ['source', 'tuesday', 'wednesday', 'total']
  let orderClause = 'total_count DESC, m.name'
  if (sortBy === 'source') orderClause = 'm.source ASC, m.name'
  else if (sortBy === 'tuesday') orderClause = 'tuesday_count DESC, m.name'
  else if (sortBy === 'wednesday') orderClause = 'wednesday_count DESC, m.name'

  const data = db.prepare(`
    SELECT m.name, m.source,
      COALESCE(r.total_count, 0) as total_count,
      COALESCE(r.tuesday_count, 0) as tuesday_count,
      COALESCE(r.wednesday_count, 0) as wednesday_count
    FROM members m
    LEFT JOIN (
      SELECT name,
        COUNT(*) as total_count,
        SUM(CASE WHEN class_day = 'tuesday' THEN 1 ELSE 0 END) as tuesday_count,
        SUM(CASE WHEN class_day = 'wednesday' THEN 1 ELSE 0 END) as wednesday_count
      FROM registrations
      WHERE week_key LIKE ?
        AND (
          ? = ''
          OR (check_in_type = ?)
          OR (? = 'booked' AND (check_in_type IS NULL OR check_in_type = 'scheduled'))
        )
      GROUP BY name
    ) r ON m.name = r.name
    ORDER BY ${orderClause}
  `).all(`${year}%`, checkInFilter, checkInFilter, checkInFilter)

  res.json({ year, data })
})

router.post('/auth-admin', (req: Request, res: Response): void => {
  const { password } = req.body

  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')

  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  res.json({ success: true })
})

router.get('/settings', (req: Request, res: Response): void => {
  const forceOpen = getSetting('force_open') === 'true'
  const maxTuesday = getMaxOrDefault('max_tuesday', 10)
  const maxWednesday = getMaxOrDefault('max_wednesday', 10)
  const multiDayEnabled = getSetting('multi_day_enabled') === 'true'
  const notificationText = getSetting('notification_text') || ''
  res.json({ forceOpen, maxTuesday, maxWednesday, multiDayEnabled, notificationText })
})

router.post('/settings', (req: Request, res: Response): void => {
  const { key, value } = req.body

  if (!key) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }

  setSetting(key, String(value))
  res.json({ success: true, key, value: String(value) })
})

export default router