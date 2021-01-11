using CommandLine;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace Onbox.TypeSharp
{

    partial class Program
    {
        private static readonly Dictionary<Type, string> imports = new Dictionary<Type, string>();
        private static readonly HashSet<Type> processedTypes = new HashSet<Type>();

        private static string output;

        private static void ClearCache()
        {
            imports.Clear();
            processedTypes.Clear();
        }

        static void Main(string[] args)
        {
            Parser.Default.ParseArguments<Options>(args)
                   .WithParsed(options =>
                   {
                       if (options.Watch)
                       {
                           WatchAssemblies(options);
                       }
                       else
                       {
                           try
                           {
                               Console.WriteLine($"Path {options.Path}");
                               output = options.DestinationPath;
                               var filtererAssemblies = Directory.GetFiles(options.Path, options.Filter);
                               foreach (var assemblyPath in filtererAssemblies)
                               {
                                   WriteTypes(assemblyPath);
                               }
                           }
                           catch (Exception ex)
                           {
                               Console.WriteLine($"Exception: {ex.Message}");
                               Console.WriteLine($"Trace: {ex.StackTrace}");
                           }
                           ClearCache();
                       }
                   });
        }

        private static void WatchAssemblies(Options options)
        {
            using (var watcher = new FileSystemWatcher())
            {
                watcher.Path = options.Path;
                watcher.Filter = options.Filter;
                watcher.NotifyFilter = NotifyFilters.LastAccess | NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.DirectoryName;

                output = options.DestinationPath;

                watcher.Created += OnModelsChanged;
                watcher.EnableRaisingEvents = true;

                Console.WriteLine("Press 'q' to quit.");
                while (Console.Read() != 'q') ;
            }
        }

        private static void OnModelsChanged(object sender, FileSystemEventArgs e)
        {
            Console.WriteLine($"File: {e.FullPath} {e.ChangeType}");
            Task.Factory.StartNew(() =>
            {
                Task.Delay(300);
                try
                {
                    WriteTypes(e.FullPath);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Exception: {ex.Message}");
                    Console.WriteLine($"Trace: {ex.StackTrace}");
                }
                ClearCache();
            });
        }

        public static byte[] GetBytes(Stream input)
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

        private static void WriteTypes(string fullPath)
        {
            using (FileStream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read))
            {
                var byteArr = GetBytes(stream);
                var assembly = Assembly.Load(byteArr);

                var types = assembly.GetExportedTypes();

                var models = types
                    .Where(t => t.GetConstructors().Where(c => c.IsPublic && c.GetParameters().Length == 0).Any() || t.IsEnum);

                foreach (var type in models)
                {
                    if (!processedTypes.Contains(type))
                    {
                        ProcessType(type, output);
                    }
                }
            }
        }

        private static string ProcessController(Type type, string path)
        {
            Console.WriteLine($"Mapping Controller: {type.Name}");
            var importStatments = string.Empty;
            var classBodyBuilder = new StringBuilder();

            classBodyBuilder.AppendLine();
            classBodyBuilder.AppendLine("@Injectable({");
            classBodyBuilder.AppendLine("   providedIn: 'root'");
            classBodyBuilder.AppendLine("})");
            classBodyBuilder.AppendLine($"export class {GetDefinition(type).Replace("Controller", "Service")}" + " {");
            var meths = type.GetMethods();
            foreach (var meth in meths)
            {
                var attr = meth.GetCustomAttributes();
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

            //SaveTypescript(type, path, result);

            processedTypes.Add(type);
            return result;
        }

        private static string ProcessType(Type type, string path)
        {
            if (type.IsEnum)
            {
                return ProcessEnum(type, path);
            }

            return ProcessClass(type, path);
        }

        private static string ProcessEnum(Type type, string path)
        {
            var enumBodyBuilder = new StringBuilder();

            var values = type.GetEnumValues();

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

        private static string ProcessClass(Type type, string path)
        {
            var importStatments = string.Empty;

            var classBodyBuilder = new StringBuilder();
            var props = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);

            classBodyBuilder.AppendLine();
            classBodyBuilder.AppendLine($"export interface {GetDefinition(type)}" + " {");
            foreach (var prop in props)
            {
                if (ShouldImport(prop.PropertyType) && prop.PropertyType != type)
                {
                    var importStatement = $"import {{ {GetImportName(prop.PropertyType)} }} from \"./{GetImportName(prop.PropertyType)}\"";

                    if (importStatments == string.Empty)
                    {
                        importStatments += importStatement;
                    }
                    else if (!importStatments.Contains(importStatement))
                    {
                        importStatments += Environment.NewLine + importStatement;
                    }

                    if (!processedTypes.Contains(prop.PropertyType))
                    {
                        ProcessType(prop.PropertyType, path);
                    }
                }
                classBodyBuilder.AppendLine($"   {ConvertToCamelCase(prop.Name)}: {GetPropType(prop.PropertyType)};");
            }
            classBodyBuilder.AppendLine("}");

            var result = importStatments.Any() ? importStatments + Environment.NewLine + classBodyBuilder.ToString() : classBodyBuilder.ToString();

            SaveTypescript(type, path, result);

            processedTypes.Add(type);

            return result;
        }

        private static void SaveTypescript(Type type, string path, string content)
        {
            var fileName = GetImportName(type);
            var enumPart = type.IsEnum ? ".enum" : "";
            var fullPath = Path.Combine(path, fileName + enumPart + ".ts");
            File.WriteAllText(fullPath, content, Encoding.UTF8);
        }

        private static bool ShouldImport(Type type)
        {
            var constructor = type.GetConstructor(Type.EmptyTypes);
            if (constructor == null)
            {
                return false;
            }
            else
            {
                if (type.GetInterfaces().Any(type => type == typeof(IList)))
                {
                    return false;
                }
                return true;
            }
        }

        private static string GetImportName(Type type)
        {
            return $"{type.Name.Replace("`1", "")}";
        }

        private static string GetDefinition(Type type)
        {
            return $"{type.Name.Replace("`1", "<T>")}";
        }

        private static string GetPropType(Type type)
        {
            if (type == typeof(string) || type == typeof(DateTime) || type == typeof(DateTimeOffset))
            {
                return "string";
            }
            else if (type == typeof(int) || type == typeof(double) || type == typeof(float))
            {
                return "number";
            }
            else if (type.GetInterfaces().Any(type => type == typeof(IList)))
            {
                var att = type.GetGenericArguments().LastOrDefault();
                return $"{att.Name}[]";
            }
            else if (type.IsGenericType)
            {
                var att = type.GetGenericArguments().LastOrDefault();
                return $"{type.Name.Replace("`1", "")}<{att.Name}>";
            }
            else if (type.IsClass)
            {
                return type.Name;
            }

            return null;
        }

        private static string ConvertToCamelCase(string s)
        {
            if (string.IsNullOrEmpty(s) || !char.IsUpper(s[0]))
            {
                return s;
            }

            var chars = s.ToCharArray();

            for (var i = 0; i < chars.Length; i++)
            {
                if (i == 1 && !char.IsUpper(chars[i]))
                {
                    break;
                }

                var hasNext = i + 1 < chars.Length;
                if (i > 0 && hasNext && !char.IsUpper(chars[i + 1]))
                {
                    break;
                }

                chars[i] = char.ToLower(chars[i], CultureInfo.InvariantCulture);
            }

            return new string(chars);
        }
    }
}
