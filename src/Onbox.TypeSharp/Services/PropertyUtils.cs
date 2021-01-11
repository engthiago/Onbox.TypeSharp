using System;
using System.Collections;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class PropertyUtils
    {
        public bool ShouldImport(Type type)
        {
            var constructor = type.GetConstructor(Type.EmptyTypes);
            if (constructor == null)
            {
                return false;
            }
            else
            {
                if (type.GetInterfaces().Any(type => type == typeof(IList)))
                {
                    return false;
                }
                return true;
            }
        }
    }
}
