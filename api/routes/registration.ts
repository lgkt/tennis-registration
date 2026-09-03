import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { getDb, getWeekKey, isRegistrationOpen, getNextOpenTime, getCloseTime, getClassDate, getWeekDates, getSetting, setSetting, getBeijingTimeString } from '../db.js'
import { encryptField, decryptField, fieldHash } from '../crypto.js'

const router = Router()

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function getMaxOrDefault(key: string, defaultVal: number): Promise<number> {
  const val = await getSetting(key)
  return val ? parseInt(val, 10) || defaultVal : defaultVal
}

router.get('/status', async (req: Request, res: Response): Promise<void> => {
  const db = getDb()
  const weekKey = getWeekKey()
  const open = isRegistrationOpen()
  const forceOpen = (await getSetting('force_open')) === 'true'
  const forceOpenReason = (await getSetting('force_open_reason')) || ''
  const forceClose = (await getSetting('force_close')) === 'true'
  const forceCloseReason = (await getSetting('force_close_reason')) || ''
  const maxTuesday = await getMaxOrDefault('max_tuesday', 10)
  const maxWednesday = await getMaxOrDefault('max_wednesday', 10)
  const multiDayEnabled = (await getSetting('multi_day_enabled')) === 'true'
  const weekDates = getWeekDates()
  const notificationText = (await getSetting('notification_text')) || ''

  const tuesdayCount = await db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, 'tuesday') as { count: number }

  const wednesdayCount = await db.prepare(
    'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
  ).get(weekKey, 'wednesday') as { count: number }

  const cancellations = await db.prepare(
    'SELECT class_day, reason FROM class_cancellations WHERE week_key = ?'
  ).all(weekKey) as Array<{ class_day: string; reason: string }>

  const isActuallyOpen = (open || forceOpen) && !forceClose

  res.json({
    tuesday: tuesdayCount.count,
    wednesday: wednesdayCount.count,
    maxTuesday,
    maxWednesday,
    multiDayEnabled,
    isOpen: isActuallyOpen,
    forceOpen: forceOpen,
    forceOpenReason,
    forceClose,
    forceCloseReason,
    nextOpenTime: isActuallyOpen ? null : getNextOpenTime(),
    closeTime: getCloseTime(),
    weekDates: weekDates,
    notificationText,
    cancellations: cancellations.reduce((acc: Record<string, string>, c) => {
      acc[c.class_day] = c.reason
      return acc
    }, {}),
  })
})

router.get('/weeks', async (req: Request, res: Response): Promise<void> => {
  const db = getDb()
  const weeks = await db.prepare(
    "SELECT DISTINCT week_key FROM registrations ORDER BY week_key"
  ).all() as Array<{ week_key: string }>
  res.json({ weeks: weeks.map(w => w.week_key) })
})

router.get('/check-member', async (req: Request, res: Response): Promise<void> => {
  try {
    const name = (req.query.name as string || '').trim()
    const db = getDb()
    // name 已加密存储，按确定性 name_hash 查询
    const member = await db.prepare('SELECT * FROM members WHERE name_hash = ?').get(fieldHash(name.trim())) as { name: string; source: string } | undefined

    if (!member) {
      res.json({ isValid: false, message: '您不是网球小组成员，请联系网球小组组长' })
      return
    }

    const weekKey = getWeekKey()
    const existingDays = await db.prepare(
      'SELECT class_day FROM registrations WHERE week_key = ? AND name_hash = ?'
    ).all(weekKey, fieldHash(name)) as Array<{ class_day: string }>

    res.json({
      isValid: true,
      message: '您是网球小组成员，请继续报名或签到',
      source: member.source,
      existingRegistrations: existingDays.map(r => ({ classDay: r.class_day })),
    })
  } catch (error) {
    console.error('check-member error:', error)
    res.status(500).json({ isValid: false, message: '校验服务异常，请稍后重试' })
  }
})

