import { test } from "vitest";
import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSourceFile } from "../src/parser.ts";
import { generate } from "../src/generator.ts";
import { convert, parseArgs, resolveOptions } from "../src/main.ts";

test("parses classes, attributes, comments, inheritance, and type expressions", () => {
  const file = parseSourceFile(
    "dto.cs",
    `
namespace Demo.Models
{
  /// model docs
  public class Person<T> : Entity {
    // name docs
    [Optional] public string Name { get; set; } // trailing
    [Nullable] public DateTime? Born { get; set; }
    [UnknownObject] public object Payload { get; set; }
    [Partial] public Dictionary<string, List<SubPerson[]>> Children { get; set; }
    [TypeUnion("one", "two")] public string Kind { get; set; }
  }
}`,
  );

  const declaration = file.declarations[0];
  assert.equal(declaration.kind, "class");
  if (declaration.kind !== "class") throw new Error("Expected class");
  assert.equal(declaration.namespaceName, "Demo.Models");
  assert.deepEqual(declaration.typeParameters, ["T"]);
  assert.equal(declaration.baseType?.name, "Entity");
  assert.equal(declaration.leadingComments[0].kind, "doc");
  assert.equal(declaration.properties[0].leadingComments[0].kind, "line");
  assert.equal(declaration.properties[0].trailingComments[0].kind, "line");
  assert.equal(declaration.properties[3].type.args[1].args[0].arrayRank, 1);
});

test("generates TypeScript for nested generics, dictionaries, enums, and attributes", () => {
  const generated = new Map(generate([
    parseSourceFile(
      "person.cs",
      `
namespace Demo {
  public enum AccessLevel { Read = 0, Write = 1 }
  public class SubPerson { public string Name { get; set; } }
  public class GenericPerson<T> { public T Data { get; set; } }
  public class Person {
    [Optional] public string Company { get; set; }
    public int? Money { get; set; }
    public GenericPerson<GenericPerson<Person>> Data { get; set; }
    public Dictionary<string, SubPerson> Pairs { get; set; }
    public List<List<string>> Strings { get; set; }
    public AccessLevel AccessLevel { get; set; }
    [TypeUnion(1.2, 2.2)] public double Score { get; set; }
  }
}`,
    ),
  ]).map((file) => [file.name, file.text]));

  const person = generated.get("Person.ts")!;
  assert.match(person, /import \{ AccessLevel \} from "\.\/AccessLevel";/);
  assert.match(person, /import \{ GenericPerson \} from "\.\/GenericPerson";/);
  assert.match(person, /import \{ SubPerson \} from "\.\/SubPerson";/);
  assert.match(person, /company\?: string;/);
  assert.match(person, /money\?: number;/);
  assert.match(person, /data: GenericPerson<GenericPerson<Person>>;/);
  assert.match(person, /pairs: \{ \[key: string\]: SubPerson \};/);
  assert.match(person, /strings: string\[\]\[\];/);
  assert.match(person, /score: 1\.2 \| 2\.2;/);
});

test("supports signed enum values", () => {
  const generated = new Map(generate([
    parseSourceFile(
      "status.cs",
      `
public enum Status {
  Invalid = -1,
  None = 0,
  Valid = +1,
  Next
}`,
    ),
  ]).map((file) => [file.name, file.text]));

  const status = generated.get("Status.ts")!;
  assert.match(status, /Invalid = -1,/);
  assert.match(status, /None = 0,/);
  assert.match(status, /Valid = 1,/);
  assert.match(status, /Next = 2,/);
});

test("supports configured Record dictionaries, readonly properties, quotes, and semicolons", () => {
  const generated = new Map(generate([
    parseSourceFile(
      "person.cs",
      `
namespace Demo {
  public class SubPerson { public string Name { get; set; } }
  [Readonly]
  public class Person {
    public Dictionary<string, SubPerson> Pairs { get; set; }
    [TypeUnion("one", "two")] public string Kind { get; set; }
  }
}`,
    ),
  ], {
    dictionaryStyle: "record",
    quoteStyle: "single",
    semicolons: false,
    exportModule: true,
    moduleName: "Demo.Module",
  }).map((file) => [file.name, file.text]));

  const person = generated.get("Person.ts")!;
  assert.match(person, /import \{ SubPerson \} from '\.\/SubPerson'/);
  assert.match(person, /readonly pairs: Record<string, SubPerson>/);
  assert.match(person, /readonly kind: 'one' \| 'two'/);
  assert.match(generated.get("Demo.Module.ts")!, /export \* from '\.\/Person'/);
});

