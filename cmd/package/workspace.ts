import * as yaml from "../../deps/std/yaml.ts";
import { SemverVersion } from "../../lib.ts";
import { glob } from "../../deps/glob.ts";
import path from "node:path";

/** @public */
export interface PackageJson {
  /** package.json 所在文件夹 */
  packageRoot: string;
  name?: string;
  version?: string;
}
/** @public */
export interface PnpmWorkspaceSearchRes {
  success: PackageJson[];
  fail: any[];
  /** 工作区根包的 package.json 信息 */
  rootPkg: Record<string, any>;
}
/**
 * @public
 * @remarks 查找PNPM工作区目录下的所有包的信息
 */
export async function findPnpmWorkspacePkgs(workspaceRoot: string): Promise<PnpmWorkspaceSearchRes> {
  const [rootPkg, packagesGlob] = await Promise.all([
    readPackageJson(workspaceRoot),
    getPnpmWorkspaceDefine(path.resolve(workspaceRoot, "pnpm-workspace.yaml")),
  ]);
  for (let i = 0; i < packagesGlob.length; i++) {
    if (!packagesGlob[i].endsWith("/")) packagesGlob[i] = packagesGlob[i] + "/package.json";
  }
  const packageFile = await glob(packagesGlob, {
    root: workspaceRoot,
    cwd: workspaceRoot,
    nodir: true,
    absolute: true,
  });
  const { success, fail } = await allSettled(
    packageFile.map(async (filename): Promise<PackageJson> => {
      const dir = path.resolve(filename, "..");
      const text = await Deno.readTextFile(filename);

      return { ...JSON.parse(text), packageRoot: dir };
    }),
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

/**
 * @public
 * @remarks 获取 Pnpm 工作区子包, 返回 标签到包的映射
 */
export async function getWorkspaceTagMap(pkgInfoList?: PackageJson[]) {
  if (!pkgInfoList) {
    const { success, fail } = await findPnpmWorkspacePkgs(".");
    if (fail.length) console.log(`查找失败: ${fail.join(", ")}`);
    pkgInfoList = success;
  }

  if (pkgInfoList.length === 0) console.log("没有任何升级, 跳过");
  const tagsMap: Record<string, PackageJson> = {};
  for (const pkg of pkgInfoList) {
    const dir = pkg.packageRoot;
    let name = pkg.name;
    if (typeof name !== "string") {
      name = dir.slice(dir.lastIndexOf(path.sep));
    }
    if (name.startsWith("@")) name = name.slice(name.indexOf("/") + 1);
    if (name === "") throw new Error(dir + ": 包名无效");

    const version = new SemverVersion(pkg.version!);
    version.prefix = name + "/v";
    const tag = version.toString();
    tagsMap[tag] = pkg;
  }
  return tagsMap;
}
