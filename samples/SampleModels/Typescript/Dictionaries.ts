import { Person } from "./Person";

export interface Dictionaries {
   personDictionary: Record<string, Person>;
   personDictionaryDouble: Record<number, Person>;
   personDictionaryInt: Record<number, Person>;
}
