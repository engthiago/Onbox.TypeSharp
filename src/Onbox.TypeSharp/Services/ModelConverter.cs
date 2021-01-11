using System;
using System.Linq;
using System.Reflection;
using System.Text;

namespace Onbox.TypeSharp.Services
{
    public class ModelConverter
    {
        private readonly TypeNamingService typeNamingService;
        private readonly TypeCache typeCache;
        private readonly PropertyUtils propertyUtils;
        private readonly StringCasingService stringCasingService;

        public ModelConverter(
            TypeNamingService typeNamingService,
            TypeCache typeCache,
            PropertyUtils propertyUtils,
            StringCasingService stringCasingService)
        {
            this.typeNamingService = typeNamingService;
            this.typeCache = typeCache;
            this.propertyUtils = propertyUtils;
            this.stringCasingService = stringCasingService;
        }

        public string Convert(Type type)
        {
            var importStatments = string.Empty;
            var classBodyBuilder = new StringBuilder();
            var props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);

            classBodyBuilder.AppendLine();
            classBodyBuilder.AppendLine($"export interface {this.typeNamingService.GetDefinitionName(type)}" + " {");
            foreach (var prop in props)
            {
                if (this.propertyUtils.ShouldImport(prop.PropertyType) && prop.PropertyType != type)
                {
                    var importStatement = $"import {{ {this.typeNamingService.GetImportName(prop.PropertyType)} }} from \"./{this.typeNamingService.GetImportName(prop.PropertyType)}\"";

                    if (importStatments == string.Empty)
                    {
                        importStatments += importStatement;
                    }
                    else if (!importStatments.Contains(importStatement))
                    {
                        importStatments += Environment.NewLine + importStatement;
                    }

                    if (!typeCache.Contains(prop.PropertyType))
                    {
                        Convert(prop.PropertyType);
                    }
                }
                classBodyBuilder.AppendLine($"   {this.stringCasingService.ConvertToCamelCase(prop.Name)}: {this.typeNamingService.GetPropertyTypeName(prop.PropertyType)};");
            }
            classBodyBuilder.AppendLine("}");

            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();

            typeCache.Add(type);

            return result;
        }
    }
}
