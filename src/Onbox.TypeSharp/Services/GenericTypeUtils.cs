using System;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class GenericTypeUtils
    {
        public Type GetGenericType(Type type)
        {
            var elemType = type.GetElementType();
            if (elemType == null)
            {
                elemType = type.GetGenericArguments()?.FirstOrDefault();
            }

            if (elemType == null)
            {
                throw new Exception($"Collection / Array type can not be determined for {type.FullName}");
            }

            return elemType;
        }
    }
}
