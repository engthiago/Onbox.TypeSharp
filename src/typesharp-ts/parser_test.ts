import { parseSourceFile } from "./parser.ts";
import { generate } from "./generator.ts";
import { convert, parseArgs, resolveOptions } from "./main.ts";

Deno.test("parses classes, attributes, comments, inheritance, and type expressions", () => {
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
  assertEquals(declaration.kind, "class");
  if (declaration.kind !== "class") throw new Error("Expected class");
  assertEquals(declaration.namespaceName, "Demo.Models");
  assertEquals(declaration.typeParameters, ["T"]);
  assertEquals(declaration.baseType?.name, "Entity");
  assertEquals(declaration.leadingComments[0].kind, "doc");
  assertEquals(declaration.properties[0].leadingComments[0].kind, "line");
  assertEquals(declaration.properties[0].trailingComments[0].kind, "line");
  assertEquals(declaration.properties[3].type.args[1].args[0].arrayRank, 1);
});

Deno.test("generates TypeScript for nested generics, dictionaries, enums, and attributes", () => {
  const files = [
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
  ];

  const generated = new Map(generate(files).map((file) => [file.name, file.text]));
  const person = generated.get("Person.ts")!;
  assertStringIncludes(person, `import { AccessLevel } from "./AccessLevel";`);
  assertStringIncludes(person, `import { GenericPerson } from "./GenericPerson";`);
  assertStringIncludes(person, `import { SubPerson } from "./SubPerson";`);
  assertStringIncludes(person, `company?: string;`);
  assertStringIncludes(person, `money?: number;`);
  assertStringIncludes(person, `data: GenericPerson<GenericPerson<Person>>;`);
  assertStringIncludes(person, `pairs: { [key: string]: SubPerson };`);
  assertStringIncludes(person, `strings: string[][];`);
  assertStringIncludes(person, `score: 1.2 | 2.2;`);
});

Deno.test("supports configured Record dictionaries, readonly properties, quotes, and semicolons", () => {
  const files = [
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
  ];

  const generated = new Map(
    generate(files, {
      dictionaryStyle: "record",
      quoteStyle: "single",
      semicolons: false,
      exportModule: true,
      moduleName: "Demo.Module",
    }).map((file) => [file.name, file.text]),
  );
  const person = generated.get("Person.ts")!;
  assertStringIncludes(person, `import { SubPerson } from './SubPerson'`);
  assertStringIncludes(person, `readonly pairs: Record<string, SubPerson>`);
  assertStringIncludes(person, `readonly kind: 'one' | 'two'`);
  assertStringIncludes(generated.get("Demo.Module.ts")!, `export * from './Person'`);
});

Deno.test("supports property readonly attributes without global readonly", () => {
  const files = [
    parseSourceFile(
      "person.cs",
      `
public class Person {
  [ReadOnly] public string Id { get; set; }
  public string Name { get; set; }
}`,
    ),
  ];

  const person = generate(files)[0].text;
  assertStringIncludes(person, `readonly id: string;`);
  assertStringIncludes(person, `name: string;`);
});

Deno.test("generates sample outputs for current golden DTOs", async () => {
  const temp = await Deno.makeTempDir();
  try {
    const root = new URL("../../", import.meta.url).pathname;
    await convert({
      source: `${root}samples/SampleModels`,
      fileFilter: "*.cs",
      destination: temp,
      watch: false,
      exportModule: false,
    });
    const actualPerson = await Deno.readTextFile(`${temp}/Person.ts`);
    const expectedPerson = (await Deno.readTextFile(`${root}samples/SampleModels/Typescript/Person.ts`)).replace(
      /^\uFEFF/,
      "",
    );
    assertEquals(actualPerson, expectedPerson);
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

function assertEquals<T>(actual: T, expected: T): void {
  const actualJson = JSON.stringify(sortValue(actual));
  const expectedJson = JSON.stringify(sortValue(expected));
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

function assertStringIncludes(actual: string, expected: string): void {
  if (!actual.includes(expected)) throw new Error(`Expected string to include ${JSON.stringify(expected)}\n${actual}`);
}

async function assertRejects(
  fn: () => Promise<unknown> | unknown,
  errorType: typeof Error,
  message: string,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof errorType)) throw new Error(`Expected ${errorType.name}, received ${error}`);
    if (!String(error.message).includes(message)) {
      throw new Error(`Expected error message to include ${JSON.stringify(message)}, received ${error.message}`);
    }
    return;
  }
  throw new Error("Expected function to reject");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map((
        [key, inner],
      ) => [key, sortValue(inner)]),
    );
  }
  return value;
}

Deno.test("supports current CLI arguments", () => {
  assertEquals(
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

Deno.test("loads typesharp.json and lets CLI override file values", async () => {
  const temp = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(
      `${temp}/typesharp.json`,
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
    assertEquals(options, {
      source: `${temp}/models`,
      fileFilter: "*.cs",
      destination: `${temp}/generated`,
      watch: false,
      exportModule: true,
      dictionaryStyle: "record",
      readonlyProperties: true,
    });
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
});

Deno.test("fails clearly on unsupported property bodies", async () => {
  await assertRejects(
    () => {
      parseSourceFile("bad.cs", 'public class Bad { public string Name { get { return "x"; } set { } } }');
    },
    Error,
    "Only public auto-properties",
  );
});
