import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

app.enableCors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ];

    // Permite cualquier subdominio de vercel.app de tu proyecto
    const isVercelPreview = origin?.endsWith('.vercel.app');

    if (!origin || allowed.includes(origin) || isVercelPreview) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);  // Railway inyecta PORT
}

bootstrap();