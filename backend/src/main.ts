import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './shared/response-envelope.interceptor';
import { AppLoggerService } from './shared/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);
  // Match OpenAPI contract prefix: http://localhost:3000/api/v1, exclude root, direct /v1, static, and health routes
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'v1/(.*)', 'v1', 'static/(.*)', 'health', 'api/v1/health'] });
  // Contract-shaped error envelope: {statusCode, message, error}.
  app.useGlobalFilters(new HttpExceptionFilter());
  // Contract-shaped standard envelope: {success, message, data}.
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Parse comma-separated allowed origins (e.g. "http://localhost:5173,http://localhost:5174")
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on http://localhost:${port}/api/v1`);
}
bootstrap();
