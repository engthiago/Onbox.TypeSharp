using System.Collections.Generic;

namespace SampleModels.Models
{
    public class Person
    {
        public string Name { get; set; }
        public string Company { get; set; }
        public string Company4 { get; set; }

        [Optional]
        public string Company5 { get; set; }
        public int? Money { get; set; }
        public SubPerson Related { get; set; }
        public SubPerson Related2 { get; set; }
        public Person Related3 { get; set; }
        public List<SubPerson> Persons { get; set; }
        public SubPerson[] Persons2 { get; set; }
        public List<Person> Children { get; set; }
        public Person[] Children2 { get; set; }
        public List<string> Bills { get; set; }
        public string[] Bills2 { get; set; }
        public List<int> FavoriteNumbers { get; set; }
        public int[] FavoriteNumbers2 { get; set; }
        public GenericPerson<SubPerson> Data { get; set; }
        public GenericPerson<Person> Data2 { get; set; }
        public GenericPerson<GenericPerson<Person>> Data3 { get; set; }
        public List<List<Person>> People { get; set; }

        public List<List<string>> Strings { get; set; }
        public string[][] Strings2 { get; set; }
        public AccessLevel AccessLevel { get; set; }

        [TypeUnion("type1", "type2")]
        public string TypeUnions { get; set; }

        [TypeUnion(1.2, 2.2)]
        public double TypeUnionDouble { get; set; }

        public object ShouldBeAny { get; set; }

        [UnknownObject]
        [Optional]
        public object ShouldBeUnknown { get; set; }
    }
}
