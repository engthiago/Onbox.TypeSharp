import { parseSourceFile } from "./parser.ts";
import { generate, type GenerateOptions } from "./generator.ts";

export interface CliOptions extends GenerateOptions {
  source: string;
  fileFilter: string;
  destination: string;
  typeFilter?: string;
  watch: boolean;
  exportModule: boolean;
}

export type ConfigFileOptions = Partial<CliOptions>;
export type ParsedCliOptions = ConfigFileOptions & { configPath?: string };

export async function run(args: string[]): Promise<void> {
  const options = await resolveOptions(args);
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
  const files = generate(filtered, {
    exportModule: options.exportModule,
    moduleName: `${moduleName}.Module`,
    dictionaryStyle: options.dictionaryStyle,
    readonlyProperties: options.readonlyProperties,
    quoteStyle: options.quoteStyle,
    semicolons: options.semicolons,
  });
  await Deno.mkdir(options.destination, { recursive: true });
  for (const file of files) {
    await Deno.writeTextFile(join(options.destination, file.name), file.text);
  }
}

export async function resolveOptions(args: string[], cwd = Deno.cwd()): Promise<CliOptions> {
  const cli = parseArgs(args);
  const configPath = cli.configPath ?? join(cwd, "typesharp.json");
  const config = await readConfigFile(configPath, cli.configPath !== undefined);
  const configBase = dirname(configPath);
  const merged = {
    ...resolveConfigPaths(config, configBase),
    ...cli,
  };
  delete merged.configPath;
  return finalizeOptions(merged);
}

export function parseArgs(args: string[]): ParsedCliOptions {
  const values = new Map<string, string | boolean>();
  const aliases: Record<string, string> = {
    c: "config",
    s: "source",
    f: "file-filter",
    t: "type-filter",
    d: "destination",
    w: "watch",
    m: "export-module",
  };
  const booleanFlags = new Set(["watch", "export-module", "readonly-properties", "semicolons"]);

  for (let i = 0; i < args.length; i++) {
    const raw = args[i];
    if (!raw.startsWith("-")) throw new Error(`Unexpected argument: ${raw}`);
    const trimmed = raw.replace(/^-+/, "");
    if (trimmed.startsWith("no-")) {
      values.set(trimmed.slice(3), false);
      continue;
    }
    const [flagName, inlineValue] = trimmed.split("=", 2);
    const name = aliases[flagName] ?? flagName;
    if (booleanFlags.has(name)) {
      values.set(name, inlineValue === undefined ? true : parseBoolean(inlineValue, name));
    } else {
      const value = inlineValue ?? args[++i];
      if (!value || value.startsWith("-")) throw new Error(`Missing value for --${name}`);
      values.set(name, value);
    }
  }

  return mapRawOptions(values);
}

async function readConfigFile(path: string, required: boolean): Promise<ConfigFileOptions> {
  try {
    const text = await Deno.readTextFile(path);
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${path}: config file must contain a JSON object`);
    }
    return parsed as ConfigFileOptions;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound && !required) return {};
    throw error;
  }
}

function resolveConfigPaths(options: ConfigFileOptions, base: string): ConfigFileOptions {
  return {
    ...options,
    source: options.source ? resolvePath(base, options.source) : undefined,
    destination: options.destination ? resolvePath(base, options.destination) : undefined,
  };
}

function finalizeOptions(options: ConfigFileOptions): CliOptions {
  if (typeof options.source !== "string") throw new Error("Missing required argument --source");
  if (typeof options.destination !== "string") throw new Error("Missing required argument --destination");
  if (
    options.dictionaryStyle !== undefined && options.dictionaryStyle !== "index-signature" &&
    options.dictionaryStyle !== "record"
  ) {
    throw new Error("--dictionary-style must be `index-signature` or `record`");
  }
  if (options.quoteStyle !== undefined && options.quoteStyle !== "double" && options.quoteStyle !== "single") {
    throw new Error("--quote-style must be `double` or `single`");
  }
  return {
    source: options.source,
    fileFilter: options.fileFilter ?? "*.cs",
    destination: options.destination,
    typeFilter: options.typeFilter,
    watch: options.watch ?? false,
    exportModule: options.exportModule ?? false,
    dictionaryStyle: options.dictionaryStyle,
    readonlyProperties: options.readonlyProperties,
    quoteStyle: options.quoteStyle,
    semicolons: options.semicolons,
  };
}

function mapRawOptions(values: Map<string, string | boolean>): ParsedCliOptions {
  const options: ParsedCliOptions = {};
  setString(options, "configPath", values.get("config"));
  setString(options, "source", values.get("source"));
  setString(options, "fileFilter", values.get("file-filter"));
  setString(options, "typeFilter", values.get("type-filter"));
  setString(options, "destination", values.get("destination"));
  setBoolean(options, "watch", values.get("watch"));
  setBoolean(options, "exportModule", values.get("export-module"));
  setString(options, "dictionaryStyle", values.get("dictionary-style"));
  setBoolean(options, "readonlyProperties", values.get("readonly-properties"));
  setString(options, "quoteStyle", values.get("quote-style"));
  setBoolean(options, "semicolons", values.get("semicolons"));
  return options;
}

function setString<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  value: string | boolean | undefined,
): void {
  if (typeof value === "string") target[key] = value as T[keyof T];
}

function setBoolean<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  value: string | boolean | undefined,
): void {
  if (typeof value === "boolean") target[key] = value as T[keyof T];
}

function parseBoolean(value: string, flag: string): boolean {
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  throw new Error(`--${flag} must be true or false`);
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
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/$/, "");
}

function basename(path: string): string {
  return normalize(path).split("/").at(-1) ?? path;
}

function dirname(path: string): string {
  const normalized = normalize(path);
  const parts = normalized.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

function resolvePath(base: string, path: string): string {
  if (path.startsWith("/") || /^[A-Za-z]:\//.test(path)) return normalize(path);
  return join(base, path);
}

if (import.meta.main) {
  try {
    await run(Deno.args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
