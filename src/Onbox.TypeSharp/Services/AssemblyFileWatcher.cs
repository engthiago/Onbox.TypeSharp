using Onbox.Core.V9.ReactFactory;
using System;
using System.IO;
using System.Threading.Tasks;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyFileWatcher
    {
        private readonly AssemblyProcessor assemblyProcessor;
        private readonly Debouncer debouncer = ReactFactory.Debouncer();

        public AssemblyFileWatcher(
            AssemblyProcessor assemblyProcessor
            )
        {
            this.assemblyProcessor = assemblyProcessor;
        }

        public void Watch(Options options)
        {
            using (var watcher = new FileSystemWatcher())
            {
                watcher.Path = options.SourcePath;
                watcher.Filter = options.FileFilter;
                watcher.IncludeSubdirectories = true;
                watcher.NotifyFilter = NotifyFilters.LastAccess | NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.DirectoryName;

                watcher.Created += OnModelsChanged;
                watcher.EnableRaisingEvents = true;
                this.EchoListening();
                
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
                debouncer.Debounce(EchoListening, 2000);
            });
        }

        private void EchoListening()
        {
            Console.WriteLine("Listening for folder changes...");
            Console.WriteLine("Enter 'q' to quit the app.");
        }
    }
}
