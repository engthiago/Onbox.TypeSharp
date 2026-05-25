export interface CommentTrivia {
  kind: "line" | "block" | "doc";
  text: string;
  start: number;
  end: number;
}

export interface AttributeNode {
  name: string;
  args: AttributeArgument[];
  leadingComments: CommentTrivia[];
}

export type AttributeArgument =
  | { kind: "string"; value: string }
  | { kind: "number"; value: string }
  | { kind: "identifier"; value: string };

export interface TypeReferenceNode {
  name: string;
  args: TypeReferenceNode[];
  arrayRank: number;
  nullable: boolean;
}

export interface PropertyNode {
  name: string;
  type: TypeReferenceNode;
  attributes: AttributeNode[];
  leadingComments: CommentTrivia[];
  trailingComments: CommentTrivia[];
}

export interface ClassNode {
  kind: "class";
  name: string;
  namespaceName?: string;
  typeParameters: string[];
  baseType?: TypeReferenceNode;
  baseTypes?: TypeReferenceNode[];
  properties: PropertyNode[];
  attributes: AttributeNode[];
  leadingComments: CommentTrivia[];
  trailingComments: CommentTrivia[];
}

export interface EnumMemberNode {
  name: string;
  value?: number;
  leadingComments: CommentTrivia[];
  trailingComments: CommentTrivia[];
}

export interface EnumNode {
  kind: "enum";
  name: string;
  namespaceName?: string;
  members: EnumMemberNode[];
  attributes: AttributeNode[];
  leadingComments: CommentTrivia[];
  trailingComments: CommentTrivia[];
}

export type TypeDeclarationNode = ClassNode | EnumNode;

export interface SourceFileNode {
  path: string;
  declarations: TypeDeclarationNode[];
  comments: CommentTrivia[];
}
