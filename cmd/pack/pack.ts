import { Pack } from "../../deps/tar.ts";
import path from "node:path";
import { scanFiles } from "../file/mod.ts";

/** @public */
export interface PackOpts {
  /** 基于压缩文件的字目录 */
  baseDir?: string;
  /** 匹配文件的 glob 表达式。 默认情况下，打包整个文件夹，如果指定该选项，则仅打包匹配的文件 */
  globMatch?: string[];
  filter?(path: string): boolean;
  /** 是否开启 gzip 压缩 */
  gzip?: boolean;
  /** 允许添加文件夹信息 */
  allowDir?: boolean;
  overTarget?: boolean;
}
/**
 * @public
 * @remarks 打包目录。打包后将位于
 * @param dir - 要打包的目录
 * @param target - 打包文件输出目录
 */
export async function pack(dir: string, target: string, opts: PackOpts = {}) {
  const { fileList, readable } = await packStream(dir, opts);
  const targetFile = await Deno.open(target, {
    write: true,
    truncate: true,
    create: true,
    createNew: !opts.overTarget,
  });
  await readable.pipeTo(targetFile.writable);
  return fileList;
}
/**
 * @public
 * @remarks 打包目录。返回流
 * @param dir - 要打包的目录
 */
export async function packStream(
  dir: string,
  opts: PackOpts = {},
): Promise<{ readable: ReadableStream<Uint8Array>; fileList: string[] }> {
  const { filter } = opts;
  const baseDir = opts.baseDir ? path.relative("/", opts.baseDir) : undefined;

  const { readDirCache, statCache, pathList } = await scanFiles(dir, opts.globMatch ?? ["**"], {
    filter,
    fileOnly: !opts.allowDir,
  });

  const tarPack = new Pack({
    cwd: dir,
    readdirCache: readDirCache,
    statCache: statCache,
    gzip: opts.gzip,
    filter(filename, stat) {
      // console.log(filename);

      return true;
    },
  });

  for (const filename of pathList) {
    let relPath = path.relative(dir, filename);
    if (baseDir) relPath = path.resolve("/", baseDir, relPath);
    tarPack.add(relPath);
  }
  tarPack.end();
  tarPack.setMaxListeners(10);
  let onData: (data: Uint8Array) => void;
  let wait = false;
  const src: UnderlyingSource<Uint8Array> = {
    start(ctrl) {
      tarPack.on("error", (e) => {
        ctrl.error(e);
      });
      tarPack.on("end", () => {
        queueMicrotask(() => ctrl.close());
      });
      onData = (data: Uint8Array) => {
        wait = false;
        tarPack.off("data", onData);
        ctrl.enqueue(data);
      };
    },

    cancel() {
      tarPack.destroy(new Error("ReadableStream canceled"));
    },

    pull(ctrl) {
      if (!wait) {
        wait = true;
        tarPack.on("data", onData);
      }
    },
  };
  const readable = new ReadableStream<Uint8Array>(src, { highWaterMark: 16 * 1024, size: (chunk) => chunk.byteLength });
  return { readable, fileList: pathList };
}
