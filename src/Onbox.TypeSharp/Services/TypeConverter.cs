using System;
using System.Collections;
using System.Collections.Generic;
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
        private readonly TypeCache typeCache;
        private readonly FileWritterService fileWritterService;
        private readonly TypeUtils typeUtils;
        private readonly GenericTypeUtils genericTypeUtils;
        private readonly Options options;

        public TypeConverter(
            TypeNamingService typeNamingService,
            PropertyUtils propertyUtils,
            TypeCache typeCache,
            FileWritterService fileWritterService,
            TypeUtils typeUtils,
            GenericTypeUtils genericTypeUtils,
            Options options
            )
        {
            this.typeNamingService = typeNamingService;
            this.propertyUtils = propertyUtils;
            this.typeCache = typeCache;
            this.fileWritterService = fileWritterService;
            this.typeUtils = typeUtils;
            this.genericTypeUtils = genericTypeUtils;
            this.options = options;
        }

        public string Convert(Type type)
        {
            this.typeCache.Add(type);

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
            this.typeCache.Add(type);
            return result;
        }

        public string ConvertModel(Type type)
        {
            var importStatments = string.Empty;
            var classBodyBuilder = new StringBuilder();

            PropertyInfo[] props;
            if (this.typeUtils.IsCollection(type))
            {
                var arg = type.GetElementType();
                if (arg == null)
                {
                    props = genericTypeUtils.GetGenericType(type).GetProperties(BindingFlags.Public | BindingFlags.Instance);
                } 
                else
                {
                    props = arg.GetProperties(BindingFlags.Public | BindingFlags.Instance);
                }
            }
            else
            {
                props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            }

            classBodyBuilder.AppendLine();
            classBodyBuilder.Append($"export interface {this.typeNamingService.GetDefinitionName(type)}");

            // Inheritance
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
                    // Collection needs to be checked for its generic item type
                    if (this.typeUtils.IsCollection(contextPropType))
                    {
                        contextPropType = this.genericTypeUtils.GetGenericType(contextPropType);
                    }

                    // Generic properties need to be checked for its own as well as its generic item type
                    if (prop.PropertyType.IsGenericType && !this.typeUtils.IsCollection(prop.PropertyType))
                    {
                        var genericType = this.genericTypeUtils.GetGenericType(prop.PropertyType);
                        this.HandlePropertyWritting(type, genericType);

                        var fullName = $"{contextPropType.Namespace}.{contextPropType.Name}";
                        var declarationType = contextPropType.Assembly.GetType(fullName);
                        this.HandlePropertyWritting(type, declarationType);
                    }
                    else if (!this.typeCache.Contains(contextPropType))
                    {
                        this.HandlePropertyWritting(type, contextPropType);
                    }

                    if (contextPropType != type && contextPropType.Name != "List`1")
                    {
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
                }

                var typeUnionAtt = prop.CustomAttributes.FirstOrDefault(a => a.AttributeType.Name.StartsWith("TypeUnion"));
                var typeUnitSuccess = false;
                if (typeUnionAtt != null) 
                { 
                    var constructorArgs = typeUnionAtt.ConstructorArguments;
                    if (constructorArgs != null && constructorArgs.Count > 0)
                    {
                        var value = constructorArgs[0].Value;
                        var list = value as IList;
                        if (list != null && list.Count > 0)
                        {
                            var unionTypes = new List<string>();
                            foreach (var item in list)
                            {
                                var argType = item.GetType().GetProperties()[0].PropertyType;
                                if (argType == null) continue;

                                if (!typeUtils.IsPrimitiveType(argType))
                                {
                                    throw new Exception("Non primitive Type Unions not implemented yet");
                                }
                                else
                                {
                                    unionTypes.Add(item.ToString());
                                }
                            }

                            classBodyBuilder.AppendLine($"   {this.typeNamingService.GetPropertyName(prop, contextPropType)}: {string.Join(" | ", unionTypes)};");
                            typeUnitSuccess = true;
                        }
                    }
                }
                
                if (!typeUnitSuccess)
                {
                    classBodyBuilder.AppendLine($"   {this.typeNamingService.GetPropertyName(prop, contextPropType)}: {this.typeNamingService.GetPropertyTypeName(prop.PropertyType)};");
                }
            }
            classBodyBuilder.AppendLine("}");

            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();
            return result;
        }

        private void HandlePropertyWritting(Type parentType, Type propType)
        {
            if (this.propertyUtils.ShouldImport(propType) && propType != parentType && !this.typeCache.Contains(propType) && propType.Name != "List`1")
            {
                var convertedProp = this.Convert(propType);
                var typeName = this.typeNamingService.GetImportName(propType);
                var filePath = Path.Combine(options.DestinationPath, typeName + ".ts");
                this.fileWritterService.Write(convertedProp, filePath);
            }
        }
    }
}
