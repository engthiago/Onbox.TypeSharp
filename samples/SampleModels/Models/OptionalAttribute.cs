using System;

namespace SampleModels.Models
{
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class OptionalAttribute : Attribute
    {
    }
}
