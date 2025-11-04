import { NestFactory } from '@nestjs/core';
import { JobsModule } from './jobs.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(JobsModule);
  const config = app.get(ConfigService);
  const port = Number(config.get('JOBS_PORT')) ?? 3002;
  await app.listen(port);
}
bootstrap();
