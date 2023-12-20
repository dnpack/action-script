/**
 * @public
 */
export async function execCmdWaitExit(cmd: string, opts?: Deno.CommandOptions) {
  const command = new Deno.Command(cmd, opts);
  const res = await command.output();
  if (res.code !== 0) throw new Error(toUTF8(res.stderr));
  return toUTF8(res.stdout);
}

type ExecCmdSyncOpts = Pick<Deno.CommandOptions, "clearEnv" | "cwd" | "env" | "gid" | "uid"> & {
  exitIfFail?: boolean;
  onSuccess?(): void;
  onFail?(code: number): void;
  /** @deprecated 改用 onFail */
  beforeExit?(code: number): void;
};
type ExecCmdSyncRes = { code: number; signal: Deno.Signal };
/**
 * @public
 */
export function execCmdSync(cmd: string, args?: string[], opts?: ExecCmdSyncOpts): ExecCmdSyncRes;
export function execCmdSync(cmd: string, opts?: ExecCmdSyncOpts): ExecCmdSyncRes;
export function execCmdSync(cmd: string, args_opts?: string[] | ExecCmdSyncOpts, opts?: ExecCmdSyncOpts) {
  let args: string[] = [];
  if (Array.isArray(args_opts)) args = args_opts;
  else opts = args_opts;
  const { onFail, onSuccess, beforeExit, exitIfFail, ...spawnOpts } = opts ?? {};

  const command = new Deno.Command(cmd, { ...spawnOpts, args, stdin: "null", stderr: "inherit", stdout: "inherit" });
  const { code, signal } = command.outputSync();
  if (code !== 0) {
    onFail?.(code);
    if (exitIfFail) {
      beforeExit?.(code);
      Deno.exit(code);
    }
  } else onSuccess?.();
  return { code, signal };
}

const utf8Decoder = new TextDecoder();
function toUTF8(buf: Uint8Array) {
  return utf8Decoder.decode(buf);
}
