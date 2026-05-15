import type { AttributeNode, ClassNode, SourceFileNode, TypeDeclarationNode, TypeReferenceNode } from "./ast.ts";

export interface GenerateOptions {
  exportModule?: boolean;
  moduleName?: string;
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
  const declarations = files.flatMap((file) => file.declarations).filter(shouldEmit);
  const typeMap: TypeMap = { declarations: new Map(declarations.map((d) => [d.name, d])) };
  const output = declarations.map((declaration) => ({
    name: `${declaration.name}.ts`,
    text: declaration.kind === "enum" ? generateEnum(declaration) : generateClass(declaration, typeMap),
  }));

  if (options.exportModule) {
    const moduleName = options.moduleName ?? "TypeSharp.Module";
    const exports = output
      .map((file) => file.name.replace(/\.ts$/, ""))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `export { ${name} } from "./${name}";`)
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

function generateClass(node: ClassNode, typeMap: TypeMap): string {
  const imports = collectImports(node, typeMap);
  const lines: string[] = [];
  for (const importName of imports) {
    lines.push(`import { ${importName} } from "./${importName}";`);
  }
  lines.push("");
  const typeParams = node.typeParameters.length > 0 ? `<${node.typeParameters.join(", ")}>` : "";
  const base = node.baseType ? ` extends ${toTypeScriptType(node.baseType, node, typeMap)}` : "";
  lines.push(`export interface ${node.name}${typeParams}${base} {`);
  for (const prop of node.properties) {
    const union = typeUnion(prop.attributes);
    if (union) {
      lines.push(`   ${camelCase(prop.name)}: ${union};`);
      continue;
    }

    const optional = hasAttribute(prop.attributes, "Optional") || prop.type.nullable;
    const nullable = hasAttribute(prop.attributes, "Nullable") ? " | null" : "";
    let typeName = hasAttribute(prop.attributes, "UnknownObject")
      ? "unknown"
      : toTypeScriptType(prop.type, node, typeMap);
    if (hasAttribute(prop.attributes, "Partial")) typeName = `Partial<${typeName}>`;
    lines.push(`   ${camelCase(prop.name)}${optional ? "?" : ""}: ${typeName}${nullable};`);
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
  if (node.baseType) visit(node.baseType);
  for (const prop of node.properties) visit(prop.type);
  return [...imports];
}

function toTypeScriptType(type: TypeReferenceNode, owner: ClassNode, typeMap: TypeMap): string {
  const base = simpleName(type.name);
  let result: string;

  if (base === "object" || base === "Object") result = "any";
  else if (base === "string" || base === "char" || base === "String") result = "string";
  else if (base === "bool" || base === "Boolean") result = "boolean";
  else if (numberTypes.has(base) || ["Int32", "Double", "Single", "Decimal"].includes(base)) result = "number";
  else if (base === "DateTime" || base === "DateTimeOffset") result = "Date";
  else if (delegateTypes.has(base)) result = "CustomEvent";
  else if (base === "Nullable" && type.args.length === 1) result = toTypeScriptType(type.args[0], owner, typeMap);
  else if (base === "Dictionary" && type.args.length === 2) {
    result = `{ [key: ${toDictionaryKey(type.args[0])}]: ${toTypeScriptType(type.args[1], owner, typeMap)} }`;
  } else if (isCollection(base) && type.args.length === 1) {
    result = `${toTypeScriptType(type.args[0], owner, typeMap)}[]`;
  } else if (type.args.length > 0) {
    result = `${base}<${type.args.map((arg) => toTypeScriptType(arg, owner, typeMap)).join(", ")}>`;
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

function typeUnion(attributes: AttributeNode[]): string | undefined {
  const attr = findAttribute(attributes, "TypeUnion");
  if (!attr || attr.args.length === 0) return undefined;
  return attr.args.map((arg) => arg.kind === "string" ? JSON.stringify(arg.value) : arg.value).join(" | ");
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

function camelCase(value: string): string {
  if (value.length === 0) return value;
  return value[0].toLowerCase() + value.slice(1);
}
