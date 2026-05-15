# Onbox.TypeSharp

Convert C# DTO source files into TypeScript interfaces and enums.

TypeSharp is a Deno-powered TypeScript CLI. It reads `.cs` files directly, parses simple DTO models, and writes one `.ts` file per DTO or enum.

![Example Image](src/Onbox.TypeSharp/Example.png)

## Requirements

- [Deno](https://deno.com/)

## Usage

Run TypeSharp with Deno:

```bash
deno run --allow-read --allow-write src/typesharp-ts/main.ts \
  --source "./samples/SampleModels" \
  --file-filter "*.cs" \
  --destination "./samples/SampleModels/Typescript" \
  --export-module
```

Or use a config file:

```bash
deno run --allow-read --allow-write src/typesharp-ts/main.ts --config "./typesharp.json"
```

When `--config` is not provided, TypeSharp reads `typesharp.json` from the current folder if it exists. Command-line options override config file values.

## Command-Line Options

`-c`, `--config` optional  
Path to a JSON configuration file. Default: `./typesharp.json` when that file exists.

`-s`, `--source` required unless set in config  
Folder containing `.cs` files. Subfolders are included.

`-f`, `--file-filter` optional  
Glob-style filter for source files, such as `*.cs` or `*Dto.cs`. Default: `*.cs`.

`-t`, `--type-filter` optional  
Glob-style filter for parsed type names, such as `Person*`. Default: all parsed types.

`-d`, `--destination` required unless set in config  
Folder where generated TypeScript files are written.

`-w`, `--watch` optional  
Watches the source folder and regenerates when `.cs` files change. Default: `false`.

`-m`, `--export-module` optional  
Creates an aggregate module file that re-exports generated files. Default: `false`.

`--dictionary-style` optional  
Controls dictionary output. Options: `index-signature`, `record`. Default: `index-signature`.

`--readonly-properties` optional  
Emits all interface properties as `readonly`. Default: `false`.

`--quote-style` optional  
Controls generated string quotes. Options: `double`, `single`. Default: `double`.

`--semicolons`, `--no-semicolons` optional  
Controls semicolons on generated TypeScript statements. Options: `true`, `false`. Default: `true`.

## Configuration File

Create `typesharp.json`:

```json
{
  "source": "./samples/SampleModels",
  "fileFilter": "*.cs",
  "typeFilter": "*",
  "destination": "./samples/SampleModels/Typescript",
  "watch": false,
  "exportModule": true,
  "dictionaryStyle": "record",
  "readonlyProperties": false,
  "quoteStyle": "double",
  "semicolons": true
}
```

Run with the default config path:

```bash
deno run --allow-read --allow-write src/typesharp-ts/main.ts
```

Run with a custom config path:

```bash
deno run --allow-read --allow-write src/typesharp-ts/main.ts --config "./config/tssharp.json"
```

Override config values from the command line:

```bash
deno run --allow-read --allow-write src/typesharp-ts/main.ts \
  --config "./config/tssharp.json" \
  --dictionary-style record \
  --readonly-properties \
  --quote-style single \
  --no-semicolons
```

## Supported C# Input

TypeSharp supports DTO-focused C# source files:

- `namespace`
- `public class`
- generic classes
- simple inheritance
- `public enum`
- attributes
- public auto-properties
- primitive types
- `object`
- `DateTime` and `DateTimeOffset`
- nullable shorthand, such as `int?`
- arrays
- `List<T>` and other common collection interfaces
- `Dictionary<TKey, TValue>`
- nested generics
- custom DTO and enum references parsed from source

## Supported Attributes

TypeSharp recognizes these attributes on properties:

- `[Optional]` emits an optional TypeScript property.
- `[Nullable]` adds `| null`.
- `[UnknownObject]` emits `unknown`.
- `[Partial]` wraps the property type in `Partial<T>`.
- `[TypeUnion(...)]` emits literal unions.
- `[Readonly]` or `[ReadOnly]` emits a readonly property.

TypeSharp also recognizes these attributes on classes:

- `[Readonly]`, `[ReadOnly]`, or `[ReadonlyProperties]` emits all properties on that interface as readonly.

## Examples

C# input:

```csharp
namespace SampleModels.Models
{
    [Readonly]
    public class Person
    {
        public string Name { get; set; }
        public Dictionary<string, Address> Addresses { get; set; }

        [Optional]
        [TypeUnion("admin", "user")]
        public string Role { get; set; }
    }
}
```

Generated TypeScript with `dictionaryStyle` set to `record`:

```ts
import { Address } from "./Address";

export interface Person {
   readonly name: string;
   readonly addresses: Record<string, Address>;
   readonly role?: "admin" | "user";
}
```

Aggregate module output:

```ts
export * from "./Address";
export * from "./Person";
```

## Development

Format:

```bash
deno fmt src/typesharp-ts
```

Lint:

```bash
deno lint src/typesharp-ts
```

Test:

```bash
deno test --allow-read --allow-write src/typesharp-ts
```
