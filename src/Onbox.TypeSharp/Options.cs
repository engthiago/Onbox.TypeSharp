using CommandLine;

namespace Onbox.TypeSharp
{

    public class Options
    {
        [Option('s', "source", Required = true, HelpText = "The path of the folder to be watched.")]
        public string SourcePath { get; set; }

        [Option('f', "filter", Required = true, HelpText = "The names of the assemblies to be watched.")]
        public string Filter { get; set; }

        [Option('d', "destination", Required = true, HelpText = "The destination path.")]
        public string DestinationPath { get; set; }

        //[Option('c', "controllers", Required = false, HelpText = "Map Aspnet Core Controllers.")]
        //public bool MapControllers { get; set; }

        [Option('w', "watch", Required = false, HelpText = "")]
        public bool Watch { get; set; }
    }

}
