using CommandLine;

namespace Onbox.TypeSharp
{

    public class Options
    {
        [Option('s', "source", Required = true, HelpText = "The path of the folder to be converted.")]
        public string SourcePath { get; set; }

        [Option('f', "file-filter", Required = true, HelpText = "Filters the assemblies (just pure names) to be converted.")]
        public string FileFilter { get; set; }

        [Option('t', "type-filter", Required = false, HelpText = "Filters the types (fully qualified names) to be converted.")]
        public string TypeFilter { get; set; }

        [Option('d', "destination", Required = true, HelpText = "The path of the folder where the Typescript files will be saved.")]
        public string DestinationPath { get; set; }

        [Option('w', "watch", Required = false, HelpText = "The app will be watching the folder and re-run everytime something changes.")]
        public bool Watch { get; set; }
    }

}
