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
  app.setGlobalPrefix('api/v1', { exclude: ['/', 'v1/(.*)', 'v1'] });
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
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api/v1`);
}
bootstrap();
