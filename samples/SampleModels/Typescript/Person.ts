import { SubPerson } from "./SubPerson";
import { GenericPerson } from "./GenericPerson";
import { AccessLevel } from "./AccessLevel";

export interface Person {
   name: string;
   company: string;
   company4: string;
   money?: number;
   related: SubPerson;
   related2: SubPerson;
   related3: Person;
   persons: SubPerson[];
   persons2: SubPerson[];
   children: Person[];
   children2: Person[];
   bills: string[];
   bills2: string[];
   favoriteNumbers: number[];
   favoriteNumbers2: number[];
   data: GenericPerson<SubPerson>;
   data2: GenericPerson<Person>;
   data3: GenericPerson<GenericPerson<Person>>;
   people: Person[][];
   strings: string[][];
   strings2: string[][];
   accessLevel: AccessLevel;
   typeUnions: "type1" | "type2";
}
