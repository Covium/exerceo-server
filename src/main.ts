import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from '@/app.module';

function corsOrigin(): CorsOptions['origin'] {
  const origin = process.env.CORS_ORIGIN;
  if (!origin || origin === '*') {
    return true;
  }
  const allowed = origin
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return (requestOrigin, callback) => {
    if (!requestOrigin || allowed.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigin(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
