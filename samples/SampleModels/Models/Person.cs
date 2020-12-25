using System;
using System.Collections.Generic;

namespace SampleModels.Models
{
    public class Person
    {
        public string Name { get; set; }
        public string Company { get; set; }
        public string Company4 { get; set; }

        public SubPerson Related { get; set; }
        public SubPerson Related2 { get; set; }

        public List<SubPerson> Persons { get; set; }

        public GenericPerson<SubPerson> Data { get; set; }
    }

    public class SubPerson
    {
        public string Name { get; set; }
        public string Company { get; set; }
    }

    public class GenericPerson<T>
    {
        public T Data { get; set; }
    }

    public enum AccessLevel
    {
        Read = 0,
        Write = 1
    }
}
