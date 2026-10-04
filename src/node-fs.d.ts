// The build config (vite.config.ts) uses three functions of Node's fs module. They are declared here, so
// @types/node does not have to be installed just for them.
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function renameSync(oldPath: string, newPath: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}
