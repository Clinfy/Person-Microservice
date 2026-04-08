import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

@Index('idx_outbox_sent_cleanup', ['status'], { where: '"status" = \'SENT\'' })
@Entity('outbox')
export class OutboxEntity {
  @PrimaryColumn('uuid', { default: () => 'uuidv7()' })
  id: string;

  @Column()
  destination: string;

  @Column()
  pattern: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Column({ type: 'integer', default: 0 })
  retry_count: number;

  @Column({ type: 'varchar', nullable: true })
  last_error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
