using System;
using System.IO;
using System.Threading.Tasks;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyFileWatcher
    {
        private readonly AssemblyProcessor assemblyProcessor;
        private readonly Options options;

        public AssemblyFileWatcher(
            AssemblyProcessor assemblyProcessor,
            Options options
            )
        {
            this.assemblyProcessor = assemblyProcessor;
            this.options = options;
        }

        public void Watch(Options options)
        {
            using (var watcher = new FileSystemWatcher())
            {
                watcher.Path = options.SourcePath;
                watcher.Filter = options.FileFilter;
                watcher.NotifyFilter = NotifyFilters.LastAccess | NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.DirectoryName;

                watcher.Created += OnModelsChanged;
                watcher.EnableRaisingEvents = true;

                Console.WriteLine("Press 'q' to quit the app.");
                while (Console.Read() != 'q') ;
            }
        }

        private void OnModelsChanged(object sender, FileSystemEventArgs e)
        {
            Task.Factory.StartNew(() =>
            {
                // Give time to the compiled file to be usable
                Task.Delay(300);
                this.assemblyProcessor.Process(e.FullPath);
            });
        }
    }
}
