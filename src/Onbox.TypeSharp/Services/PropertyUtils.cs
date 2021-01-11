using System;

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
                return true;
            }
        }
    }
}
