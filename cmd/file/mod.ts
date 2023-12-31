import { glob, Path } from "../../deps/glob.ts";
import type { Stats } from "node:fs";
import path from "node:path";
/**
 * @public
 * @remarks
 * @param dir - 要扫描的目录
 * @param globMatch - glob 表达式
 */
export async function scanFiles(
  dir: string,
  globMatch: string[],
  opts: {
    fileOnly?: boolean;
    filter?: (path: string) => boolean;
  } = {},
) {
  const { fileOnly, filter } = opts;
  const ignoreDir = new Set<string>();
  const readDirCache = new Map<string, string[]>();
  const statCache = new Map<string, Stats>();
  dir = path.resolve(dir);
  globMatch = globMatch.map((pattern) => (pattern.startsWith("/") ? "." + pattern : pattern));

  function cache(path: string, chunk: Path) {
    if (chunk.calledReaddir()) {
      readDirCache.set(
        chunk.fullpath(),
        chunk.readdirCached().map((info) => info.name),
      );
    }

    const stat = chunk.lstatCached();
    if (stat) {
      statCache.set(path, stat as Stats);
    }
  }
  const chunkList = await glob(globMatch, {
    cwd: dir,
    root: dir,
    // absolute: false,
    matchBase: true,
    withFileTypes: true,
    nodir: fileOnly,
    ignore: {
      childrenIgnored(p) {
        const path = p.fullpath();
        if (!statCache.has(path)) cache(path, p);
        return ignoreDir.has(path);
      },
      ignored(p) {
        const path = p.fullpath();
        if (!statCache.has(path)) {
          cache(path, p);
          if (filter && !filter(path)) {
            ignoreDir.add(path);
            return true;
          }
        }
        return false;
      },
    },
  });

  const pathList: string[] = [];
  for (const chunk of chunkList) {
    const path = chunk.fullpath();
    if (path !== dir) pathList.push(path);
  }

  return { readDirCache, statCache, pathList };
}
