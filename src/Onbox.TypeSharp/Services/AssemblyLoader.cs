using System.IO;
using System.Reflection;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyLoader
    {
        public Assembly LoadAssembly(string fullPath)
        {
            using (FileStream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read))
            {
                var byteArr = GetBytes(stream);
                var assembly = Assembly.Load(byteArr);

                return assembly;
            }
        }

        private byte[] GetBytes(Stream input)
        {
            byte[] buffer = new byte[16 * 1024];
            using (MemoryStream stream = new MemoryStream())
            {
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    stream.Write(buffer, 0, read);
                }
                return stream.ToArray();
            }
        }
    }
}
