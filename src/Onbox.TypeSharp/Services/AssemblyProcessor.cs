using System;
using System.IO;

namespace Onbox.TypeSharp.Services
{
    public class AssemblyProcessor
    {
        private readonly AssemblyLoader assemblyLoader;
        private readonly AssemblyTypeExtractor assemblyTypeExtractor;
        private readonly TypeConverter typeConverter;
        private readonly FileWritterService fileWritterService;
        private readonly TypeCache typeCache;
        private readonly Options options;
        private readonly TypeNamingService typeNamingService;

        public AssemblyProcessor(
            AssemblyLoader assemblyLoader,
            AssemblyTypeExtractor assemblyTypeExtractor,
            TypeConverter typeConverter,
            FileWritterService fileWritterService,
            TypeCache typeCache,
            Options options,
            TypeNamingService typeNamingService
            )
        {
            this.assemblyLoader = assemblyLoader;
            this.assemblyTypeExtractor = assemblyTypeExtractor;
            this.typeConverter = typeConverter;
            this.fileWritterService = fileWritterService;
            this.typeCache = typeCache;
            this.options = options;
            this.typeNamingService = typeNamingService;
        }

        public void Process(string fullAssemblyPath)
        {
            try
            {
                // Ignore assemblies or other files that doesnt pass the filter
                var fileFilter = options.FileFilter.Replace("*", "");
                if (!fullAssemblyPath.Contains(fileFilter))
                {
                    return;
                }

                Console.WriteLine($"*** Converting Assembly ***");
                Console.WriteLine(fullAssemblyPath);

                var assembly = assemblyLoader.LoadAssembly(fullAssemblyPath);
                var outputFolder = options.DestinationPath;
                var typeFilter = options.TypeFilter?.ToLower().Replace("*", "");

                //Console.WriteLine($"Type Filter: {typeFilter}");

                var types = assemblyTypeExtractor.GetModelTypes(assembly);
                foreach (var type in types)
                {
                    //If this type was already converted
                    if (this.typeCache.Contains(type))
                    {
                        continue;
                    }

                    // If this type passes the type filter
                    if (!string.IsNullOrEmpty(typeFilter) && !type.FullName.ToLower().Contains(typeFilter))
                    {
                        //Console.WriteLine($"Ignoring type: {type.FullName}");
                        continue;
                    }

                    var result = this.typeConverter.Convert(type);
                    var typeName = this.typeNamingService.GetImportName(type);
                    var filePath = Path.Combine(outputFolder, typeName + ".ts");
                    this.fileWritterService.Write(result, filePath);
                }
                Console.WriteLine("Done...");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"*** Exception: {ex.Message} ****");
                Console.WriteLine($"Trace: {ex.StackTrace}");
            }
            finally
            {
                this.typeCache.ClearCache();
            }

        }
    }
}