test("supports default and acronym-normalized property naming", () => {
  const files = [
    parseSourceFile(
      "report.cs",
      `
public class ULSReport {}
public class Report {
  public string SubCategory { get; set; }
  public ULSReport ULS { get; set; }
  public string URLValue { get; set; }
}`,
    ),
  ];

  const defaultReport = new Map(generate(files).map((file) => [file.name, file.text])).get("Report.ts")!;
  assert.match(defaultReport, /subCategory: string;/);
  assert.match(defaultReport, /uLS: ULSReport;/);
  assert.match(defaultReport, /uRLValue: string;/);

  const normalizedReport = new Map(
    generate(files, { normalizeAcronyms: true }).map((file) => [file.name, file.text]),
  ).get("Report.ts")!;
  assert.match(normalizedReport, /subCategory: string;/);
  assert.match(normalizedReport, /uls: ULSReport;/);
  assert.match(normalizedReport, /urlValue: string;/);
});

test("preserves comments only when enabled", () => {
  const files = [
    parseSourceFile(
      "commented.cs",
      `
/// <summary>Report docs</summary>
public class Report {
  // Property docs
  public string Name { get; set; } // trailing docs
  /// <summary>Count docs</summary>
  /* block docs */
  public int Count { get; set; }
}

/// <summary>Status docs</summary>
public enum Status {
  // Invalid docs
  Invalid = -1,
  /// <summary>Valid docs</summary>
  Valid = 1,
}
`,
    ),
  ];

  const defaultGenerated = new Map(generate(files).map((file) => [file.name, file.text]));
  assert.doesNotMatch(defaultGenerated.get("Report.ts")!, /Report docs|Property docs|trailing docs|block docs|Count docs/);
  assert.doesNotMatch(defaultGenerated.get("Status.ts")!, /Status docs|Invalid docs|Valid docs/);

  const preserved = new Map(generate(files, { preserveComments: true }).map((file) => [file.name, file.text]));
  assert.match(preserved.get("Report.ts")!, /\/\/\/ <summary>Report docs<\/summary>\nexport interface Report/);
  assert.match(preserved.get("Report.ts")!, /   \/\/ Property docs\n   name: string; \/\/ trailing docs/);
  assert.match(preserved.get("Report.ts")!, /   \/\/\/ <summary>Count docs<\/summary>\n   \/\* block docs \*\/\n   count: number;/);
  assert.match(preserved.get("Status.ts")!, /\/\/\/ <summary>Status docs<\/summary>\nexport enum Status/);
  assert.match(preserved.get("Status.ts")!, /   \/\/ Invalid docs\n   Invalid = -1,/);
  assert.match(preserved.get("Status.ts")!, /   \/\/\/ <summary>Valid docs<\/summary>\n   Valid = 1,/);
});

