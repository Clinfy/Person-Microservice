import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { useContainer } from 'class-validator';
import { BadRequestException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { findFirstErrorCode, findFirstMessage } from 'src/common/utils/find-erros-data.util';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //Config service for url getter
  const configService = app.get(ConfigService);
  const rabbitMqUrl = configService.get<string>('RABBITMQ_URL');


  if (!rabbitMqUrl) {
    throw new Error('Environment variable RABBITMQ_URL is not defined');
  }

  //Microservice — inbound RabbitMQ consumer for role-assignment events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl] ,
      queue: 'person_roles_queue',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  //Trust Proxy
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  //Cookie Parser
  app.use(cookieParser());

  //Error Handler
  const exceptionFilter = app.get(AllExceptionsFilter);
  app.useGlobalFilters(exceptionFilter);

  //Logs
  useContainer(app.select(AppModule), { fallbackOnErrors: true }); // <—
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: true },
      exceptionFactory: (errors) => {
        const errorCode = findFirstErrorCode(errors) ?? 'VALIDATION_ERROR';
        const message = findFirstMessage(errors);
        return new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          errorCode,
          message,
        });
      },
    }),
  );

  await app.startAllMicroservices();
  await app.listen(configService.get<number>('PORT') ?? 3000);
}
bootstrap();
