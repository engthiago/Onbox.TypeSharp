using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;

namespace Onbox.TypeSharp.Services
{
    public class TypeConverter
    {
        private readonly TypeNamingService typeNamingService;
        private readonly PropertyUtils propertyUtils;
        private readonly StringCasingService stringCasingService;
        private readonly TypeCache typeCache;
        private readonly FileWritterService fileWritterService;
        private readonly TypeUtils typeUtils;
        private readonly Options options;

        public TypeConverter(
            TypeNamingService typeNamingService,
            PropertyUtils propertyUtils,
            StringCasingService stringCasingService,
            TypeCache typeCache,
            FileWritterService fileWritterService,
            TypeUtils typeUtils,
            Options options
            )
        {
            this.typeNamingService = typeNamingService;
            this.propertyUtils = propertyUtils;
            this.stringCasingService = stringCasingService;
            this.typeCache = typeCache;
            this.fileWritterService = fileWritterService;
            this.typeUtils = typeUtils;
            this.options = options;
        }

        public string Convert(Type type)
        {
            if (type.IsEnum)
            {
                return this.ConvertEnum(type);
            }
            else
            {
                return this.ConvertModel(type);
            }
        }

        public string ConvertEnum(Type type)
        {
            var enumBodyBuilder = new StringBuilder();

            var values = type.GetEnumValues();

            enumBodyBuilder.AppendLine();
            enumBodyBuilder.AppendLine($"export enum {this.typeNamingService.GetDefinitionName(type)}" + " {");
            var i = 0;
            foreach (var value in values)
            {
                enumBodyBuilder.AppendLine($"   {value} = {value.GetHashCode()},");
                i++;
            }
            enumBodyBuilder.AppendLine("}");

            var result = enumBodyBuilder.ToString();
            return result;
        }

        public string ConvertModel(Type type)
        {
            var importStatments = string.Empty;
            var classBodyBuilder = new StringBuilder();

            PropertyInfo[] props;
            if (this.typeUtils.IsEnumerable(type))
            {
                var arg = type.GetElementType();
                props = arg.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            }
            else
            {
                props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            }

            classBodyBuilder.AppendLine();
            classBodyBuilder.Append($"export interface {this.typeNamingService.GetDefinitionName(type)}");
            if (type.BaseType != null && type.BaseType != typeof(object))
            {
                var convertedProp = this.Convert(type.BaseType);
                var baseTypeName = this.typeNamingService.GetImportName(type.BaseType);
                var filePath = Path.Combine(options.DestinationPath, baseTypeName + ".ts");
                this.fileWritterService.Write(convertedProp, filePath);
                classBodyBuilder.Append($" extends {baseTypeName}");

                importStatments = $"import {{ {this.typeNamingService.GetImportName(type.BaseType)} }} from \"./{this.typeNamingService.GetImportName(type.BaseType)}\";";
            }

            classBodyBuilder.Append(" {");
            classBodyBuilder.AppendLine();

            foreach (var prop in props)
            {
                var contextPropType = prop.PropertyType;
                if (this.propertyUtils.ShouldImport(contextPropType) && contextPropType != type)
                {
                    if (this.typeUtils.IsEnumerable(contextPropType) || type.IsGenericType)
                    {
                        contextPropType = contextPropType.GetElementType();
                    }

                    if (!this.typeCache.Contains(contextPropType))
                    {
                        var convertedProp = this.Convert(contextPropType);
                        var typeName = this.typeNamingService.GetImportName(contextPropType);
                        var filePath = Path.Combine(options.DestinationPath, typeName + ".ts");
                        this.fileWritterService.Write(convertedProp, filePath);
                    }

                    var importStatement = $"import {{ {this.typeNamingService.GetImportName(contextPropType)} }} from \"./{this.typeNamingService.GetImportName(contextPropType)}\";";
                    if (importStatments == string.Empty)
                    {
                        importStatments += importStatement;
                    }
                    else if (!importStatments.Contains(importStatement))
                    {
                        importStatments += Environment.NewLine + importStatement;
                    }
                }
                classBodyBuilder.AppendLine($"   {this.typeNamingService.GetPropertyName(prop, contextPropType)}: {this.typeNamingService.GetPropertyTypeName(prop.PropertyType)};");
            }
            classBodyBuilder.AppendLine("}");

            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();

            this.typeCache.Add(type);
            return result;
        }
    }
}
