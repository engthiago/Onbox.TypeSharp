using CommandLine;

namespace Onbox.TypeSharp
{

    public class Options
    {
        [Option('s', "source", Required = true, HelpText = "The full path name of the folder to be converted and/or to be watched.")]
        public string SourcePath { get; set; }

        [Option('f', "file-filter", Required = true, HelpText = "Filters the assemblies (just pure assembly names not full name) to be converted.")]
        public string FileFilter { get; set; }

        [Option('t', "type-filter", Required = false, HelpText = "Filters the types (fully qualified names) to be converted.")]
        public string TypeFilter { get; set; }

        [Option('d', "destination", Required = true, HelpText = "The full path name of the folder where the Typescript files will be saved.")]
        public string DestinationPath { get; set; }

        [Option('w', "watch", Required = false, HelpText = "Tells the app to watch the destination folder and re-run everytime something changes.")]
        public bool Watch { get; set; }
    }

}
