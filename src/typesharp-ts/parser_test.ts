import { parseSourceFile } from "./parser.ts";
import { generate } from "./generator.ts";
import { convert, parseArgs } from "./main.ts";

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
      "--source",
      "samples",
      "-f",
      "*.cs",
      "--type-filter=Person*",
      "-d",
      "out",
      "-w",
      "-m",
    ]),
    {
      source: "samples",
      fileFilter: "*.cs",
      typeFilter: "Person*",
      destination: "out",
      watch: true,
      exportModule: true,
    },
  );
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
