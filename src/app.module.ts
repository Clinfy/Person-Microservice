import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validate } from 'src/config/env-validation';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from 'src/entities';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { AuthClientModule } from 'src/clients/auth/auth-client.module';

@Module({
  imports: [
    //Config Module
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),

    //TypeOrm Database Module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_HOST'),
        entities: [...entities],
        synchronize: true,
      }),
    }),

    //Winston Logger Module
    WinstonModule.forRoot({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        //new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '5m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '30d',
        }),
      ],
    }),

    TypeOrmModule.forFeature(entities),
    AuthClientModule
  ],
  controllers: [AppController],
  providers: [AppService, AllExceptionsFilter],
})
export class AppModule {}
