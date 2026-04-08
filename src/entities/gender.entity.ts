import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { AuthUser } from 'src/clients/auth/auth-client.interface';
import { PersonEntity } from 'src/entities/person.entity';

@Unique('UQ_gender_code', ['code'])
@Unique('UQ_gender_display_name', ['display_name'])
@Entity('gender')
export class GenderEntity extends BaseEntity {
  @Column('uuid', {default: () => 'uuidv7()' , primary: true})
  id: string;

  @Column()
  code: string;

  @Column()
  display_name: string;

  @OneToMany(() => PersonEntity, (person) => person.gender)
  persons: PersonEntity[];

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  created_by: AuthUser | null;

  @UpdateDateColumn()
  updated_at: Date;
}
