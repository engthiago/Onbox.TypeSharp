# TypeScript DTO Parser Rewrite Plan

  ## Summary

  Preserve the current .NET implementation and add a new TypeScript implementation under src/typesharp-ts. The new
  tool will run with deno run, parse simple C# DTO source files, and support the same CLI arguments currently exposed
  by TypeSharp.

  ## Key Changes

  - Keep existing C# project untouched:
      - Do not remove or rewrite src/Onbox.TypeSharp.
      - Add the TypeScript implementation as a parallel project in src/typesharp-ts.
  - Implement a Deno-based CLI:
      - Entry command should support deno run --allow-read --allow-write src/typesharp-ts/main.ts ....
      - Support current args: --source/-s, --file-filter/-f, --type-filter/-t, --destination/-d, --watch/-w, and
        --export-module/-m.
      - Interpret --source as a folder containing .cs files.
      - Interpret --file-filter as a source-file glob/filter, preserving current intent but targeting .cs files rather
        than assemblies.
  - Implement a simple C# DTO parser:
      - Tokenize identifiers, keywords, strings, numbers, punctuation, brackets, comments, and attributes.
      - Parse namespace, public class, generic classes, optional base class, public enum, attributes, and public auto-
        properties.
      - Support type expressions: primitives, object, DateTime, nullable shorthand, arrays, List<T>, IEnumerable<T>,
        Dictionary<TKey,TValue>, nested generics, and parsed custom DTO/enum names.
  - Preserve comment metadata for future versions:
      - Recognize //, /* */, and /// comments as trivia.
      - Store optional leadingComments / trailingComments on AST nodes.
      - Do not emit comments in v1.
  - Generate TypeScript matching current behavior:
      - One .ts file per DTO/enum.
      - Interfaces use camel-cased property names.
      - Referenced DTOs/enums generate imports.
      - Attributes support [Optional], [Nullable], [UnknownObject], [Partial], and [TypeUnion(...)].
      - --export-module creates an aggregate module file.

  ## Supported Scope

  - Supported C# input is simple DTO source only: public classes, public enums, auto-properties, attributes, simple
    inheritance, and generic type declarations.
    arbitrary C# expressions.
  - Type resolution is source-based: only parsed .cs files and known framework DTO-ish types are resolved.

  ## Test Plan

  - Add Deno tests under src/typesharp-ts.
  - Use samples/SampleModels as golden input and compare generated output with existing samples/SampleModels/
    Typescript.
  - Add focused parser tests for nested generics, arrays, dictionaries, enums, attributes, inheritance, self-
    references, and comments ignored by v1.
  - Add CLI tests for all current supported args.
  - Add negative tests for unsupported syntax with clear diagnostics.

  ## Assumptions

  - The Deno TypeScript implementation is additive and does not replace the current .NET implementation yet.
  - The v1 TypeScript tool targets simple .cs DTO source files, not compiled assemblies.
  - Current CLI argument names remain stable, but their source interpretation changes from assemblies to C# source
    files.
  - Comments are preserved in parser metadata but not emitted in v1.
