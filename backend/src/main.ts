import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './shared/response-envelope.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Match OpenAPI contract prefix: http://localhost:3000/api/v1, exclude root and direct /v1 OpenAI routes
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'v1/(.*)', 'v1', 'static/(.*)'] });
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
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api/v1`);
}
bootstrap();
