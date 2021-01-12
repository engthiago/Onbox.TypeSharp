using System;
using System.Collections.Generic;

namespace Onbox.TypeSharp.Services
{
    public class TypeCache
    {
        private static readonly HashSet<Type> processedTypes = new HashSet<Type>();

        public bool Contains(Type type)
        {
            return processedTypes.Contains(type);
        }

        public bool Add(Type type)
        {
            return processedTypes.Add(type);
        }

        public IList<Type> GetCachedTypes()
        {
            var list = new List<Type>(processedTypes);
            return list;
        }

        public void ClearCache()
        {
            processedTypes.Clear();
        }
    }
}