router.post('/check-member', async (req: Request, res: Response): Promise<void> => {
  try {
    const name = (req.body.name || '').trim()
    if (!name) {
      res.status(400).json({ isValid: false, message: '请输入姓名' })
      return
    }
    const db = getDb()
    // name 已加密存储，按确定性 name_hash 查询
    const member = await db.prepare('SELECT * FROM members WHERE name_hash = ?').get(fieldHash(name.trim())) as { name: string; source: string } | undefined

    if (!member) {
      res.json({ isValid: false, message: '您不是网球小组成员，请联系网球小组组长' })
      return
    }

    const weekKey = getWeekKey()
    const existingDays = await db.prepare(
      'SELECT class_day FROM registrations WHERE week_key = ? AND name_hash = ?'
    ).all(weekKey, fieldHash(name)) as Array<{ class_day: string }>

    res.json({
      isValid: true,
      message: '您是网球小组成员，请继续报名或签到',
      source: member.source,
      existingRegistrations: existingDays.map(r => ({ classDay: r.class_day })),
    })
  } catch (error) {
    console.error('check-member error:', error)
    res.status(500).json({ isValid: false, message: '校验服务异常，请稍后重试' })
  }
})

router.post('/registrations/clear', async (req: Request, res: Response): Promise<void> => {
  const { password, scope } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  const db = getDb()
  if (scope === 'week') {
    const weekKey = getWeekKey()
    await db.prepare('DELETE FROM registrations WHERE week_key = ?').run(weekKey)
    res.json({ success: true, message: '本周报名记录已清空' })
  } else {
    await db.prepare('DELETE FROM registrations').run()
    res.json({ success: true, message: '所有报名记录已清空' })
  }
})

