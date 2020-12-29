using CommandLine;
using Mono.Cecil;
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace Onbox.Csharp.Typescript
{
    class Program
    {
        public class Options
        {
            [Option('s', "source", Required = true, HelpText = "The path of the folder to be watched.")]
            public string Path { get; set; }

            [Option('f', "filter", Required = true, HelpText = "The names of the assemblies to be watched.")]
            public string Filter { get; set; }

            [Option('d', "destination", Required = true, HelpText = "The destination path.")]
            public string DesitinationPath { get; set; }

            [Option('c', "controllers", Required = false, HelpText = "Map Aspnet Core Controllers.")]
            public bool MapControllers { get; set; }
        }

        private static Dictionary<Type, string> imports = new Dictionary<Type, string>();
        private static HashSet<TypeReference> processedTypes = new HashSet<TypeReference>();

        private static string output;

        private static void ClearCache()
        {
            imports.Clear();
            processedTypes.Clear();
        }

        static void Main(string[] args)
        {
            Parser.Default.ParseArguments<Options>(args)
                   .WithParsed<Options>(o =>
                   {
                       using (var watcher = new FileSystemWatcher())
                       {
                           watcher.Path = o.Path;
                           watcher.Filter = o.Filter;
                           watcher.NotifyFilter = NotifyFilters.LastAccess | NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.DirectoryName;

                           output = o.DesitinationPath;

                           watcher.Created += OnModelsChanged;
                           watcher.EnableRaisingEvents = true;

                           Console.WriteLine("Press 'q' to quit.");
                           while (Console.Read() != 'q') ;
                       }
                   });
        }

        private static void OnModelsChanged(object sender, FileSystemEventArgs e)
        {
            Console.WriteLine($"File: {e.FullPath} {e.ChangeType}");
            Task.Factory.StartNew(() =>
            {
                Task.Delay(300);
                try
                {
                    WriteAssemblyTypes(e.FullPath);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Exception: {ex.Message}");
                    Console.WriteLine($"Trace: {ex.StackTrace}");
                }
                ClearCache();
            });
        }

        private static void WriteAssemblyTypes(string fileName)
        {
            ModuleDefinition module = ModuleDefinition.ReadModule(fileName);
            foreach (TypeDefinition type in module.Types)
            {
                if (! type.IsPublic)
                    continue;

                ProcessType(type, output);
            }
        }

        private static byte[] GetBytes(Stream input)
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

        private static string ProcessController(TypeReference type, string path)
        {
            var importStatments = string.Empty;
            var classBodyBuilder = new StringBuilder();

            classBodyBuilder.AppendLine("import { Injectable } from '@angular/core';");
            classBodyBuilder.AppendLine("import { Observable } from 'rxjs';");
            classBodyBuilder.AppendLine("import { HttpClient } from '@angular/common/http';");
            classBodyBuilder.AppendLine("import { environment } from '@env/environment';");

            classBodyBuilder.AppendLine();
            classBodyBuilder.AppendLine("@Injectable({");
            classBodyBuilder.AppendLine("   providedIn: 'root'");
            classBodyBuilder.AppendLine("})");
            classBodyBuilder.AppendLine($"export class {GetDefinition(type).Replace("Controller", "Service")}" + " {");
            classBodyBuilder.AppendLine();
            classBodyBuilder.AppendLine("  constructor(private http: HttpClient) { }");

            var meths = type.Resolve().Methods;
            foreach (var meth in meths)
            {
                var attr = meth.CustomAttributes;
                if (attr.FirstOrDefault(a => a.GetType().Name.Contains("HttpGet")) != null)
                {
                    var responseAttrs = attr.Where(a => a.GetType().Name.Contains("ProducesResponseType"));
                    if (responseAttrs.Any())
                    {
                        Console.WriteLine($"Endpoint: {meth.Name}");
                    }
                }
            }
            classBodyBuilder.AppendLine("}");
            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();

            SaveTypescript(type, path, result);

            return result;
        }

        private static string ProcessType(TypeReference type, string path)
        {
            processedTypes.Add(type);

            if (type.Resolve()?.IsEnum == true)
            {
                return ProcessEnum(type.Resolve(), path);
            }
            else if (type.Resolve()?.CustomAttributes.FirstOrDefault(a => a.AttributeType.Name.Contains("ApiControllerAttribute")) != null)
            {
                return ProcessController(type, path);
            }
            else if (!type.IsValueType)
            {
                return ProcessClass(type, path);
            }

            return null;
        }

        private static string ProcessEnum(TypeDefinition type, string path)
        {
            var enumBodyBuilder = new StringBuilder();

            var values = type.Fields;

            enumBodyBuilder.AppendLine();
            enumBodyBuilder.AppendLine($"export enum {GetDefinition(type)}" + " {");
            var i = 0;
            foreach (var value in values)
            {
                enumBodyBuilder.AppendLine($"   {value} = {value.GetHashCode()},");
                i++;
            }
            enumBodyBuilder.AppendLine("}");

            var result = enumBodyBuilder.ToString();
            SaveTypescript(type, path, result);
            return result;
        }

        private static string ProcessClass(TypeReference type, string path)
        {
            var importStatments = string.Empty;

            var classBodyBuilder = new StringBuilder();
            var props = type.Resolve()?.Properties;

            if (props == null)
            {
                return null;
            }

            classBodyBuilder.AppendLine();
            classBodyBuilder.AppendLine($"export interface {GetDefinition(type)}" + " {");
            foreach (var prop in props)
            {
                if (ShouldImport(prop.PropertyType) && prop.PropertyType != type)
                {
                    var importStatement = $"import {{ {GetImportName(prop.PropertyType)} }} from \"./{GetImportName(prop.PropertyType)}\";";
                    
                    if (importStatments == string.Empty)
                    {
                        importStatments += importStatement;
                    }
                    else if (! importStatments.Contains(importStatement))
                    {
                        importStatments += Environment.NewLine + importStatement;
                    }

                    if (!processedTypes.Contains(prop.PropertyType))
                    {
                        ProcessType(prop.PropertyType, path);
                    }
                }
                classBodyBuilder.AppendLine($"   {prop.Name.ToLower()}: {GetPropType(prop.PropertyType)};");
            }
            classBodyBuilder.AppendLine("}");

            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();

            SaveTypescript(type, path, result);


            return result;
        }

        private static void SaveTypescript(TypeReference type, string path, string content)
        {
            var fileName = GetImportName(type);
            var fullPath = Path.Combine(path, fileName + ".ts");
            File.WriteAllText(fullPath, content, Encoding.UTF8);
        }

        private static bool ShouldImport(TypeReference type)
        {
            if (type.FullName.StartsWith("System"))
            {
                return false;
            }

            if (type.IsValueType)
            {
                return false;
            }

            if (type.IsPrimitive)
            {
                return false;
            }

            if (type.FullName == typeof(string).FullName)
            {
                return false;
            }

            return true;
        }

        private static string GetImportName(TypeReference type)
        {
            return $"{type.Name.Replace("`1", "")}";
        }

        private static string GetDefinition(TypeReference type)
        {
            return $"{type.Name.Replace("`1", "<T>")}";
        }

        private static string GetPropType(TypeReference type)
        {
            if (type.FullName == typeof(string).FullName || type.FullName == typeof(DateTime).FullName || type.FullName == typeof(DateTimeOffset).FullName)
            {
                return "string";
            }
            else if (type.FullName == typeof(int).FullName || type.FullName == typeof(double).FullName || type.FullName == typeof(float).FullName)
            {
                return "number";
            }
            else if (type.FullName.StartsWith("System.Collections.Generic"))
            {
                var att = type.Resolve().GenericParameters.First();
                return $"{att.Name}[]";
            }
            else if (type.ContainsGenericParameter)
            {
                var att = type.GenericParameters.LastOrDefault();
                return $"{type.Name.Replace("`1", "")}<{att.Name}>";
            }
            else
            {
                return type.Name.Replace("`1", ""); ;
            }
        }
    }
}
