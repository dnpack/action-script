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
  /** 如果进程返回非 0 代码, 则使用该代码直接结束当前进程 */
  exitIfFail?: boolean;
  /** 默认清空下, 会使用 github action 分组输出. 如果 noGroup为false, 则关闭分组输出*/
  noGroup?: boolean;
  /** 执行成功的回调 */
  onSuccess?(): void;
  /** 执行失败的回调 */
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
  const { onFail, onSuccess, beforeExit, exitIfFail, noGroup, ...spawnOpts } = opts ?? {};

  noGroup || console.log("::group::" + `${cmd} ${args.join(" ")}`);
  const command = new Deno.Command(cmd, { ...spawnOpts, args, stdin: "null", stderr: "inherit", stdout: "inherit" });
  const { code, signal } = command.outputSync();
  noGroup || console.log("::endgroup::");

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
