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
            else if (type.IsClass)
            {
                return type.Name;
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
