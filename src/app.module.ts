import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from 'src/config/env-validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from 'src/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_HOST'),
        entities: [...entities],
        synchronize: true,
      })
    }),

    TypeOrmModule.forFeature(entities)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
