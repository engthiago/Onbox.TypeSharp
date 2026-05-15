import { parseSourceFile } from "./parser.ts";
import { generate } from "./generator.ts";

export interface CliOptions {
  source: string;
  fileFilter: string;
  destination: string;
  typeFilter?: string;
  watch: boolean;
  exportModule: boolean;
}

export async function run(args: string[]): Promise<void> {
  const options = parseArgs(args);
  await convert(options);
  if (options.watch) {
    console.log(`Watching ${options.source}`);
    const watcher = Deno.watchFs(options.source);
    for await (const event of watcher) {
      if (event.paths.some((path) => path.endsWith(".cs"))) {
        await convert(options);
      }
    }
  }
}

export async function convert(options: CliOptions): Promise<void> {
  const sourceFiles = await findCSharpFiles(options.source, options.fileFilter);
  const parsed = [];
  for (const path of sourceFiles) {
    parsed.push(parseSourceFile(path, await Deno.readTextFile(path)));
  }
  const filtered = options.typeFilter
    ? parsed.map((file) => ({
      ...file,
      declarations: file.declarations.filter((declaration) => matchesFilter(declaration.name, options.typeFilter!)),
    }))
    : parsed;
  const moduleName = basename(normalize(options.source)).replace(/\.[^.]+$/, "") || "TypeSharp.Module";
  const files = generate(filtered, { exportModule: options.exportModule, moduleName: `${moduleName}.Module` });
  await Deno.mkdir(options.destination, { recursive: true });
  for (const file of files) {
    await Deno.writeTextFile(join(options.destination, file.name), file.text);
  }
}

export function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string | boolean>();
  const aliases: Record<string, string> = {
    s: "source",
    f: "file-filter",
    t: "type-filter",
    d: "destination",
    w: "watch",
    m: "export-module",
  };
  const booleanFlags = new Set(["watch", "export-module"]);

  for (let i = 0; i < args.length; i++) {
    const raw = args[i];
    if (!raw.startsWith("-")) throw new Error(`Unexpected argument: ${raw}`);
    const trimmed = raw.replace(/^-+/, "");
    const [flagName, inlineValue] = trimmed.split("=", 2);
    const name = aliases[flagName] ?? flagName;
    if (booleanFlags.has(name)) {
      values.set(name, inlineValue ?? true);
    } else {
      const value = inlineValue ?? args[++i];
      if (!value || value.startsWith("-")) throw new Error(`Missing value for --${name}`);
      values.set(name, value);
    }
  }

  const source = values.get("source");
  const fileFilter = values.get("file-filter");
  const destination = values.get("destination");
  if (typeof source !== "string") throw new Error("Missing required argument --source");
  if (typeof fileFilter !== "string") throw new Error("Missing required argument --file-filter");
  if (typeof destination !== "string") throw new Error("Missing required argument --destination");
  const typeFilter = values.get("type-filter");
  return {
    source,
    fileFilter,
    destination,
    typeFilter: typeof typeFilter === "string" ? typeFilter : undefined,
    watch: Boolean(values.get("watch")),
    exportModule: Boolean(values.get("export-module")),
  };
}

async function findCSharpFiles(source: string, filter: string): Promise<string[]> {
  const files: string[] = [];
  const matcher = globToRegExp(filter === "*" ? "*.cs" : filter);
  for await (const entry of walk(source)) {
    if (entry.isFile && entry.path.endsWith(".cs") && matcher.test(basename(entry.path))) {
      files.push(entry.path);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

async function* walk(root: string): AsyncGenerator<Deno.DirEntry & { path: string }> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);
    if (entry.isDirectory) yield* walk(path);
    else yield { ...entry, path };
  }
}

function matchesFilter(value: string, filter: string): boolean {
  return globToRegExp(filter).test(value);
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function join(...parts: string[]): string {
  return normalize(parts.join("/"));
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function basename(path: string): string {
  return normalize(path).split("/").at(-1) ?? path;
}

if (import.meta.main) {
  try {
    await run(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
