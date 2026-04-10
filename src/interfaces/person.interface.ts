import { IGeoapify } from 'src/clients/geoapify/geoapify.interface';

export interface IPerson {
  first_name: string;
  last_name: string;
  personal_id: string;
  gender: string;
  birth_date: string;
  age: number;
  contact_email: string;
  contact_phone: string;
  address: IGeoapify;
}
