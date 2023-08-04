using System;
namespace SampleModels.Models
{
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class TypeUnionAttribute: Attribute
    {
        public TypeUnionAttribute(params string[] args) { }
        public TypeUnionAttribute(params double[] args) { }
    }
}
