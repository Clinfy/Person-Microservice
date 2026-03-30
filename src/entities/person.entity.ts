import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { GenderEntity } from 'src/entities/gender.entity';
import type { IGeoref } from 'src/clients/georef/georef.interface';
import type { AuthUser } from 'src/clients/auth/auth-client.interface';

export enum PersonStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

@Entity()
export class PersonEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column()
  birth_date: Date;

  @Column()
  contact_email: string;

  @Column()
  contact_phone: string;

  @Column()
  personal_id:number;

  @Column({type: 'jsonb'})
  address: IGeoref;

  @ManyToOne(() => GenderEntity, (gender) => gender.persons, {
    nullable: false,
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn()
  gender: GenderEntity;

  @Column({type:'enum', enum: PersonStatus, default: PersonStatus.PENDING})
  status: PersonStatus

  @CreateDateColumn()
  created_at: Date;

  @Column({type: 'jsonb', nullable: true})
  created_by: AuthUser

  @UpdateDateColumn()
  updated_at: Date;
}