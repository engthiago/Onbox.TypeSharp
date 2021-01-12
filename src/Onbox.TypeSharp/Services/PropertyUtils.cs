using System;

namespace Onbox.TypeSharp.Services
{
    public class PropertyUtils
    {
        public bool ShouldImport(Type type)
        {
            if (type.IsArray || type.IsGenericType)
            {
                var elemType = type.GetElementType();
                return ShouldImport(elemType);
            }

            if (type.IsEnum)
            {
                return true;
            }

            var constructor = type.GetConstructor(Type.EmptyTypes);
            if (constructor == null)
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
