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
}
/**
 * @public
 * @remarks 打包目录。打包后将位于
 * @param dir - 要打包的目录
 * @param target - 打包文件输出目录
 */
export async function pack(dir: string, target: string, opts: PackOpts = {}) {
  const { filter } = opts;
  const baseDir = opts.baseDir ? path.relative("/", opts.baseDir) : undefined;

  // const matcher = opts.globMatch?.map((pattern) => new Minimatch(pattern, { matchBase: true, dot: true })) ?? [];
  const { readDirCache, statCache, pathList } = await scanFiles(dir, opts.globMatch ?? [], { filter, fileOnly: true });
  const targetFile = await Deno.open(target, { write: true, truncate: true, create: true });

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

  tarPack.on("data", (chunk) => targetFile.write(chunk));
  for (const filename of pathList) {
    let relPath = path.relative(dir, filename);
    if (baseDir) relPath = path.resolve("/", baseDir, relPath);
    tarPack.add(relPath);
  }
  await new Promise<void>(function (resolve, reject) {
    function final() {
      targetFile.close();
    }
    tarPack.on("close", () => {
      final();
    });
    tarPack.on("end", function () {
      final();
      resolve();
    });
    tarPack.on("error", (err) => {
      final();
      reject(err);
    });
    tarPack.end();
  });
  return pathList;
}
