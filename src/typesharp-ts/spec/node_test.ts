import test from "node:test";
import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("generates sample outputs for current golden DTOs", async () => {
  const temp = await mkdtemp(join(tmpdir(), "typesharp-"));
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    await convert({
      source: join(root, "samples/SampleModels"),
      fileFilter: "*.cs",
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
      "-d",
      "out",
      "-w",
      "-m",
      "--dictionary-style",
      "record",
      "--readonly-properties",
      "--quote-style=single",
      "--no-semicolons",
    ]),
    {
      configPath: "./config/tssharp.json",
      source: "samples",
      fileFilter: "*.cs",
      typeFilter: "Person*",
      destination: "out",
      watch: true,
      exportModule: true,
      dictionaryStyle: "record",
      readonlyProperties: true,
      quoteStyle: "single",
      semicolons: false,
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
        destination: "generated",
        exportModule: true,
        dictionaryStyle: "index-signature",
        readonlyProperties: true,
      }),
    );

    const options = await resolveOptions(["--dictionary-style", "record"], temp);
    assert.deepEqual(options, {
      source: join(temp, "models"),
      fileFilter: "*.cs",
      destination: join(temp, "generated"),
      typeFilter: undefined,
      watch: false,
      exportModule: true,
      dictionaryStyle: "record",
      readonlyProperties: true,
      quoteStyle: undefined,
      semicolons: undefined,
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
      destination: join(temp, "generated"),
      typeFilter: undefined,
      watch: false,
      exportModule: false,
      dictionaryStyle: undefined,
      readonlyProperties: undefined,
      quoteStyle: undefined,
      semicolons: undefined,
    });
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
