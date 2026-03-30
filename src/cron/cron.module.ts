import { Module } from '@nestjs/common';
import { OutboxPublisherService } from 'src/cron/outbox-publisher.service';
import { OutboxSubscriberService } from 'src/cron/outbox-subscriber.service';
import { OutboxCleanupService } from 'src/cron/outbox-cleanup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEntity } from 'src/entities/outbox.entity';
import { RMQClientModule } from 'src/common/messaging/rmq-client.module';
import { RequestContextModule } from 'src/common/context/request-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEntity]),
    RMQClientModule,
    RequestContextModule,
  ],
  providers: [OutboxPublisherService, OutboxSubscriberService, OutboxCleanupService],
})
export class CronModule {}