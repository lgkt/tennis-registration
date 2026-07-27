import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import registrationRoutes from './routes/registration.js'
import { waitDbReady } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * Liveness 探针：只检查进程是否存活，永远返回 200
 * 必须注册在全局 DB 中间件之前，否则 DB 没就绪时会被拦截返回 500
 * Railway healthcheck 应该用这个，避免数据库波动触发容器被杀
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      database: 'unknown',
    })
  },
)

/**
 * Readiness 探针：检查数据库是否就绪，用于判断是否能处理请求
 * 未就绪时返回 503，但不会触发容器重启
 */
app.use(
  '/api/ready',
  async (req: Request, res: Response): Promise<void> => {
    try {
      await waitDbReady()
      res.status(200).json({
        success: true,
        message: 'ready',
        database: 'connected',
      })
    } catch (err) {
      res.status(503).json({
        success: false,
        message: 'database not ready',
        database: 'disconnected',
      })
    }
  },
)

/**
 * 全局中间件：等待数据库就绪后再处理其他请求
 * 注册在 /api/health 和 /api/ready 之后，确保健康检查不被阻塞
 */
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await waitDbReady()
    next()
  } catch (err) {
    console.error('Database initialization error:', err)
    res.status(500).json({ success: false, error: 'Database initialization failed', details: err instanceof Error ? err.message : String(err) })
  }
})

/**
 * Disable caching for all API responses
 */
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
})

/**
 * API Routes
 */
app.use('/api', registrationRoutes)

/**
 * Serve frontend static files with no-cache
 */
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath, {
  setHeaders: (res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  },
}))

/**
 * SPA fallback: serve index.html for all non-API routes
 */
app.get('*', (req: Request, res: Response): void => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ success: false, error: 'API not found' })
    return
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

/**
 * Error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

export default app
