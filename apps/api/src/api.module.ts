import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { SearchModule } from './modules/search/search.module';
import { QaModule } from './modules/qa/qa.module';
import { GraphModule } from './modules/graph/graph.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        return {
          type: 'postgres',
          url,
          autoLoadEntities: true,
          synchronize: config.get<string>('NODE_ENV') === 'development',
          logging: config.get<string>('NODE_ENV') === 'development',
        };
      },
    }),
    AuthModule,
    DocumentsModule,
    IngestModule,
    SearchModule,
    QaModule,
    GraphModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
