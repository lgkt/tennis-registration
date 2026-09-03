// 必须最先加载 .env（ESM import 按声明顺序执行），再初始化 app/db
import './env.js'
import app from './app.js'

const PORT = Number(process.env.PORT) || 3001

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ready on port ${PORT}`)
  console.log(`Local:   http://localhost:${PORT}/`)
})

// 全局兜底：未捕获的 Promise rejection 不再杀进程，仅记录日志
// 防止 pg-pool / 其他异步错误导致容器无限重启
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  console.error('UnhandledRejection (ignored, process kept alive):', msg)
})

// 兜底捕获同步异常，避免进程崩溃
process.on('uncaughtException', (err: Error) => {
  console.error('UncaughtException (ignored, process kept alive):', err.message)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export default app