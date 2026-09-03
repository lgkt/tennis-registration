import crypto from 'crypto'

// 密文格式：enc:v1:<iv_b64>:<data_b64>:<tag_b64>
// 前缀用于区分"已加密/明文"，保证迁移幂等，也便于将来密钥版本轮换
const PREFIX = 'enc:v1:'

// 任意长度密钥字符串统一派生为 32 字节 AES-256 密钥；未配置时进入明文兼容模式
function getKey(): Buffer | null {
  const raw = process.env.NAME_ENCRYPTION_KEY
  if (!raw || !raw.trim()) return null
  return crypto.createHash('sha256').update(raw.trim()).digest()
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

// 明文 → 密文（AES-256-GCM，随机 IV）；未配置密钥或空值时原样返回
export function encryptField(plain: string | null | undefined): string {
  const value = (plain ?? '').trim()
  const key = getKey()
  if (!key || !value || isEncrypted(value)) return value
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`
}

// 密文 → 明文；非密文原样返回（兼容旧明文数据）；密钥缺失/不匹配时返回占位符，避免接口 500
export function decryptField(value: string | null | undefined): string {
  if (!value) return ''
  if (!isEncrypted(value)) return value
  const key = getKey()
  if (!key) {
    console.error('decryptField: NAME_ENCRYPTION_KEY 未配置，无法解密')
    return '（解密失败）'
  }
  try {
    const [ivB64, dataB64, tagB64] = value.slice(PREFIX.length).split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch (err) {
    console.error('decryptField: 解密失败（密钥不匹配或数据损坏）', err)
    return '（解密失败）'
  }
}

// 明文 → 确定性 SHA-256 hash，用于等值查询与唯一约束（不依赖密钥，明文/密文模式行为一致）
// 随机 IV 加密导致同一姓名密文不同，无法直接按密文查询，必须走 hash
export function fieldHash(plain: string | null | undefined): string | null {
  const value = (plain ?? '').trim()
  if (!value || isEncrypted(value)) return null
  return crypto.createHash('sha256').update(value.toUpperCase()).digest('hex')
}
