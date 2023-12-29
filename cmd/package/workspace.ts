import * as yaml from "../../deps/std/yaml.ts";
import { glob } from "../../deps/glob.ts";
import path from "node:path";

/** @public */
export interface PnpmWorkspaceSearchRes {
  success: {
    /** 子包的绝对路径 */
    dir: string;
    /** 子包的 package.json 信息 */
    pkg: any;
  }[];
  fail: any[];
  /** 工作区根包的 package.json 信息 */
  rootPkg: Record<string, any>;
}
/**
 * @public
 * @remarks 查找PNPM工作区目录下的所有包的信息
 */
export async function findPnpmWorkspacePkgs(dir: string): Promise<PnpmWorkspaceSearchRes> {
  const [rootPkg, packagesGlob] = await Promise.all([
    readPackageJson(dir),
    getPnpmWorkspaceDefine(path.resolve(dir, "pnpm-workspace.yaml")),
  ]);
  for (let i = 0; i < packagesGlob.length; i++) {
    if (!packagesGlob[i].endsWith("/")) packagesGlob[i] = packagesGlob[i] + "/package.json";
  }
  const packageFile = await glob(packagesGlob, { root: dir, cwd: dir, nodir: true, absolute: true });
  const { success, fail } = await allSettled(
    packageFile.map(async (filename) => {
      const dir = path.resolve(filename, "..");
      const text = await Deno.readTextFile(filename);
      return { dir, pkg: JSON.parse(text) };
    })
  );

  return { success, fail, rootPkg };
}

function allSettled<T>(list: Promise<T>[]): Promise<{ success: T[]; fail: any[] }> {
  return Promise.allSettled(list).then((res) => {
    const success: T[] = [];
    const fail: any[] = [];
    for (const item of res) {
      if (item.status === "fulfilled") success.push(item.value);
      else fail.push(item.reason);
    }
    return { success, fail };
  });
}
async function readPackageJson<T = Record<string, any>>(pkgDir: string): Promise<T> {
  const filename = path.resolve(pkgDir, "package.json");
  const text = await Deno.readTextFile(filename);
  return JSON.parse(text);
}
async function getPnpmWorkspaceDefine(file: string): Promise<string[]> {
  const text = await Deno.readTextFile(file);
  try {
    const obj: any = yaml.parse(text);
    if (obj.packages instanceof Array) return obj.packages;
    return [];
  } catch (error) {
    return [];
  }
}

// export async function packNpmPkg(dir: string) {}
