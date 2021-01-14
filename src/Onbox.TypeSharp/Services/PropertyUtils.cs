using System;

namespace Onbox.TypeSharp.Services
{
    public class PropertyUtils
    {
        private readonly TypeUtils typeUtils;
        private readonly GenericTypeUtils genericUtils;

        public PropertyUtils(TypeUtils typeUtils, GenericTypeUtils genericUtils)
        {
            this.typeUtils = typeUtils;
            this.genericUtils = genericUtils;
        }

        public bool ShouldImport(Type type)
        {
            if (type.IsEnum)
            {
                return true;
            }

            if (type.IsValueType)
            {
                return false;
            }

            if (typeUtils.IsCollection(type))
            {
                var elemType = this.genericUtils.GetGenericType(type);
                return ShouldImport(elemType);
            }

            if (type.IsGenericType)
            {
                return true;
            }

            if (this.typeUtils.IsPrimitiveType(type))
            {
                return false;
            }

            return true;
        }
    }
}
