import { Inject, Injectable } from '@nestjs/common';
import { PersonsRepository } from 'src/services/persons/persons.repository';
import { RedisService } from 'src/common/redis/redis.service';
import { Logger } from 'winston';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { serializeError } from 'src/common/utils/logger-format.util';
import { PersonsService } from 'src/services/persons/persons.service';

@Injectable()
export class PersonsCacheReconciliationService {
  constructor(
    private readonly redisService: RedisService,
    private readonly personsRepository: PersonsRepository,
    private readonly personsService: PersonsService,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePersonsCacheReconciliation(): Promise<void> {
    const start = Date.now();

    this.logger.info('Persons cache reconciliation started', {
      context: 'PersonsCacheReconciliationService',
      operation: 'handlePersonsCacheReconciliation',
    });

    try {
      const pageSize = 100;
      let page = 1;
      let fetched = 0;
      let total: number;
      let upserted = 0;
      const dbIds = new Set<string>();

      // Phase 1: sync DB → cache (upsert all persons)
      do {
        const result = await this.personsRepository.findAllForCache(page, pageSize);
        total = result.total;

        if (result.data.length === 0) break;

        const multi = this.redisService.raw.multi();
        const ids: string[] = [];

        for (const person of result.data) {
          multi.set(
            this.personsService.redisKey(person.id),
            JSON.stringify(this.personsService.generatePersonInterface(person)),
          );
          ids.push(person.id);
          dbIds.add(person.id);
        }

        if (ids.length > 0) {
          multi.sAdd('persons', ids);
        }

        await multi.exec();

        fetched += result.data.length;
        upserted += result.data.length;
        page++;
      } while (fetched < total);

      // Phase 2: prune stale cache entries (in Redis but no longer in DB)
      const redisIds = await this.redisService.raw.sMembers('persons');
      const staleIds = redisIds.filter((id) => !dbIds.has(id));
      let pruned = 0;

      if (staleIds.length > 0) {
        const multi = this.redisService.raw.multi();

        for (const id of staleIds) {
          multi.del(this.personsService.redisKey(id));
          multi.sRem('persons', id);
        }

        await multi.exec();
        pruned = staleIds.length;
      }

      const duration = Date.now() - start;

      this.logger.info('Persons cache reconciliation completed', {
        context: 'PersonsCacheReconciliationService',
        operation: 'handlePersonsCacheReconciliation',
        upserted,
        pruned,
        duration,
      });
    } catch (error) {
      this.logger.error('Persons cache reconciliation failed', {
        context: 'PersonsCacheReconciliationService',
        operation: 'handlePersonsCacheReconciliation',
        error: serializeError(error),
      });
    }
  }
}
