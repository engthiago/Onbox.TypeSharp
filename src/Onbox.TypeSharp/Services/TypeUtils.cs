using System;
using System.Collections;
using System.Linq;

namespace Onbox.TypeSharp.Services
{
    public class TypeUtils
    {
        public bool IsPrimitiveType(Type type)
        {
            var constructor = type.GetConstructor(Type.EmptyTypes);
            if (constructor == null)
            {
                return true;
            }

            return false;
        }

        public bool IsEnumerable(Type type)
        {
            // This will be true for Arrays too
            return type.GetInterfaces().Any(type => type == typeof(IEnumerable));
        }

        public bool IsNullable(Type type)
        {
            if (type.Name == "Nullable`1")
            {
                return true;
            }

            return false;
        }

        public bool IsDate(Type type)
        {
            if (type == typeof(DateTime) || type == typeof(DateTimeOffset))
            {
                return true;
            }

            return false;
        }

        public bool IsString(Type type)
        {
            if (type == typeof(string) || type == typeof(char))
            {
                return true;
            }

            return false;
        }

        public bool IsNumber(Type type)
        {
            if (type == typeof(int)
                || type == typeof(double)
                || type == typeof(float)
                || type == typeof(decimal)
                || type == typeof(uint)
                || type == typeof(long)
                || type == typeof(ulong)
                || type == typeof(short)
                || type == typeof(ushort)
                )
            {
                return true;
            }

            return false;
        }
    }
}
