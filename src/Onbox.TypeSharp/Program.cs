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
                var container = new Container();
                Parser.Default.ParseArguments<Options>(args)
                                .WithParsed(options =>
                                {
                                    container.AddSingleton(options);
                                    container.AddSingleton<TypeCache>();

                                    if (options.Watch)
                                    {
                                        var assemblyWatcher = container.Resolve<AssemblyFileWatcher>();
                                        assemblyWatcher.Watch(options);
                                    }
                                    else
                                    {
                                        var assemblyProcessor = container.Resolve<AssemblyProcessor>();
                                        var files = Directory.GetFiles(options.SourcePath, options.FileFilter, SearchOption.AllDirectories);
                                        foreach (var file in files)
                                        {
                                            assemblyProcessor.Process(file);
                                        }
                                    }
                                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Exception: {ex.Message}");
                Console.WriteLine($"Trace: {ex.StackTrace}");
            }

        }
    }
}
