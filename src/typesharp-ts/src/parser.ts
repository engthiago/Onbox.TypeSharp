import type {
  AttributeArgument,
  AttributeNode,
  ClassNode,
  CommentTrivia,
  EnumMemberNode,
  EnumNode,
  PropertyNode,
  SourceFileNode,
  TypeDeclarationNode,
  TypeReferenceNode,
} from "./ast.ts";
import { lex, type Token } from "./lexer";

export class CSharpParseError extends Error {
  readonly path: string;
  readonly offset: number;

  constructor(message: string, path: string, offset: number) {
    super(`${path}: ${message} at offset ${offset}`);
    this.path = path;
    this.offset = offset;
  }
}

export function parseSourceFile(path: string, source: string): SourceFileNode {
  const result = lex(source);
  const parser = new Parser(path, result.tokens);
  return { path, declarations: parser.parse(), comments: result.comments };
}

class Parser {
  private index = 0;
  private readonly path: string;
  private readonly tokens: Token[];

  constructor(path: string, tokens: Token[]) {
    this.path = path;
    this.tokens = tokens;
  }

  parse(): TypeDeclarationNode[] {
    const declarations: TypeDeclarationNode[] = [];
    while (!this.is("eof")) {
      if (this.matchText("using")) {
        this.skipUntil(";");
        this.matchText(";");
        continue;
      }

      const attributes = this.parseAttributes();

      if (this.matchText("namespace")) {
        const namespaceName = this.parseQualifiedName();
        if (this.matchText("{")) {
          while (!this.isText("}") && !this.is("eof")) {
            declarations.push(...this.parseDeclaration(namespaceName));
          }
          this.expectText("}");
        } else {
          declarations.push(...this.parseDeclaration(namespaceName));
        }
        continue;
      }

      if (
        attributes.length > 0 || this.isText("public") || this.isText("partial") || this.isText("class") ||
        this.isText("interface") || this.isText("enum")
      ) {
        declarations.push(...this.parseDeclaration(undefined, attributes));
        continue;
      }

      this.next();
    }
    return declarations;
  }

  private parseDeclaration(namespaceName?: string, existingAttributes: AttributeNode[] = []): TypeDeclarationNode[] {
    const attributes = existingAttributes.length > 0 ? existingAttributes : this.parseAttributes();
    const leadingComments = collectLeading(attributes, this.peek());
    this.matchText("public");
    this.matchText("partial");

    if (this.matchText("class")) {
      return [this.parseClass(namespaceName, attributes, leadingComments, "class")];
    }

    if (this.matchText("interface")) {
      return [this.parseClass(namespaceName, attributes, leadingComments, "interface")];
    }

    if (this.matchText("enum")) {
      return [this.parseEnum(namespaceName, attributes, leadingComments)];
    }

    if (this.isText("namespace")) return [];
    this.skipUnsupportedMember("Unsupported top-level syntax");
    return [];
  }

  private parseClass(
    namespaceName: string | undefined,
    attributes: AttributeNode[],
    leadingComments: CommentTrivia[],
    declarationKind: "class" | "interface",
  ): ClassNode {
    const name = this.expectIdentifier(`Expected ${declarationKind} name`).text;
    const typeParameters = this.parseTypeParameters();
    const baseTypes = this.parseBaseTypes();
    this.expectText("{");
    const properties: PropertyNode[] = [];

    while (!this.isText("}") && !this.is("eof")) {
      const memberAttributes = this.parseAttributes();
      const memberLeading = collectLeading(memberAttributes, this.peek());
      if (!this.matchText("public")) {
        this.skipUnsupportedMember("Only public auto-properties are supported in DTO classes");
        continue;
      }

      if (this.isText("class") || this.isText("interface") || this.isText("enum")) {
        this.skipUnsupportedMember("Nested type declarations are not supported");
        continue;
      }

      const type = this.parseTypeReference();
      if (this.isText("(")) {
        this.skipUnsupportedMember("Constructors and methods are not supported");
        continue;
      }
      const propName = this.expectIdentifier("Expected property name").text;
      if (!this.matchText("{")) {
        this.skipUnsupportedMember("Fields, methods, and constructors are not supported");
        continue;
      }

      if (!this.matchText("get") || !this.matchText(";") || !this.matchText("set") || !this.matchText(";")) {
        throw this.error("Only public auto-properties with `{ get; set; }` are supported");
      }
      this.expectText("}");
      properties.push({
        name: propName,
        type,
        attributes: memberAttributes,
        leadingComments: memberLeading,
        trailingComments: this.previous().trailingComments,
      });
    }

    this.expectText("}");
    return {
      kind: "class",
      name,
      namespaceName,
      typeParameters,
      baseType: baseTypes[0],
      baseTypes,
      properties,
      attributes,
      leadingComments,
      trailingComments: this.previous().trailingComments,
    };
  }

  private parseBaseTypes(): TypeReferenceNode[] {
    const baseTypes: TypeReferenceNode[] = [];
    if (!this.matchText(":")) return baseTypes;
    do baseTypes.push(this.parseTypeReference()); while (this.matchText(","));
    return baseTypes;
  }

