import { Address } from "./address";

export type UserRegistration = {
  id?: string
  email: string;
  password: string;
  first_name: string;
  contact_number: string;
  address: Address;
};

