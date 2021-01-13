import { SubPerson } from "./SubPerson";
import { GenericPerson } from "./GenericPerson";

export interface Person {
   name: string;
   company: string;
   company4: string;
   related: SubPerson;
   related2: SubPerson;
   persons: SubPerson[];
   persons2: SubPerson[];
   data: GenericPerson<SubPerson>;
}
