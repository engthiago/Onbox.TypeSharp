using System.IO;
using System.Text;
namespace Onbox.TypeSharp.Services
{
    public class FileWritterService
    {
        public void Write(string content, string path)
        {
            File.WriteAllText(path, content, Encoding.UTF8);
        }
    }
}
