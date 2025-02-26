import { Person } from "./Person";

export interface Dictionaries {
   personDictionary: { [key: string]: Person };
   personDictionaryDouble: { [key: number]: Person };
   personDictionaryInt: { [key: number]: Person };
}
