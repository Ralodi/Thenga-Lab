import { Address } from "./address";

export type BusinessType = "tavern" | "bar" | "nightclub" | "event" | "liquor_store";

export type UserRegistration = {
  id?: string
  email: string;
  password: string;
  first_name: string;
  contact_number: string;
  business_type?: BusinessType;
  address: Address;
};
