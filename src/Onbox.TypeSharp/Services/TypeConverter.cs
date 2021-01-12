using System;
using System.Collections;
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
        private readonly Options options;

        public TypeConverter(
            TypeNamingService typeNamingService,
            PropertyUtils propertyUtils,
            StringCasingService stringCasingService,
            TypeCache typeCache,
            FileWritterService fileWritterService,
            Options options
            )
        {
            this.typeNamingService = typeNamingService;
            this.propertyUtils = propertyUtils;
            this.stringCasingService = stringCasingService;
            this.typeCache = typeCache;
            this.fileWritterService = fileWritterService;
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

            PropertyInfo[] props = null;
            if (type.GetInterfaces().Any(i => i == typeof(IList)))
            {
                var arg = type.GetGenericArguments().FirstOrDefault();
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
                if (this.propertyUtils.ShouldImport(prop.PropertyType) && prop.PropertyType != type)
                {
                    var importStatement = $"import {{ {this.typeNamingService.GetImportName(prop.PropertyType)} }} from \"./{this.typeNamingService.GetImportName(prop.PropertyType)}\";";

                    if (importStatments == string.Empty)
                    {
                        importStatments += importStatement;
                    }
                    else if (!importStatments.Contains(importStatement))
                    {
                        importStatments += Environment.NewLine + importStatement;
                    }

                    if (!this.typeCache.Contains(prop.PropertyType))
                    {
                        var convertedProp = this.Convert(prop.PropertyType);
                        var typeName = this.typeNamingService.GetImportName(prop.PropertyType);
                        var filePath = Path.Combine(options.DestinationPath, typeName + ".ts");
                        this.fileWritterService.Write(convertedProp, filePath);
                    }
                }
                classBodyBuilder.AppendLine($"   {this.stringCasingService.ConvertToCamelCase(prop.Name)}: {this.typeNamingService.GetPropertyTypeName(prop.PropertyType)};");
            }
            classBodyBuilder.AppendLine("}");

            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();

            this.typeCache.Add(type);
            return result;
        }
    }
}
