import fs from 'fs'
import path from 'path'

// 轻量 .env 加载（零依赖）：供本地开发使用；Railway 用平台环境变量注入，不受影响
// 注意：本文件必须最先被 import，保证 app.js 模块图求值前环境变量已就位
try {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
    console.log('.env loaded')
  }
} catch {
  // .env 不存在或不可读时静默忽略
}
