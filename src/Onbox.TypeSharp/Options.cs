using CommandLine;

namespace Onbox.TypeSharp
{

    public class Options
    {
        [Option('s', "source", Required = true, HelpText = "The full path name of the folder to be converted and/or to be watched. Sub diretories will also be considered. This path is not case sensitive. Relative paths work.")]
        public string SourcePath { get; set; }

        [Option('f', "file-filter", Required = true, HelpText = "Filters the assemblies (just pure assembly names not full name) to be converted. This filter is not case sensitive.")]
        public string FileFilter { get; set; }

        [Option('t', "type-filter", Required = false, HelpText = "Filters the types (fully qualified names) to be converted. This filter is not case sensitive. Notice that if another model depends on ignored ones, they will still be converted.")]
        public string TypeFilter { get; set; }

        [Option('d', "destination", Required = true, HelpText = "The full path name of the folder where the Typescript files will be saved. Relative paths work.")]
        public string DestinationPath { get; set; }

        [Option('w', "watch", Required = false, HelpText = "Tells the app to watch the destination folder and re-run everytime something changes.")]
        public bool Watch { get; set; }

        [Option('m', "export-module", Required = false, HelpText = "Creates an exports module file containing all converted models.")]
        public bool ExportModule { get; set; }
    }

}
