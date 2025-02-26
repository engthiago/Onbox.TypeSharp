using System;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class GenericTypeUtils
    {
        private readonly TypeUtils typeUtils;

        public GenericTypeUtils(TypeUtils typeUtils)
        {
            this.typeUtils = typeUtils;
        }

        public Type GetGenericType(Type type)
        {
            var elemType = type.GetElementType();
            if (elemType == null)
            {
                if (this.typeUtils.IsDictionary(type)) 
                {
                    // Getting only value type in the assumption that the key is either string or number
                    elemType = type.GetGenericArguments()?[1];
                    if (this.typeUtils.IsCollection(elemType)) 
                    {
                        elemType = this.GetGenericType(elemType);
                    }
                } 
                else 
                {
                    elemType = type.GetGenericArguments()?.FirstOrDefault();
                }
            }

            if (elemType == null)
            {
                throw new Exception($"Collection / Array type can not be determined for {type.FullName}");
            }

            return elemType;
        }
    }
}