test("converts documentation comments without preserving ordinary comments", () => {
  const files = [
    parseSourceFile(
      "commented.cs",
      `
/// <summary>Report docs</summary>
/// <remarks>More details</remarks>
public class Report {
  // Ordinary comment
  /// <summary>Name docs</summary>
  public string Name { get; set; } // trailing docs
}
`,
    ),
  ];

  const generated = new Map(
    generate(files, { convertDocumentationComments: true }).map((file) => [file.name, file.text]),
  ).get("Report.ts")!;
  assert.match(generated, /\/\*\*\n \* Report docs\n \*\n \* More details\n \*\/\nexport interface Report/);
  assert.match(generated, /   \/\*\*\n    \* Name docs\n    \*\/\n   name: string;/);
  assert.doesNotMatch(generated, /Ordinary comment|trailing docs|\/\/\//);
});

test("supports property readonly attributes without global readonly", () => {
  const person = generate([
    parseSourceFile(
      "person.cs",
      `
public class Person {
  [ReadOnly] public string Id { get; set; }
  public string Name { get; set; }
}`,
    ),
  ])[0].text;
  assert.match(person, /readonly id: string;/);
  assert.match(person, /name: string;/);
});

test("supports interfaces and multiple implemented generic interfaces", () => {
  const generated = new Map(generate([
    parseSourceFile(
      "engineering.cs",
      `
using System.Collections.Generic;

namespace Shedmate.Designer.Models.Engineering.FEM
{
    public class EngineeringResult : IOptionalError<List<string>>, IOptionalWarning<List<string>>
    {
        public bool Done { get; set; }
        public bool Success { get; set ; }
        public List<string> Error { get; set; }
        public List<string> Warning { get; set; }
        public string Critical { get; set; }
    }

    public interface IOptionalError<T>
    {
        public bool Success { get; set; }
        public T Error { get; set;}
    }

    public interface IOptionalWarning<T>
    {
        public bool Success { get; set; }
        public T Warning { get; set;}
    }
}`,
    ),
  ]).map((file) => [file.name, file.text]));

  assert.match(
    generated.get("EngineeringResult.ts")!,
    /export interface EngineeringResult extends IOptionalError<string\[\]>, IOptionalWarning<string\[\]> \{/,
  );
  assert.match(generated.get("IOptionalError.ts")!, /export interface IOptionalError<T> \{/);
  assert.match(generated.get("IOptionalError.ts")!, /error: T;/);
  assert.match(generated.get("IOptionalWarning.ts")!, /warning: T;/);
});

test("inlines inherited properties when configured", () => {
  const files = [
    parseSourceFile(
      "instances.cs",
      `
namespace Demo {
  public class Vector3d { public double X { get; set; } }
  public class WasherInstance { public string Name { get; set; } }
  public class EntityInstance {
    public string Guid { get; set; }
    public string Name { get; set; }
  }
  public class BoltInstance : EntityInstance {
    public Vector3d Normal { get; set; }
    public double Length { get; set; }
    public List<WasherInstance> Washers { get; set; }
  }
  public class AnchorBoltInstance : BoltInstance {
    public string JustificationX { get; set; }
  }
  public interface IOptionalError<T> {
    public T Error { get; set; }
  }
  public class EngineeringResult : IOptionalError<List<string>> {
    public bool Done { get; set; }
  }
}`,
    ),
  ];

  const defaultAnchor = new Map(generate(files).map((file) => [file.name, file.text])).get("AnchorBoltInstance.ts")!;
  assert.match(defaultAnchor, /justificationX: string;/);
  assert.doesNotMatch(defaultAnchor, /normal: Vector3d;|guid: string;/);

  const generated = new Map(
    generate(files, { inlineInheritedProperties: true }).map((file) => [file.name, file.text]),
  );
  const anchor = generated.get("AnchorBoltInstance.ts")!;
  assert.match(anchor, /import \{ BoltInstance \} from "\.\/BoltInstance";/);
  assert.match(anchor, /import \{ Vector3d \} from "\.\/Vector3d";/);
  assert.match(anchor, /import \{ WasherInstance \} from "\.\/WasherInstance";/);
  assert.match(anchor, /justificationX: string;/);
  assert.match(anchor, /normal: Vector3d;/);
  assert.match(anchor, /length: number;/);
  assert.match(anchor, /washers: WasherInstance\[\];/);
  assert.match(anchor, /guid: string;/);
  assert.match(anchor, /name: string;/);

  const result = generated.get("EngineeringResult.ts")!;
  assert.match(result, /done: boolean;/);
  assert.match(result, /error: string\[\];/);
});

test("generates sample outputs for current golden DTOs", async () => {
  const temp = await mkdtemp(join(tmpdir(), "typesharp-"));
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    await convert({
      source: join(root, "samples/SampleModels"),
      fileFilter: "*.cs",
      excludePatterns: [],
      destination: temp,
      watch: false,
      exportModule: false,
      dictionaryStyle: "record",
    });
    const actualPerson = await readFile(join(temp, "Person.ts"), "utf8");
    const expectedPerson = (await readFile(join(root, "samples/SampleModels/Typescript/Person.ts"), "utf8")).replace(
      /^\uFEFF/,
      "",
    );
    assert.equal(actualPerson, expectedPerson);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("supports current CLI arguments", () => {
  assert.deepEqual(
    parseArgs([
      "--config",
      "./config/tssharp.json",
      "--source",
      "samples",
      "-f",
      "*.cs",
      "--type-filter=Person*",
      "--exclude-pattern",
      "*Attributes.cs",
      "-x=*Internal.cs",
      "-d",
      "out",
      "-w",
      "-m",
      "--dictionary-style",
      "record",
      "--readonly-properties",
      "--quote-style=single",
      "--no-semicolons",
      "--normalize-acronyms",
      "--preserve-comments",
      "--convert-documentation-comments",
      "--inline-inherited-properties",
    ]),
    {
      configPath: "./config/tssharp.json",
      source: "samples",
      fileFilter: "*.cs",
      excludePatterns: ["*Attributes.cs", "*Internal.cs"],
      typeFilter: "Person*",
      destination: "out",
      watch: true,
      exportModule: true,
      dictionaryStyle: "record",
      readonlyProperties: true,
      quoteStyle: "single",
      semicolons: false,
      normalizeAcronyms: true,
      preserveComments: true,
      convertDocumentationComments: true,
      inlineInheritedProperties: true,
    },
  );
});

test("loads typesharp.json and lets CLI override file values", async () => {
  const temp = await mkdtemp(join(tmpdir(), "typesharp-"));
  try {
    await writeFile(
      join(temp, "typesharp.json"),
      JSON.stringify({
        source: "models",
        fileFilter: "*.cs",
        excludePatterns: ["*Attributes.cs", "*Internal.cs"],
        destination: "generated",
        exportModule: true,
        dictionaryStyle: "index-signature",
        readonlyProperties: true,
        normalizeAcronyms: true,
        preserveComments: true,
        convertDocumentationComments: true,
        inlineInheritedProperties: true,
      }),
    );

    const options = await resolveOptions(["--dictionary-style", "record"], temp);
    assert.deepEqual(options, {
      source: join(temp, "models"),
      fileFilter: "*.cs",
      excludePatterns: ["*Attributes.cs", "*Internal.cs"],
      destination: join(temp, "generated"),
      typeFilter: undefined,
      watch: false,
      exportModule: true,
      dictionaryStyle: "record",
      readonlyProperties: true,
      quoteStyle: undefined,
      semicolons: undefined,
      normalizeAcronyms: true,
      preserveComments: true,
      convertDocumentationComments: true,
      inlineInheritedProperties: true,
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("defaults fileFilter to C# source files", async () => {
  const temp = await mkdtemp(join(tmpdir(), "typesharp-"));
  try {
    await writeFile(
      join(temp, "typesharp.json"),
      JSON.stringify({
        source: "models",
        destination: "generated",
      }),
    );

    const options = await resolveOptions([], temp);
    assert.deepEqual(options, {
      source: join(temp, "models"),
      fileFilter: "*.cs",
      excludePatterns: [],
      destination: join(temp, "generated"),
      typeFilter: undefined,
      watch: false,
      exportModule: false,
      dictionaryStyle: undefined,
      readonlyProperties: undefined,
      quoteStyle: undefined,
      semicolons: undefined,
      normalizeAcronyms: undefined,
      preserveComments: undefined,
      convertDocumentationComments: undefined,
      inlineInheritedProperties: undefined,
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("excludes source files by configured patterns", async () => {
  const temp = await mkdtemp(join(tmpdir(), "typesharp-"));
  try {
    const source = join(temp, "models");
    const destination = join(temp, "generated");
    await writeFile(join(temp, "typesharp.json"), JSON.stringify({
      source: "models",
      destination: "generated",
      excludePatterns: ["*Attributes.cs", "Internal/*Internal.cs"],
    }));
    await mkdir(join(source, "Internal"), { recursive: true });
    await writeFile(join(source, "Person.cs"), "public class Person { public string Name { get; set; } }");
    await writeFile(
      join(source, "OptionalAttributes.cs"),
      "public class OptionalAttributes { public string Name { get; set; } }",
    );
    await writeFile(
      join(source, "Internal", "HiddenInternal.cs"),
      "public class HiddenInternal { public string Name { get; set; } }",
    );

    const options = await resolveOptions([], temp);
    await convert(options);

    assert.equal(await readFile(join(destination, "Person.ts"), "utf8").then(() => true), true);
    await assert.rejects(() => readFile(join(destination, "OptionalAttributes.ts"), "utf8"), /ENOENT/);
    await assert.rejects(() => readFile(join(destination, "HiddenInternal.ts"), "utf8"), /ENOENT/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("fails clearly on unsupported property bodies", () => {
  assert.throws(
    () => parseSourceFile("bad.cs", 'public class Bad { public string Name { get { return "x"; } set { } } }'),
    /Only public auto-properties/,
  );
});
