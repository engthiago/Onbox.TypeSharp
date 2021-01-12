using System;

namespace Onbox.TypeSharp.Services
{
    public class PropertyUtils
    {
        private readonly TypeUtils typeUtils;

        public PropertyUtils(TypeUtils typeUtils)
        {
            this.typeUtils = typeUtils;
        }

        public bool ShouldImport(Type type)
        {
            if (typeUtils.IsEnumerable(type) || type.IsGenericType)
            {
                var elemType = type.GetElementType();
                if (elemType == null)
                {
                    return false;
                }
                return ShouldImport(elemType);
            }

            if (type.IsEnum)
            {
                return true;
            }

            if (this.typeUtils.IsPrimitiveType(type))
            {
                return false;
            }
            else
            {
                return true;
            }
        }
    }
}
