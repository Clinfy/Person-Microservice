import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { useContainer } from 'class-validator';
import { BadRequestException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { findFirstErrorCode, findFirstMessage } from 'src/common/utils/find-erros-data.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
