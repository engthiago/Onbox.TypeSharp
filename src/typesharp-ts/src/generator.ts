import { AttributeNode, ClassNode, SourceFileNode, TypeDeclarationNode, TypeReferenceNode } from "./ast";

export interface GenerateOptions {
  exportModule?: boolean;
  moduleName?: string;
  dictionaryStyle?: "index-signature" | "record";
  readonlyProperties?: boolean;
  quoteStyle?: "double" | "single";
  semicolons?: boolean;
  normalizeAcronyms?: boolean;
}

export interface GeneratedFile {
  name: string;
  text: string;
}

interface TypeMap {
  declarations: Map<string, TypeDeclarationNode>;
}

const numberTypes = new Set([
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const delegateTypes = new Set(["Action", "Delegate", "Func", "EventHandler"]);

export function generate(files: SourceFileNode[], options: GenerateOptions = {}): GeneratedFile[] {
  const settings = normalizeOptions(options);
  const declarations = files.flatMap((file) => file.declarations).filter(shouldEmit);
  const typeMap: TypeMap = { declarations: new Map(declarations.map((d) => [d.name, d])) };
  const output = declarations.map((declaration) => ({
    name: `${declaration.name}.ts`,
    text: declaration.kind === "enum" ? generateEnum(declaration) : generateClass(declaration, typeMap, settings),
  }));

  if (settings.exportModule) {
    const moduleName = settings.moduleName ?? "index";
    const exports = output
      .map((file) => file.name.replace(/\.ts$/, ""))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `export * from ${quote(`./${name}`, settings)}${statementEnd(settings)}`)
      .join("\n");
    output.push({ name: `${moduleName}.ts`, text: `${exports}\n` });
  }

  return output;
}

function shouldEmit(declaration: TypeDeclarationNode): boolean {
  if (declaration.kind === "enum") return true;
  return !declaration.name.endsWith("Attribute") && declaration.properties.length > 0;
}

function generateEnum(node: Extract<TypeDeclarationNode, { kind: "enum" }>): string {
  const lines = ["", `export enum ${node.name} {`];
  for (const member of node.members) {
    lines.push(`   ${member.name} = ${member.value ?? 0},`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

function generateClass(node: ClassNode, typeMap: TypeMap, options: Required<GenerateOptions>): string {
  const imports = collectImports(node, typeMap);
  const lines: string[] = [];
  for (const importName of imports) {
    lines.push(`import { ${importName} } from ${quote(`./${importName}`, options)}${statementEnd(options)}`);
  }
  lines.push("");
  const typeParams = node.typeParameters.length > 0 ? `<${node.typeParameters.join(", ")}>` : "";
  const baseTypes = node.baseTypes ?? (node.baseType ? [node.baseType] : []);
  const base = baseTypes.length > 0
    ? ` extends ${baseTypes.map((type) => toTypeScriptType(type, node, typeMap, options)).join(", ")}`
    : "";
  const readonlyClass = options.readonlyProperties || hasAttribute(node.attributes, "Readonly") ||
    hasAttribute(node.attributes, "ReadOnly") || hasAttribute(node.attributes, "ReadonlyProperties");
  lines.push(`export interface ${node.name}${typeParams}${base} {`);
  for (const prop of node.properties) {
    const union = typeUnion(prop.attributes, options);
    const readonly = readonlyClass || hasAttribute(prop.attributes, "Readonly") ||
      hasAttribute(prop.attributes, "ReadOnly");
    const prefix = readonly ? "readonly " : "";
    if (union) {
      lines.push(`   ${prefix}${propertyName(prop.name, options)}: ${union}${statementEnd(options)}`);
      continue;
    }

    const optional = hasAttribute(prop.attributes, "Optional") || prop.type.nullable;
    const nullable = hasAttribute(prop.attributes, "Nullable") ? " | null" : "";
    let typeName = hasAttribute(prop.attributes, "UnknownObject")
      ? "unknown"
      : toTypeScriptType(prop.type, node, typeMap, options);
    if (hasAttribute(prop.attributes, "Partial")) typeName = `Partial<${typeName}>`;
    lines.push(
      `   ${prefix}${propertyName(prop.name, options)}${optional ? "?" : ""}: ${typeName}${nullable}${
        statementEnd(options)
      }`,
    );
  }
  lines.push("}", "");
  return lines.join("\n");
}

function collectImports(node: ClassNode, typeMap: TypeMap): string[] {
  const imports = new Set<string>();
  const visit = (type: TypeReferenceNode) => {
    const base = simpleName(type.name);
    if (base !== node.name && !node.typeParameters.includes(base) && typeMap.declarations.has(base)) {
      imports.add(base);
    }
    for (const arg of type.args) visit(arg);
  };
  for (const baseType of node.baseTypes ?? (node.baseType ? [node.baseType] : [])) visit(baseType);
  for (const prop of node.properties) visit(prop.type);
  return [...imports];
}

function toTypeScriptType(
  type: TypeReferenceNode,
  owner: ClassNode,
  typeMap: TypeMap,
  options: Required<GenerateOptions>,
): string {
  const base = simpleName(type.name);
  let result: string;

  if (base === "object" || base === "Object") result = "any";
  else if (base === "string" || base === "char" || base === "String") result = "string";
  else if (base === "bool" || base === "Boolean") result = "boolean";
  else if (numberTypes.has(base) || ["Int32", "Double", "Single", "Decimal"].includes(base)) result = "number";
  else if (base === "DateTime" || base === "DateTimeOffset") result = "Date";
  else if (delegateTypes.has(base)) result = "CustomEvent";
  else if (base === "Nullable" && type.args.length === 1) {
    result = toTypeScriptType(type.args[0], owner, typeMap, options);
  } else if (base === "Dictionary" && type.args.length === 2) {
    const keyType = toDictionaryKey(type.args[0]);
    const valueType = toTypeScriptType(type.args[1], owner, typeMap, options);
    result = options.dictionaryStyle === "record"
      ? `Record<${keyType}, ${valueType}>`
      : `{ [key: ${keyType}]: ${valueType} }`;
  } else if (isCollection(base) && type.args.length === 1) {
    result = `${toTypeScriptType(type.args[0], owner, typeMap, options)}[]`;
  } else if (type.args.length > 0) {
    result = `${base}<${type.args.map((arg) => toTypeScriptType(arg, owner, typeMap, options)).join(", ")}>`;
  } else if (owner.typeParameters.includes(base)) {
    result = base;
  } else if (typeMap.declarations.has(base)) {
    result = base;
  } else {
    result = base;
  }

  for (let i = 0; i < type.arrayRank; i++) result += "[]";
  return result;
}

function toDictionaryKey(type: TypeReferenceNode): string {
  const key = simpleName(type.name);
  return key === "string" || key === "String" ? "string" : "number";
}

function isCollection(base: string): boolean {
  return ["List", "IList", "ICollection", "IEnumerable", "IReadOnlyList", "IReadOnlyCollection"].includes(base);
}

function typeUnion(attributes: AttributeNode[], options: Required<GenerateOptions>): string | undefined {
  const attr = findAttribute(attributes, "TypeUnion");
  if (!attr || attr.args.length === 0) return undefined;
  return attr.args.map((arg) => arg.kind === "string" ? quote(arg.value, options) : arg.value).join(" | ");
}

function hasAttribute(attributes: AttributeNode[], name: string): boolean {
  return Boolean(findAttribute(attributes, name));
}

function findAttribute(attributes: AttributeNode[], name: string): AttributeNode | undefined {
  return attributes.find((attr) => {
    const attrName = simpleName(attr.name);
    return attrName === name || attrName === `${name}Attribute` || attrName.startsWith(name);
  });
}

function simpleName(name: string): string {
  return name.split(".").at(-1) ?? name;
}

function propertyName(value: string, options: Required<GenerateOptions>): string {
  return options.normalizeAcronyms ? acronymCamelCase(value) : camelCase(value);
}

function camelCase(value: string): string {
  if (value.length === 0) return value;
  return value[0].toLowerCase() + value.slice(1);
}

function acronymCamelCase(value: string): string {
  if (value.length === 0) return value;
  const leadingAcronym = value.match(/^[A-Z]+(?=$|[A-Z][a-z])/);
  if (!leadingAcronym) return camelCase(value);
  return leadingAcronym[0].toLowerCase() + value.slice(leadingAcronym[0].length);
}

function normalizeOptions(options: GenerateOptions): Required<GenerateOptions> {
  return {
    exportModule: options.exportModule ?? false,
    moduleName: options.moduleName ?? "TypeSharp.Module",
    dictionaryStyle: options.dictionaryStyle ?? "index-signature",
    readonlyProperties: options.readonlyProperties ?? false,
    quoteStyle: options.quoteStyle ?? "double",
    semicolons: options.semicolons ?? true,
    normalizeAcronyms: options.normalizeAcronyms ?? false,
  };
}

function quote(value: string, options: Required<GenerateOptions>): string {
  if (options.quoteStyle === "single") return `'${value.replace(/'/g, "\\'")}'`;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function statementEnd(options: Required<GenerateOptions>): string {
  return options.semicolons ? ";" : "";
}
