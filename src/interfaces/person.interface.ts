import { IGeoref } from 'src/clients/georef/georef.interface';

export interface IPerson {
  first_name: string;
  last_name: string;
  personal_id: string;
  gender: string;
  birth_date: Date;
  age: number;
  contact_email: string;
  contact_phone: string;
  address: IGeoref;
}
