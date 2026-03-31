import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RequestContextMiddleware } from 'src/middlewares/request-context.middleware';
import { RequestContextModule } from 'src/common/context/request-context.module';
import { GenderModule } from 'src/services/gender/gender.module';
import { OutboxCleanupService } from 'src/cron/outbox-cleanup.service';
import { OutboxSubscriberService } from 'src/cron/outbox-subscriber.service';
import { OutboxPublisherService } from 'src/cron/outbox-publisher.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';

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

    //RabbitMQ Audit Service Module
    ClientsModule.registerAsync([
      {
        imports: [ConfigModule],
        inject: [ConfigService],
        name: 'AUDIT_SERVICE',
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL') as string],
            queue: 'audit_queue',
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),

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
    ScheduleModule.forRoot(),
    AuthClientModule,
    RequestContextModule,
    GenderModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuthGuard,
    AllExceptionsFilter,
    OutboxCleanupService,
    OutboxSubscriberService,
    OutboxPublisherService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
