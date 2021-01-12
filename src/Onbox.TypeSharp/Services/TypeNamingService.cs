using System;
using System.Collections;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class TypeNamingService
    {
        public string GetImportName(Type type)
        {
            if (type.GetInterfaces().Any(i => i == typeof(IList)))
            {
                var att = type.GetGenericArguments().FirstOrDefault();
                return this.GetImportName(att);
            }

            return $"{type.Name.Replace("`1", "")}";
        }

        public string GetDefinitionName(Type type)
        {
            if (type.GetInterfaces().Any(i => i == typeof(IList)))
            {
                var att = type.GetGenericArguments().FirstOrDefault();
                return this.GetDefinitionName(att);
            }

            return $"{type.Name.Replace("`1", "<T>")}";
        }

        public string GetPropertyTypeName(Type type)
        {
            if (this.IsString(type))
            {
                return "string";
            }
            else if (this.IsNumber(type))
            {
                return "number";
            }
            else if (type == typeof(bool))
            {
                return "boolean";
            }
            else if (this.IsDate(type))
            {
                return "Date";
            }
            else if (type.GetInterfaces().Any(type => type == typeof(IList)))
            {
                if (type.IsArray)
                {
                    // The name includes the square brackets already, for instance string[]
                    return $"{type.Name}";
                }
                var att = type.GetGenericArguments().FirstOrDefault();
                return $"{att.Name}[]";
            }
            else if (type.IsGenericType)
            {
                var args = type.GetGenericArguments();
                if (args.Count() > 1)
                {
                    throw new Exception($"Property types with more than one generic arguments are not supported: {type.Name}");
                }

                var att = type.GetGenericArguments().FirstOrDefault();
                return $"{type.Name.Replace("`1", "")}<{att.Name}>";
            }
            else if (type.IsClass)
            {
                return type.Name;
            }

            throw new Exception($"Unsupported Property Type: {type.Name}");
        }

        private bool IsDate(Type type)
        {
            if (type == typeof(DateTime) || type == typeof(DateTimeOffset))
            {
                return true;
            }

            return false;
        }

        private bool IsString(Type type)
        {
            if (type == typeof(string) || type == typeof(char))
            {
                return true;
            }

            return false;
        }

        private bool IsNumber(Type type)
        {
            if (type == typeof(int) 
                || type == typeof(double) 
                || type == typeof(float) 
                || type == typeof(decimal) 
                || type == typeof(uint) 
                || type == typeof(long)
                || type == typeof(ulong)
                || type == typeof(short)
                || type == typeof(ushort)
                )
            {
                return true;
            }

            return false;
        }
    }
}
