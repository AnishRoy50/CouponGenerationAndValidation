import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { requestLogger } from './middleware/logger.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import couponRoutes, { getValidationLogService } from './routes/coupon.routes';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Welcome endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'Coupon Generation and Validation System',
    version: '1.0.0',
    status: 'operational',
    documentation: {
      endpoints: '/api/coupons',
      health: '/health',
    },
    availableRoutes: [
      'POST /api/coupons/user-specific - Create user-specific coupon',
      'POST /api/coupons/time-specific - Create time-specific coupon',
      'POST /api/coupons/validate - Validate and apply coupon',
      'GET /api/coupons/:code - Get coupon by code',
      'GET /api/coupons/user/:userId - Get user coupons',
      'GET /api/coupons/active/time-specific - Get active time-specific coupons',
    ],
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  const logService = getValidationLogService();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    validationLogQueueSize: logService.getQueueSize(),
  });
});

// API routes
app.use('/api/coupons', couponRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);




// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(` Coupon System API is running!`);
  logger.info(` URL: http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  const logService = getValidationLogService();
  await logService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  const logService = getValidationLogService();
  await logService.shutdown();
  process.exit(0);
});

export default app;
