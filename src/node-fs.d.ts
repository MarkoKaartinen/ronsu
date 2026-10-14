// The build config (vite.config.ts) and a unit test use a few functions of Node's fs module. They are declared here, so
// @types/node does not have to be installed just for them.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
  export function renameSync(oldPath: string, newPath: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}
