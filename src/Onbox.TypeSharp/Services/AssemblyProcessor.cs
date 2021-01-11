using System;
using System.IO;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyProcessor
    {
        private AssemblyLoader assemblyLoader;
        private AssemblyTypeExtractor assemblyTypeExtractor;
        private TypeConverter typeConverter;
        private FileWritterService fileWritterService;
        private readonly TypeCache typeCache;
        private Options options;

        public AssemblyProcessor(
            AssemblyLoader assemblyLoader,
            AssemblyTypeExtractor assemblyTypeExtractor,
            TypeConverter typeConverter,
            FileWritterService fileWritterService,
            TypeCache typeCache,
            Options options
            )
        {
            this.assemblyLoader = assemblyLoader;
            this.assemblyTypeExtractor = assemblyTypeExtractor;
            this.typeConverter = typeConverter;
            this.fileWritterService = fileWritterService;
            this.typeCache = typeCache;
            this.options = options;
        }

        public void Process(string fullAssemblyPath)
        {
            try
            {
                // Ignore assemblies or other files that doesnt pass the filter
                if (!fullAssemblyPath.Contains(options.Filter))
                {
                    return;
                }

                Console.WriteLine($"Assembly: {fullAssemblyPath}");

                var assembly = assemblyLoader.LoadAssembly(fullAssemblyPath);
                var outputFolder = options.DestinationPath;
                var types = assemblyTypeExtractor.GetModelTypes(assembly);
                foreach (var type in types)
                {
                    var result = this.typeConverter.Convert(type);
                    var filePath = Path.Combine(outputFolder, type.Name + ".ts");
                    this.fileWritterService.Write(result, filePath);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Exception: {ex.Message}");
                Console.WriteLine($"Trace: {ex.StackTrace}");
            }
            finally
            {
                this.typeCache.ClearCache();
            }

        }
    }
}
