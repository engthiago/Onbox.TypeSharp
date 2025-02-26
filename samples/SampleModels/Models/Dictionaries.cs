using System.Collections.Generic;

namespace SampleModels.Models
{
    public class Dictionaries
    {
        public Dictionary<string, Person> PersonDictionary { get; set; }
        public Dictionary<double, Person> PersonDictionaryDouble { get; set; }
        public Dictionary<int, Person> PersonDictionaryInt { get; set; }
    }
}
