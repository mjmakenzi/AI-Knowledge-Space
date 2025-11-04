import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  const config = app.get(ConfigService);
  const port = Number(config.get('API_PORT')) ?? 3001;
  await app.listen(port);
}
bootstrap();