  private parseEnum(
    namespaceName: string | undefined,
    attributes: AttributeNode[],
    leadingComments: CommentTrivia[],
  ): EnumNode {
    const name = this.expectIdentifier("Expected enum name").text;
    this.expectText("{");
    const members: EnumMemberNode[] = [];
    let nextImplicitValue = 0;
    while (!this.isText("}") && !this.is("eof")) {
      if (this.matchText(",")) continue;
      const token = this.expectIdentifier("Expected enum member name");
      let value: number | undefined;
      if (this.matchText("=")) {
        value = this.parseEnumNumericValue();
        nextImplicitValue = value + 1;
      } else {
        value = nextImplicitValue++;
      }
      members.push({
        name: token.text,
        value,
        leadingComments: token.leadingComments,
        trailingComments: token.trailingComments,
      });
      this.matchText(",");
    }
    this.expectText("}");
    return {
      kind: "enum",
      name,
      namespaceName,
      members,
      attributes,
      leadingComments,
      trailingComments: this.previous().trailingComments,
    };
  }

  private parseEnumNumericValue(): number {
    const sign = this.matchText("-") ? -1 : this.matchText("+") ? 1 : 1;
    const valueToken = this.expect("number", "Expected enum member numeric value");
    return sign * Number(valueToken.text);
  }

  private parseAttributes(): AttributeNode[] {
    const attributes: AttributeNode[] = [];
    while (this.matchText("[")) {
      const bracket = this.previous();
      do {
        const token = this.peek();
        const name = this.parseQualifiedName();
        const attr: AttributeNode = {
          name,
          args: [],
          leadingComments: [...bracket.leadingComments, ...token.leadingComments],
        };
        if (this.matchText("(")) {
          if (!this.isText(")")) {
            do attr.args.push(this.parseAttributeArgument()); while (this.matchText(","));
          }
          this.expectText(")");
        }
        attributes.push(attr);
      } while (this.matchText(","));
      this.expectText("]");
    }
    return attributes;
  }

  private parseAttributeArgument(): AttributeArgument {
    const token = this.next();
    if ((token.kind === "identifier" || token.kind === "keyword") && this.matchText("=")) {
      return this.parseAttributeArgument();
    }
    if (token.kind === "string") {
      return { kind: "string", value: unquote(token.text) };
    }
    if (token.kind === "number") {
      return { kind: "number", value: token.text };
    }
    if (token.kind === "identifier" || token.kind === "keyword") {
      let value = token.text;
      while (this.matchText(".")) value += "." + this.expectIdentifier("Expected identifier after `.`").text;
      return { kind: "identifier", value };
    }
    throw this.error("Unsupported attribute argument");
  }

  private parseTypeReference(): TypeReferenceNode {
    const name = this.parseQualifiedName();
    const args: TypeReferenceNode[] = [];
    if (this.matchText("<")) {
      do args.push(this.parseTypeReference()); while (this.matchText(","));
      this.expectText(">");
    }

    let nullable = false;
    if (this.matchText("?")) nullable = true;
    let arrayRank = 0;
    while (this.matchText("[")) {
      this.expectText("]");
      arrayRank++;
    }

    return { name, args, arrayRank, nullable };
  }

  private parseTypeParameters(): string[] {
    const values: string[] = [];
    if (!this.matchText("<")) return values;
    do values.push(this.expectIdentifier("Expected type parameter").text); while (this.matchText(","));
    this.expectText(">");
    return values;
  }

  private parseQualifiedName(): string {
    let name = this.expectIdentifier("Expected identifier").text;
    while (this.matchText(".")) name += "." + this.expectIdentifier("Expected identifier after `.`").text;
    return name;
  }

  private skipUnsupportedMember(message: string): void {
    if (this.is("eof")) return;
    const start = this.peek();
    if (this.matchText(";")) return;
    if (this.matchText("{")) {
      let depth = 1;
      while (depth > 0 && !this.is("eof")) {
        if (this.matchText("{")) depth++;
        else if (this.matchText("}")) depth--;
        else this.next();
      }
      return;
    }
    while (!this.is("eof")) {
      if (this.matchText(";")) return;
      if (this.isText("}")) return;
      if (this.matchText("{")) {
        let depth = 1;
        while (depth > 0 && !this.is("eof")) {
          if (this.matchText("{")) depth++;
          else if (this.matchText("}")) depth--;
          else this.next();
        }
        return;
      }
      this.next();
    }
    throw new CSharpParseError(message, this.path, start.start);
  }

  private skipUntil(text: string): void {
    while (!this.is("eof") && !this.isText(text)) this.next();
  }

  private matchText(text: string): boolean {
    if (!this.isText(text)) return false;
    this.index++;
    return true;
  }

  private isText(text: string): boolean {
    return this.peek().text === text;
  }

  private is(kind: Token["kind"]): boolean {
    return this.peek().kind === kind;
  }

  private expectIdentifier(message: string): Token {
    const token = this.next();
    if (token.kind === "identifier" || token.kind === "keyword") return token;
    throw new CSharpParseError(message, this.path, token.start);
  }

  private expect(kind: Token["kind"], message: string): Token {
    const token = this.next();
    if (token.kind === kind) return token;
    throw new CSharpParseError(message, this.path, token.start);
  }

  private expectText(text: string): Token {
    const token = this.next();
    if (token.text === text) return token;
    throw new CSharpParseError(`Expected \`${text}\``, this.path, token.start);
  }

  private next(): Token {
    return this.tokens[this.index++];
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }

  private error(message: string): CSharpParseError {
    return new CSharpParseError(message, this.path, this.peek().start);
  }
}

function collectLeading(attributes: AttributeNode[], token: Token): CommentTrivia[] {
  return [...attributes.flatMap((a) => a.leadingComments), ...token.leadingComments];
}

function unquote(text: string): string {
  return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
