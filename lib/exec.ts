export async function execCmdWaitExit(cmd: string, opts?: Deno.CommandOptions) {
  const command = new Deno.Command(cmd, opts);
  const res = await command.output();
  if (res.code !== 0) throw new Error(toUTF8(res.stderr));
  return toUTF8(res.stdout);
}

type ExecCmdSyncOpts = Pick<Deno.CommandOptions, "clearEnv" | "cwd" | "env" | "gid" | "uid"> & { exitIfFail?: boolean };
type ExecCmdSyncRes = { code: number; signal: Deno.Signal };
export function execCmdSync(cmd: string, args?: string[], opts?: ExecCmdSyncOpts): ExecCmdSyncRes;
export function execCmdSync(cmd: string, opts?: ExecCmdSyncOpts): ExecCmdSyncRes;
export function execCmdSync(cmd: string, args_opts?: string[] | ExecCmdSyncOpts, opts?: ExecCmdSyncOpts) {
  let args: string[] = [];
  if (Array.isArray(args_opts)) args = args_opts;
  else opts = args_opts;

  const command = new Deno.Command(cmd, { ...opts, args, stdin: "null", stderr: "inherit", stdout: "inherit" });
  const { code, signal } = command.outputSync();
  if (opts?.exitIfFail && code !== 0) Deno.exit(code);
  return { code, signal };
}

const utf8Decoder = new TextDecoder();
function toUTF8(buf: Uint8Array) {
  return utf8Decoder.decode(buf);
}