router.post('/register', async (req: Request, res: Response): Promise<void> => {
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
  const forceOpen = (await getSetting('force_open')) === 'true'
  const forceClose = (await getSetting('force_close')) === 'true'
  if (forceClose || (!open && !forceOpen)) {
    const reason = (await getSetting('force_close_reason')) || '报名暂未开放'
    res.status(403).json({ success: false, message: reason })
    return
  }

  const db = getDb()
  const weekKey = getWeekKey()

  // name 已加密存储，按确定性 name_hash 查询
  const member = await db.prepare('SELECT * FROM members WHERE name_hash = ?').get(fieldHash(name.trim())) as { name: string; source: string } | undefined
  if (!member) {
    res.status(403).json({ success: false, message: '您不是网球小组成员，请联系网球小组组长' })
    return
  }

  const maxTuesday = await getMaxOrDefault('max_tuesday', 10)
  const maxWednesday = await getMaxOrDefault('max_wednesday', 10)

  const multiDayEnabled = (await getSetting('multi_day_enabled')) === 'true'
  if (!multiDayEnabled && days.length > 1) {
    res.status(400).json({ success: false, message: '当前仅允许单选上课日' })
    return
  }

  if (!multiDayEnabled) {
    const anyExisting = await db.prepare(
      'SELECT id, class_day FROM registrations WHERE week_key = ? AND name_hash = ? LIMIT 1'
    ).get(weekKey, fieldHash(name.trim())) as { id: number; class_day: string } | undefined

    if (anyExisting) {
      const existingLabel = anyExisting.class_day === 'tuesday' ? '周二' : '周三'
      const tryingLabel = days[0] === 'tuesday' ? '周二' : '周三'
      res.status(400).json({ success: false, message: `每周仅上一次课，当周已报名${existingLabel}不可再报${tryingLabel}` })
      return
    }
  }

  const results: Array<{ classDay: string; classDate: string; success: boolean; message?: string }> = []

  for (const day of days) {
    const existing = await db.prepare(
      'SELECT id FROM registrations WHERE week_key = ? AND name_hash = ? AND class_day = ? LIMIT 1'
    ).get(weekKey, fieldHash(name.trim()), day) as { id: number } | undefined

    if (existing) {
      const dayLabel = day === 'tuesday' ? '周二' : '周三'
      const dayDate = getClassDate(day, weekKey)
      results.push({ classDay: day, classDate: dayDate, success: false, message: `您当周已报名${dayLabel}（${dayDate}）` })
      continue
    }

    const maxCap = day === 'tuesday' ? maxTuesday : maxWednesday
    const count = await db.prepare(
      'SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?'
    ).get(weekKey, day) as { count: number }

    if (count.count >= maxCap) {
      results.push({ classDay: day, classDate: '', success: false, message: '该上课日名额已满' })
      continue
    }

    const classDate = getClassDate(day)

    await db.prepare(
      'INSERT INTO registrations (name, name_hash, phone, phone_hash, class_day, class_date, source, week_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(encryptField(name.trim()), fieldHash(name.trim()), '', fieldHash(''), day, classDate, member.source, weekKey, getBeijingTimeString())

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

router.get('/registrations', async (req: Request, res: Response): Promise<void> => {
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
  } else if (sort === 'class_day') {
    sql += 'class_day, created_at'
  } else if (sort === 'class_date') {
    sql += 'class_date, created_at'
  } else if (sort === 'created_at') {
    sql += 'created_at'
  } else if (sort === 'checkin') {
    sql += 'check_in_type, created_at'
  } else {
    sql += 'class_day, created_at'
  }

  const registrations = await db.prepare(sql).all(...params) as Array<{
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
    reject_reason: string | null
  }>

  const enriched = registrations.map(r => {
    let checkInTypeLabel = ''
    if (r.check_in_type === 'applied') {
      checkInTypeLabel = '申请签到'
    } else if (r.check_in_type === 'applied_scheduled') {
      checkInTypeLabel = '预约签到申请'
    } else if (r.check_in_type === 'applied_walkin') {
      checkInTypeLabel = '临时签到申请'
    } else if (r.check_in_type === 'scheduled') {
      checkInTypeLabel = '已预约签到'
    } else if (r.check_in_type === 'walkin') {
      checkInTypeLabel = '已临时签到'
    } else if (r.check_in_type === 'approved') {
      checkInTypeLabel = '已签到'
    } else if (r.check_in_type === 'rejected') {
      checkInTypeLabel = '已驳回'
    }
    const isWalkIn = r.check_in_type === 'walkin' || r.check_in_type === 'applied_walkin'
    return {
      id: r.id,
      name: decryptField(r.name),
      classDay: r.class_day,
      classDate: r.class_date,
      source: r.source,
      createdAt: isWalkIn ? '' : r.created_at,
      weekKey: r.week_key,
      checkInType: r.check_in_type || null,
      checkInTime: r.check_in_time || null,
      rejectReason: r.reject_reason || null,
      checkInTypeLabel,
    }
  })

  res.json({ registrations: enriched })
})

router.get('/registrations/export-template', (_req: Request, res: Response): void => {
  const bom = '\uFEFF'
  const content = bom + '姓名,手机号,上课日,来源,周次\n张三,13800000000,tuesday,1,2026-W23\n李四,13900000000,wednesday,2,2026-W23\n王五,13700000000,tuesday,3,2026-W23\n赵六,13600000000,wednesday,1,2026-W23'
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=registration_template.csv')
  res.send(content)
})

router.post('/registrations/import', async (req: Request, res: Response): Promise<void> => {
  const { password, content } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!content || !content.trim()) {
    res.status(400).json({ success: false, message: '请提供导入内容' })
    return
  }

  const db = getDb()
  const timeStr = getBeijingTimeString()
  let success = 0
  const errors: string[] = []

  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  const header = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim())

  const idxName = header.findIndex(h => h === '姓名' || h === 'name')
  const idxPhone = header.findIndex(h => h === '手机号' || h === '手机号码' || h === 'phone')
  const idxDay = header.findIndex(h => h === '上课日' || h === 'class_day' || h === 'classDay')
  const idxSource = header.findIndex(h => h === '来源' || h === 'source' || h === '来自')
  const idxWeek = header.findIndex(h => h === '周次' || h === 'week_key' || h === 'weekKey' || h === 'week' || h === '所属周')
  const idxCheckinType = header.findIndex(h => h === '签到类型' || h === 'check_in_type')
  const idxCheckinTime = header.findIndex(h => h === '签到时间' || h === 'check_in_time')
  const idxCreatedAt = header.findIndex(h => h === '报名日期' || h === 'created_at')

  if (idxName < 0 || idxDay < 0) {
    res.status(400).json({ success: false, message: '缺少必需列：姓名、上课日' })
    return
  }

  const checkInMapRev: Record<string, string> = {
    '预约签到': 'scheduled', '临时签到': 'walkin', '申请签到': 'applied',
    '已预约签到': 'scheduled', '已临时签到': 'walkin',
    '预约签到申请': 'applied_scheduled', '临时签到申请': 'applied_walkin',
    '审批通过': 'approved', '审批驳回': 'rejected',
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^\uFEFF/, ''))
    const name = cols[idxName] || ''
    const phone = idxPhone >= 0 ? cols[idxPhone] || '' : ''
    const classDay = cols[idxDay] ? cols[idxDay].toLowerCase() : ''
    const source = idxSource >= 0 ? cols[idxSource] || '' : ''
    const weekKey = idxWeek >= 0 ? cols[idxWeek] || getWeekKey() : getWeekKey()
    const checkInType = idxCheckinType >= 0 && cols[idxCheckinType] ? (checkInMapRev[cols[idxCheckinType]] || cols[idxCheckinType]) : ''
    const checkInTime = idxCheckinTime >= 0 && cols[idxCheckinTime] ? cols[idxCheckinTime] : ''
    const createdAt = idxCreatedAt >= 0 && cols[idxCreatedAt] ? cols[idxCreatedAt] : timeStr

    if (!name) {
      errors.push(`第${i + 1}行：姓名为空`)
      continue
    }
    const dayMap: Record<string, string> = { '周二': 'tuesday', '周三': 'wednesday', 'tuesday': 'tuesday', 'wednesday': 'wednesday' }
    const mappedDay = dayMap[classDay]
    if (!mappedDay) {
      errors.push(`第${i + 1}行：上课日无效（${cols[idxDay] || '空'}），应为 周二/周三 或 tuesday/wednesday`)
      continue
    }

    const member = await db.prepare('SELECT * FROM members WHERE name_hash = ?').get(fieldHash(name)) as any
    if (!member) {
      errors.push(`第${i + 1}行：成员"${name}"不在名单中，跳过`)
      continue
    }

    const finalSource = source || member.source
    const classDate = getClassDate(mappedDay, weekKey)

    const exists = await db.prepare('SELECT id FROM registrations WHERE week_key = ? AND name_hash = ? AND class_day = ?').get(weekKey, fieldHash(name), mappedDay)
    if (exists) {
      await db.prepare('DELETE FROM registrations WHERE id = ?').run((exists as any).id)
      errors.push(`第${i + 1}行："${name}"${mappedDay === 'tuesday' ? '周二' : '周三'}原有记录已覆盖`)
    }

    try {
      // 导入保持明文 CSV 入口，落库时加密（name_hash 保证同人去重/覆盖判断在加密后依然有效）
      const nameHash = fieldHash(name)
      const sql = checkInType
        ? 'INSERT INTO registrations (name, name_hash, phone, phone_hash, class_day, class_date, source, week_key, created_at, check_in_type, check_in_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO registrations (name, name_hash, phone, phone_hash, class_day, class_date, source, week_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      const params = checkInType
        ? [encryptField(name), nameHash, encryptField(phone), fieldHash(phone), mappedDay, classDate, finalSource, weekKey, createdAt, checkInType, checkInTime]
        : [encryptField(name), nameHash, encryptField(phone), fieldHash(phone), mappedDay, classDate, finalSource, weekKey, createdAt]
      await db.prepare(sql).run(...params)
      success++
    } catch (e: any) {
      errors.push(`第${i + 1}行：插入失败 - ${e.message}`)
    }
  }

  res.json({ success: true, imported: success, total: lines.length - 1, errors: errors.slice(0, 50) })
})

