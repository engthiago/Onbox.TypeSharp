using System;
using System.Collections;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class TypeNamingService
    {
        private readonly TypeUtils typeUtils;

        public TypeNamingService(TypeUtils typeUtils)
        {
            this.typeUtils = typeUtils;
        }

        public string GetImportName(Type type)
        {
            if (type.IsArray)
            {
                var arg = type.GetElementType();
                return this.GetImportName(arg);
            }

            return $"{type.Name.Replace("`1", "")}";
        }

        public string GetDefinitionName(Type type)
        {
            if (type.IsArray)
            {
                var arg = type.GetElementType();
                return this.GetDefinitionName(arg);
            }

            return $"{type.Name.Replace("`1", "<T>")}";
        }

        public string GetPropertyTypeName(Type type)
        {
            if (this.typeUtils.IsString(type))
            {
                return "string";
            }
            else if (this.typeUtils.IsNumber(type))
            {
                return "number";
            }
            else if (type == typeof(bool))
            {
                return "boolean";
            }
            else if (this.typeUtils.IsDate(type))
            {
                return "Date";
            }
            else if (this.typeUtils.IsEnumerable(type))
            {
                if (type.IsArray)
                {
                    // The name includes the square brackets already, for instance string[]
                    return $"{type.Name}";
                }
                var args = type.GetGenericArguments();
                if (args.Count() > 1)
                {
                    throw new Exception($"List types with more than one generic arguments are not supported: {type.Name}");
                }

                var arg = args.FirstOrDefault();
                return $"{arg.Name}[]";
            }
            else if (type.IsGenericType)
            {
                var args = type.GetGenericArguments();
                if (args.Count() > 1)
                {
                    throw new Exception($"Property types with more than one generic arguments are not supported: {type.Name}");
                }

                var arg = args.FirstOrDefault();
                return $"{type.Name.Replace("`1", "")}<{arg.Name}>";
            }
            else if (type.IsClass || type.IsEnum)
            {
                return type.Name;
            }

            throw new Exception($"Unsupported Property Type: {type.Name}");
        }
    }
}
