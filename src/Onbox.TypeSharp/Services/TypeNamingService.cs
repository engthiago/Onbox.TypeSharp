using System;
using System.Collections;
using System.Linq;
using System.Reflection;

namespace Onbox.TypeSharp.Services
{
    public class TypeNamingService
    {
        private readonly TypeUtils typeUtils;
        private readonly StringCasingService stringCasingService;
        private readonly GenericTypeUtils genericTypeUtils;

        public TypeNamingService(
            TypeUtils typeUtils,
            StringCasingService stringCasingService,
            GenericTypeUtils genericTypeUtils
            )
        {
            this.typeUtils = typeUtils;
            this.stringCasingService = stringCasingService;
            this.genericTypeUtils = genericTypeUtils;
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

        public string GetPropertyName(PropertyInfo propInfo, Type type)
        {
            if (this.typeUtils.IsNullable(type))
            {
                return this.stringCasingService.ConvertToCamelCase( $"{propInfo.Name}?" );
            }

            return this.stringCasingService.ConvertToCamelCase(propInfo.Name);
        }

        public string GetPropertyTypeName(Type type)
        {
            if (type == typeof(object))
            {
                return "any";
            }
            if (this.typeUtils.IsUnion(type))
            {
                System.Diagnostics.Debug.WriteLine(type.FullName);
            }
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
            else if (this.typeUtils.IsDelegate(type))
            {
                return "CustomEvent";
            }
            else if (this.typeUtils.IsCustomPropObjects(type))
            {
                return "Map<string, unknown>";
            }
            //else if (this.typeUtils.IsDictionary(type))
            //{
                // Implement Dictionaries in the future
            //}
            else if (this.typeUtils.IsCollection(type))
            {
                var arg = this.genericTypeUtils.GetGenericType(type);
                return $"{this.GetPropertyTypeName(arg)}[]";
            }
            else if (this.typeUtils.IsNullable(type))
            {
                var valueProp = type.GetProperty("Value")?.PropertyType;
                if (valueProp == null)
                {
                    throw new Exception($"Could not convert Nullable type: {type.Name}");
                }
                return this.GetPropertyTypeName(valueProp);
            }
            else if (type.IsGenericType)
            {
                var args = type.GetGenericArguments();
                if (args.Count() > 1)
                {
                    throw new Exception($"Property types with more than one generic arguments are not supported: {type.Name}");
                }

                var arg = args.FirstOrDefault();
                return $"{type.Name.Replace("`1", "")}<{GetPropertyTypeName(arg)}>";
            }
            else if (type.IsClass || type.IsEnum)
            {
                return type.Name;
            }

            throw new Exception($"Unsupported Property Type: {type.Name}");
        }
    }
}
