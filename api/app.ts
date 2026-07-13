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

app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await waitDbReady()
    next()
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database initialization failed' })
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

app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

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