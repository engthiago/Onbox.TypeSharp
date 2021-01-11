using System;
using System.Collections;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class TypeNamingService
    {
        public string GetImportName(Type type)
        {
            return $"{type.Name.Replace("`1", "")}";
        }

        public string GetDefinitionName(Type type)
        {
            return $"{type.Name.Replace("`1", "<T>")}";
        }

        public string GetPropertyTypeName(Type type)
        {
            if (type == typeof(string) || type == typeof(DateTime) || type == typeof(DateTimeOffset))
            {
                return "string";
            }
            else if (type == typeof(int) || type == typeof(double) || type == typeof(float))
            {
                return "number";
            }
            else if (type.GetInterfaces().Any(type => type == typeof(IList)))
            {
                var att = type.GetGenericArguments().LastOrDefault();
                return $"{att.Name}[]";
            }
            else if (type.IsGenericType)
            {
                var att = type.GetGenericArguments().LastOrDefault();
                return $"{type.Name.Replace("`1", "")}<{att.Name}>";
            }
            else if (type.IsClass)
            {
                return type.Name;
            }

            throw new Exception($"Invalid Property Type: {type.Name}");
        }
    }
}
