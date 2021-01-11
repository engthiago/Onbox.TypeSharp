using CommandLine;
using Onbox.Di.V8;
using Onbox.TypeSharp.Services;
using System;
using System.IO;

namespace Onbox.TypeSharp
{
    partial class Program
    {
        static void Main(string[] args)
        {
            try
            {
                Console.WriteLine("*** Initializing TypeSharp ***");
                var container = new Container();
                Parser.Default.ParseArguments<Options>(args)
                                .WithParsed(options =>
                                {
                                    container.AddSingleton(options);
                                    container.AddSingleton<TypeCache>();

                                    if (options.Watch)
                                    {
                                        Run(options, container);
                                        Watch(options, container);
                                    }
                                    else
                                    {
                                        Run(options, container);
                                    }
                                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"*** Exception: {ex.Message} ***");
                Console.WriteLine($"Trace: {ex.StackTrace}");
            }

        }

        private static void Watch(Options options, Container container)
        {
            var assemblyWatcher = container.Resolve<AssemblyFileWatcher>();
            assemblyWatcher.Watch(options);
        }

        private static void Run(Options options, Container container)
        {
            var assemblyProcessor = container.Resolve<AssemblyProcessor>();
            var files = Directory.GetFiles(options.SourcePath, options.FileFilter, SearchOption.AllDirectories);
            foreach (var file in files)
            {
                assemblyProcessor.Process(file);
            }
        }
    }
}
