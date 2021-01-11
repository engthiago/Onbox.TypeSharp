using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static Onbox.TypeSharp.Program;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyFileWatcher
    {
        public void Watch(Options options)
        {
            using (var watcher = new FileSystemWatcher())
            {
                watcher.Path = options.Path;
                watcher.Filter = options.Filter;
                watcher.NotifyFilter = NotifyFilters.LastAccess | NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.DirectoryName;

                watcher.Created += OnModelsChanged;
                watcher.EnableRaisingEvents = true;

                Console.WriteLine("Press 'q' to quit the app.");
                while (Console.Read() != 'q') ;
            }
        }

        private void OnModelsChanged(object sender, FileSystemEventArgs e)
        {
            Console.WriteLine($"File: {e.FullPath} {e.ChangeType}");
            Task.Factory.StartNew(() =>
            {
                Task.Delay(300);
                try
                {

                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Exception: {ex.Message}");
                    Console.WriteLine($"Trace: {ex.StackTrace}");
                }
            });
        }
    }
}
