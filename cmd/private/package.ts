import * as yaml from "https://deno.land/std@0.208.0/yaml/mod.ts";
import { glob } from "npm:glob@10.3.x";
import path from "node:path";

export interface PnpmWorkspaceSearchRes {
  success: {
    dir: string;
    pkg: any;
  }[];
  fail: any[];
  rootPkg: Record<string, any>;
}
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