router.post('/check-in', async (req: Request, res: Response): Promise<void> => {
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
  const registration = await db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as any
  if (!registration) {
    res.status(404).json({ success: false, message: '报名记录不存在' })
    return
  }
  const timeStr = getBeijingTimeString()
  await db.prepare('UPDATE registrations SET check_in_type = ?, check_in_time = ? WHERE id = ?').run('scheduled', timeStr, id)
  res.json({ success: true, message: '签到成功', checkInTime: timeStr })
})

router.post('/walk-in', async (req: Request, res: Response): Promise<void> => {
  const { password, name, source, classDay } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!name || !name.trim() || !source || !['1', '2', '3'].includes(source) || !['tuesday', 'wednesday'].includes(classDay)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const weekKey = getWeekKey()
  const classDate = getClassDate(classDay, weekKey)
  const timeStr = getBeijingTimeString()

  await db.prepare(
    'INSERT INTO registrations (name, name_hash, phone, phone_hash, class_day, class_date, source, week_key, check_in_type, check_in_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(encryptField(name.trim()), fieldHash(name.trim()), '', fieldHash(''), classDay, classDate, source, weekKey, 'walkin', timeStr)

  res.json({ success: true, message: '临时签到成功', checkInTime: timeStr })
})

router.post('/apply-checkin', async (req: Request, res: Response): Promise<void> => {
  const { name, classDay } = req.body
  if (!name || !name.trim() || !classDay || !['tuesday', 'wednesday'].includes(classDay)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const weekKey = getWeekKey()

  // name 已加密存储，按确定性 name_hash 查询
  const member = await db.prepare('SELECT * FROM members WHERE name_hash = ?').get(fieldHash(name.trim())) as { name: string; source: string } | undefined
  if (!member) {
    res.status(403).json({ success: false, message: '您不是网球小组成员，请联系网球小组组长' })
    return
  }

  const existing = await db.prepare(
    'SELECT id, check_in_type FROM registrations WHERE week_key = ? AND name_hash = ? AND class_day = ? ORDER BY id DESC LIMIT 1'
  ).get(weekKey, fieldHash(name.trim()), classDay) as { id: number; check_in_type: string | null } | undefined

  if (existing) {
    if (existing.check_in_type === 'applied' || existing.check_in_type === 'applied_scheduled' || existing.check_in_type === 'applied_walkin') {
      res.status(400).json({ success: false, message: '您已提交签到申请，请等待审批' })
      return
    }
    if (existing.check_in_type === 'approved' || existing.check_in_type === 'scheduled') {
      res.status(400).json({ success: false, message: '您已签到成功，无需重复申请' })
      return
    }
    if (existing.check_in_type === 'rejected') {
      res.status(400).json({ success: false, message: '您的签到申请已被驳回，请联系管理员' })
      return
    }
    const timeStr = getBeijingTimeString()
    // 有报名记录 → 标记为预约签到申请
    await db.prepare('UPDATE registrations SET check_in_type = ?, check_in_time = ? WHERE id = ?')
      .run('applied_scheduled', timeStr, existing.id)
    res.json({ success: true, message: '签到申请已提交，请等待管理员审批' })
    return
  }

  const classDate = getClassDate(classDay, weekKey)
  const timeStr = getBeijingTimeString()

  // 无报名记录 → 标记为临时签到申请（报名时间留空）
  await db.prepare(
    'INSERT INTO registrations (name, name_hash, phone, phone_hash, class_day, class_date, source, week_key, check_in_type, check_in_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(encryptField(name.trim()), fieldHash(name.trim()), '', fieldHash(''), classDay, classDate, member.source, weekKey, 'applied_walkin', timeStr)

  res.json({ success: true, message: '签到申请已提交，请等待管理员审批' })
})

router.post('/checkin-result', async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body
  if (!name || !name.trim()) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const weekKey = getWeekKey()

  const records = await db.prepare(
    'SELECT class_day, check_in_type, check_in_time, reject_reason FROM registrations WHERE week_key = ? AND name_hash = ? AND check_in_type IS NOT NULL AND check_in_type IN (?, ?, ?, ?, ?, ?) ORDER BY class_day'
  ).all(weekKey, fieldHash(name.trim()), 'applied', 'applied_scheduled', 'applied_walkin', 'approved', 'rejected', 'walkin') as Array<{
    class_day: string
    check_in_type: string
    check_in_time: string | null
    reject_reason: string | null
  }>

  const statusLabelMap: Record<string, string> = {
    applied: '申请签到',
    applied_scheduled: '预约签到申请',
    applied_walkin: '临时签到申请',
    scheduled: '已预约签到',
    walkin: '已临时签到',
    approved: '已签到',
    rejected: '已驳回',
  }

  const results = records.map(r => ({
    classDay: r.class_day,
    status: r.check_in_type,
    statusLabel: statusLabelMap[r.check_in_type] || r.check_in_type,
    checkInTime: r.check_in_time || '',
    rejectReason: r.reject_reason || '',
  }))

  res.json({ results })
})

router.post('/checkin-review', async (req: Request, res: Response): Promise<void> => {
  const { password, registrationId, action, reason } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!registrationId || !action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  if (action === 'reject' && (!reason || !reason.trim())) {
    res.status(400).json({ success: false, message: '请填写驳回原因' })
    return
  }

  const db = getDb()
  const registration = await db.prepare('SELECT * FROM registrations WHERE id = ?').get(registrationId) as any
  if (!registration) {
    res.status(404).json({ success: false, message: '报名记录不存在' })
    return
  }
  if (registration.check_in_type !== 'applied' && registration.check_in_type !== 'applied_scheduled' && registration.check_in_type !== 'applied_walkin') {
    res.status(400).json({ success: false, message: '该记录不在待审批状态' })
    return
  }

  const timeStr = getBeijingTimeString()

  if (action === 'approve') {
    // 根据申请类型直接判断：预约签到申请→scheduled，临时签到申请→walkin
    let approvedType: string
    if (registration.check_in_type === 'applied_scheduled') {
      approvedType = 'scheduled'
    } else if (registration.check_in_type === 'applied_walkin') {
      approvedType = 'walkin'
    } else {
      // 兼容旧的 applied 类型：根据是否有报名记录判断（name 已加密，按 name_hash 匹配）
      const hasScheduled = await db.prepare(
        'SELECT COUNT(*) as cnt FROM registrations WHERE week_key = ? AND name_hash = ? AND class_day = ? AND check_in_type IS NULL'
      ).get(registration.week_key, registration.name_hash, registration.class_day) as { cnt: number }
      approvedType = hasScheduled.cnt > 0 ? 'scheduled' : 'walkin'
    }

    await db.prepare('UPDATE registrations SET check_in_type = ?, check_in_time = ?, reject_reason = NULL WHERE id = ?').run(approvedType, timeStr, registrationId)
    const label = approvedType === 'scheduled' ? '预约签到' : '临时签到'
    res.json({ success: true, message: `签到审批通过（${label}）`, checkInTime: timeStr, checkInType: approvedType })
  } else {
    await db.prepare('UPDATE registrations SET check_in_type = ?, reject_reason = ? WHERE id = ?').run('rejected', reason.trim(), registrationId)
    res.json({ success: true, message: '已驳回签到申请' })
  }
})

router.post('/reschedule', async (req: Request, res: Response): Promise<void> => {
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
  const registration = await db.prepare('SELECT * FROM registrations WHERE id = ?').get(id) as any
  if (!registration) {
    res.status(404).json({ success: false, message: '报名记录不存在' })
    return
  }

  if (registration.class_day === newClassDay) {
    res.json({ success: true, message: '已为当前时间，无需调整' })
    return
  }

  const maxCap = newClassDay === 'tuesday' ? await getMaxOrDefault('max_tuesday', 10) : await getMaxOrDefault('max_wednesday', 10)
  const count = await db.prepare('SELECT COUNT(*) as count FROM registrations WHERE week_key = ? AND class_day = ?').get(registration.week_key, newClassDay) as { count: number }
  if (count.count >= maxCap) {
    res.status(400).json({ success: false, message: '目标时间名额已满' })
    return
  }

  const newClassDate = getClassDate(newClassDay, registration.week_key)
  await db.prepare('UPDATE registrations SET class_day = ?, class_date = ? WHERE id = ?').run(newClassDay, newClassDate, id)

  res.json({ success: true, message: '调课成功' })
})

router.post('/class-cancel', async (req: Request, res: Response): Promise<void> => {
  const { password, classDay, reason } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!classDay || !['tuesday', 'wednesday'].includes(classDay) || !reason || !reason.trim()) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const weekKey = getWeekKey()
  await db.prepare(
    'INSERT OR REPLACE INTO class_cancellations (week_key, class_day, reason, created_at) VALUES (?, ?, ?, ?)'
  ).run(weekKey, classDay, reason.trim(), getBeijingTimeString())
  res.json({ success: true, message: '课程已取消' })
})

router.post('/class-cancel/remove', async (req: Request, res: Response): Promise<void> => {
  const { password, classDay } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!classDay || !['tuesday', 'wednesday'].includes(classDay)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  const weekKey = getWeekKey()
  await db.prepare(
    'DELETE FROM class_cancellations WHERE week_key = ? AND class_day = ?'
  ).run(weekKey, classDay)
  res.json({ success: true, message: '课程取消已恢复' })
})

router.get('/class-cancellations', async (req: Request, res: Response): Promise<void> => {
  const week = (req.query.week as string) || getWeekKey()
  const db = getDb()
  const cancellations = await db.prepare(
    'SELECT class_day, reason, created_at FROM class_cancellations WHERE week_key = ?'
  ).all(week) as Array<{ class_day: string; reason: string; created_at: string }>
  res.json({ cancellations })
})

router.get('/members', async (req: Request, res: Response): Promise<void> => {
  const sourceFilter = (req.query.source as string) || ''
  const sort = (req.query.sort as string) || ''
  const db = getDb()

  let sql = 'SELECT * FROM members'
  const params: any[] = []

  if (sourceFilter) {
    sql += ' WHERE source = ?'
    params.push(sourceFilter)
  }

  sql += ' ORDER BY id'

  // name 已加密存储，SQL 无法按 name 排序，取回后解密再在 JS 中排序
  const members = await db.prepare(sql).all(...params) as Array<{ id: number; name: string; source: string }>
  const decrypted = members.map(m => {
    const name = decryptField(m.name)
    return { id: m.id, name, source: m.source }
  })

  if (sort === 'name') {
    decrypted.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  } else if (sort === 'source') {
    decrypted.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, 'zh'))
  }

  res.json({ members: decrypted })
})

