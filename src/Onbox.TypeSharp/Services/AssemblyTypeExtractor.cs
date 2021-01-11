using System;
using System.Linq;
using System.Reflection;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyTypeExtractor
    {
        public Type[] GetModelTypes(Assembly assembly)
        {
            var types = assembly.GetExportedTypes();

            var models = types
                        .Where(t => t.GetConstructors().Where(c => c.IsPublic && c.GetParameters().Length == 0).Any() || t.IsEnum);

            return types;
        }
    }
}
