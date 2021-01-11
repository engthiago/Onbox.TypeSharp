using System;
using System.Text;

namespace Onbox.TypeSharp.Services
{
    public class EnumConverter
    {
        private readonly TypeNamingService typeNamingService;

        public EnumConverter(TypeNamingService typeNamingService)
        {
            this.typeNamingService = typeNamingService;
        }

        public string Convert(Type type)
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
    }
}