router.post('/members/import', async (req: Request, res: Response): Promise<void> => {
  const { password, data } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  const db = getDb()
  let successCount = 0
  for (const m of data || []) {
    const name = (m.name || '').trim()
    if (name && m.source && ['1', '2', '3'].includes(m.source)) {
      // name 已加密存储，按 name_hash 判重：已存在则更新来源，否则插入（导入保持明文入口，幂等不产生重复行）
      const nameHash = fieldHash(name)
      const existing = await db.prepare('SELECT id FROM members WHERE name_hash = ?').get(nameHash) as { id: number } | undefined
      if (existing) {
        await db.prepare('UPDATE members SET source = ? WHERE id = ?').run(m.source, existing.id)
      } else {
        await db.prepare('INSERT INTO members (name, name_hash, source) VALUES (?, ?, ?)').run(encryptField(name), nameHash, m.source)
      }
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

router.get('/members/export', async (req: Request, res: Response): Promise<void> => {
  const db = getDb()
  const members = await db.prepare('SELECT * FROM members ORDER BY id').all() as Array<{ name: string; source: string }>
  const bom = '\uFEFF'
  const header = '姓名,来自'
  const rows = members.map(m => `${decryptField(m.name)},${m.source}`).join('\n')
  const csv = `${bom}${header}\n${rows}`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="members.csv"`)
  res.send(csv)
})

router.post('/members/delete', async (req: Request, res: Response): Promise<void> => {
  const { password, id } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  const db = getDb()
  await db.prepare('DELETE FROM members WHERE id = ?').run(id)
  res.json({ success: true })
})

router.post('/members/add', async (req: Request, res: Response): Promise<void> => {
  const { password, name, source } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!name || !name.trim() || !source || !['1', '2', '3'].includes(source)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  // name 已加密存储，按 name_hash 判重与写入
  const existing = await db.prepare('SELECT id FROM members WHERE name_hash = ?').get(fieldHash(name.trim()))
  if (existing) {
    res.status(400).json({ success: false, message: '该成员已存在' })
    return
  }
  await db.prepare('INSERT INTO members (name, name_hash, source) VALUES (?, ?, ?)').run(encryptField(name.trim()), fieldHash(name.trim()), source)
  res.json({ success: true, message: '成员已添加' })
})

router.post('/members/update', async (req: Request, res: Response): Promise<void> => {
  const { password, id, name, source } = req.body
  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')
  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }
  if (!id || !name || !name.trim() || !source || !['1', '2', '3'].includes(source)) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }
  const db = getDb()
  // name 已加密存储，按 name_hash 判重与写入
  const dup = await db.prepare('SELECT id FROM members WHERE name_hash = ? AND id != ?').get(fieldHash(name.trim()), id)
  if (dup) {
    res.status(400).json({ success: false, message: '该姓名已被其他成员使用' })
    return
  }
  await db.prepare('UPDATE members SET name = ?, name_hash = ?, source = ? WHERE id = ?').run(encryptField(name.trim()), fieldHash(name.trim()), source, id)
  res.json({ success: true, message: '成员已更新' })
})

router.post('/export-all', async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body

  const storedHash = process.env.EXPORT_PASSWORD_HASH || hashPassword('tEnis2026%')

  if (!password || hashPassword(password) !== storedHash) {
    res.status(403).json({ success: false, message: '口令错误' })
    return
  }

  const db = getDb()

  const registrations = await db.prepare(
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
    scheduled: '已预约签到',
    walkin: '已临时签到',
    applied: '申请签到',
    applied_scheduled: '预约签到申请',
    applied_walkin: '临时签到申请',
    approved: '审批通过',
    rejected: '审批驳回',
  }

  const header = '姓名,来自,上课日,上课日期,报名日期,所属周,签到类型,签到时间'
  const rows = registrations.map(r => {
    const isWalkIn = r.check_in_type === 'walkin' || r.check_in_type === 'applied_walkin'
    return `${decryptField(r.name)},${r.source},${dayMap[r.class_day] || r.class_day},${r.class_date || ''},${isWalkIn ? '' : r.created_at},${r.week_key},${checkInMap[r.check_in_type || ''] || ''},${r.check_in_time || ''}`
  }).join('\n')

  const bom = '\uFEFF'
  const csv = `${bom}${header}\n${rows}`

  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="tennis-all-registrations-${ts}.csv"`)
  res.send(csv)
})

router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const week = (req.query.week as string) || getWeekKey()
  const db = getDb()

  const registrations = await db.prepare(
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
    scheduled: '已预约签到',
    walkin: '已临时签到',
    applied: '申请签到',
    applied_scheduled: '预约签到申请',
    applied_walkin: '临时签到申请',
    approved: '审批通过',
    rejected: '审批驳回',
  }

  const header = '姓名,来自,上课日,上课日期,报名时间,签到类型,签到时间'
  const rows = registrations.map(r => {
    const isWalkIn = r.check_in_type === 'walkin' || r.check_in_type === 'applied_walkin'
    return `${decryptField(r.name)},${r.source},${dayMap[r.class_day] || r.class_day},${r.class_date || ''},${isWalkIn ? '' : r.created_at},${checkInMap[r.check_in_type || ''] || ''},${r.check_in_time || ''}`
  }).join('\n')

  const bom = '\uFEFF'
  const csv = `${bom}${header}\n${rows}`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="tennis-registrations-${week}.csv"`)
  res.send(csv)
})

router.get('/statistics', async (req: Request, res: Response): Promise<void> => {
  const year = (req.query.year as string) || new Date().getFullYear().toString()
  const week = (req.query.week as string) || ''
  const mode = (req.query.mode as string) || 'year'
  const checkInFilter = (req.query.checkInType as string) || ''
  const sortBy = (req.query.sortBy as string) || ''
  const db = getDb()

  const weekCondition = mode === 'week' && week ? 'week_key = ?' : 'week_key LIKE ?'
  const weekParam = mode === 'week' && week ? week : `${year}%`

  // name 已加密，SQL 无法按 name 分组/JOIN/排序：改用 name_hash 分组关联，取回后解密并在 JS 中排序
  const rows = await db.prepare(`
    SELECT m.name, m.source,
      COALESCE(r.total_count, 0) as total_count,
      COALESCE(r.tuesday_count, 0) as tuesday_count,
      COALESCE(r.wednesday_count, 0) as wednesday_count
    FROM members m
    LEFT JOIN (
      SELECT name_hash,
        COUNT(*) as total_count,
        SUM(CASE WHEN class_day = 'tuesday' THEN 1 ELSE 0 END) as tuesday_count,
        SUM(CASE WHEN class_day = 'wednesday' THEN 1 ELSE 0 END) as wednesday_count
      FROM registrations
      WHERE ${weekCondition}
        AND (
          ? = ''
          OR (check_in_type = ?)
          OR (? = 'booked' AND (check_in_type IS NULL OR check_in_type = 'scheduled'))
        )
      GROUP BY name_hash
    ) r ON m.name_hash = r.name_hash
  `).all(weekParam, checkInFilter, checkInFilter, checkInFilter) as Array<{
    name: string
    source: string
    total_count: number
    tuesday_count: number
    wednesday_count: number
  }>

  const data = rows.map(row => ({ ...row, name: decryptField(row.name) }))

  if (sortBy === 'source') {
    data.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, 'zh'))
  } else if (sortBy === 'tuesday') {
    data.sort((a, b) => b.tuesday_count - a.tuesday_count || a.name.localeCompare(b.name, 'zh'))
  } else if (sortBy === 'wednesday') {
    data.sort((a, b) => b.wednesday_count - a.wednesday_count || a.name.localeCompare(b.name, 'zh'))
  } else {
    data.sort((a, b) => b.total_count - a.total_count || a.name.localeCompare(b.name, 'zh'))
  }

  res.json({ mode, year, week: week || '', data })
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

router.get('/settings', async (req: Request, res: Response): Promise<void> => {
  const forceOpen = (await getSetting('force_open')) === 'true'
  const forceOpenReason = (await getSetting('force_open_reason')) || ''
  const forceClose = (await getSetting('force_close')) === 'true'
  const forceCloseReason = (await getSetting('force_close_reason')) || ''
  const maxTuesday = await getMaxOrDefault('max_tuesday', 10)
  const maxWednesday = await getMaxOrDefault('max_wednesday', 10)
  const multiDayEnabled = (await getSetting('multi_day_enabled')) === 'true'
  const notificationText = (await getSetting('notification_text')) || ''
  res.json({ forceOpen, forceOpenReason, forceClose, forceCloseReason, maxTuesday, maxWednesday, multiDayEnabled, notificationText })
})

router.post('/settings', async (req: Request, res: Response): Promise<void> => {
  const { key, value } = req.body

  if (!key) {
    res.status(400).json({ success: false, message: '参数错误' })
    return
  }

  await setSetting(key, String(value))
  res.json({ success: true, key, value: String(value) })
})

export default router
