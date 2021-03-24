using System;

namespace SampleModels.Event
{
    public class ClassWithEvents
    {
        public Action TestDelegate { get; set; }
        public Delegate TestDelegate2 { get; set; }

    }
}
