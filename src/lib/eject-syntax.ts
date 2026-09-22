/**
 * Server-side syntax gate. Runs after the tree is assembled and before GitHub
 * receives a byte. TypeScript is imported only from route handlers so the
 * studio client bundle does not pull the compiler.
 */
import ts from "typescript";
import { EjectCompileError } from "./eject-gate";

export function syntaxBlockers(files: { path: string; content: string }[]): string[] {
  const blockers: string[] = [];
  for (const file of files) {
    if (!/\.(tsx?|jsx?|mjs|cjs)$/i.test(file.path)) continue;
    if (file.path.endsWith(".d.ts")) continue;
    const kind = /\.tsx$/i.test(file.path)
      ? ts.ScriptKind.TSX
      : /\.jsx$/i.test(file.path)
        ? ts.ScriptKind.JSX
        : /\.jsx?$/i.test(file.path)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
    const source = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      false,
      kind
    ) as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] };
    for (const diagnostic of source.parseDiagnostics ?? []) {
      if (diagnostic.category !== ts.DiagnosticCategory.Error) continue;
      const pos = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      blockers.push(`${file.path}:${pos.line + 1}:${pos.character + 1} ${message}`);
    }
  }
  return blockers;
}

export function assertEjectSyntax(files: { path: string; content: string }[]): void {
  const blockers = syntaxBlockers(files);
  if (blockers.length) throw new EjectCompileError(blockers);
}
