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
            if (type == typeof(object))
            {
                return false;
            }

            if (type == typeof(MarshalByRefObject))
            {
                return false;
            }

            if (type.IsAbstract)
            {
                return false;
            }

            if (type == typeof(Attribute))
            {
                return false;
            }

            if (type.IsAssignableTo(typeof(Attribute)))
            {
                return false;
            }

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
