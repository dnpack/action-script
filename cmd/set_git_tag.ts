import { SemverVersion } from "../lib/version.ts";
import * as git from "./private/git.ts";
import * as pkg from "./private/package.ts";
import { execCmdWaitExit } from "./private/exec.ts";
import * as gitCmd from "./private/git.ts";
import path from "node:path";

const gitAction = {
  /**
   * @remarks 删除匹配的本地标签
   * @param lessThan 匹配小于指定版本的标签
   *
   */
  async deleteTags(tagName: string, lessThan: string | SemverVersion) {
    if (typeof lessThan === "string") lessThan = new SemverVersion(lessThan);
    const tags = await this.matchVersionTags(tagName, lessThan);
    if (tags.length === 0) return [];
    await execCmdWaitExit("git", { args: ["tag", "-d", ...tags] });
    return tags;
  },
  /**
   * @remarks 获取匹配 tagName 的标签
   * @param lessThan 如果存在，将匹配小这个版本的标签
   */
  async matchVersionTags(tagName: string, lessThan?: string | SemverVersion) {
    new SemverVersion(tagName);
    const output = await execCmdWaitExit("git", {
      args: ["tag", "-l", tagName],
    });
    if (lessThan && typeof lessThan === "string") {
      lessThan = new SemverVersion(lessThan);
    }
    return output.split("\n").filter((item) => {
      if (item.length === 0) return false;
      if (lessThan) return SemverVersion.compare(item, lessThan) === -1;
      return true;
    });
  },
};
type UpdateRes = {
  dirname: string;
  isAdded: boolean;
  version: SemverVersion;
  tag: string;
};

/**
 * @public
 * @remarks 如果 allTags 中不存在 标签, 则执行 git 添加标签命令
 */
export async function setTagIfUpdate(allTags: Set<string>, tag: string, opts: { dryRun?: boolean } = {}) {
  const { dryRun } = opts;

  const has = allTags.has(tag);
  if (has) {
    console.log(tag + ": skin");
    return false;
  }

  if (!dryRun) await gitCmd.tag.add(tag);
  console.log(tag + ": added" + (dryRun ? "(dryRun)" : ""));
  return true;
}

export const npmPkg = {
  /** 读取 npm 包的版本字段 */
  async readVersion(pkgDir: string, prefix?: string) {
    const filename = path.resolve(pkgDir, "package.json");
    const json: Record<string, any> = JSON.parse(await Deno.readTextFile(filename));
    if (typeof json.version !== "string") throw new Error("不存在 version 字段");
    return new SemverVersion(prefix ? prefix + json.version : json.version);
  },
  /**
   * @param map prefix -> dirname 前缀到 npm 包的目录映射
   * @param opts.dryRun 如果为 true, 则不会进行任何修改, 可用于测试
   * @remarks 根据 package.json 中的 version 设置标签(如果标签不存在)
   * @deprecated 建议使用 setPnpmWorkspaceTags
   */
  async setGitTagsFromPkg(
    map: Record<string, string>,
    allTags: Set<string>,
    opts: { dryRun?: boolean } = {}
  ): Promise<{ map: Map<string, UpdateRes>; addedList: SemverVersion[]; skinAll: boolean }> {
    const resMap: Map<string, UpdateRes> = new Map();
    const addedList: SemverVersion[] = [];
    for (const [prefix, dirname] of Object.entries(map)) {
      const res = await this.setGitTagFromPkg(prefix, dirname, allTags, opts);
      if (res.isAdded) addedList.push(res.version);
      resMap.set(prefix, res);
    }

    return { map: resMap, addedList, skinAll: addedList.length === 0 };
  },

  async setGitTagFromPkg(
    prefix: string,
    dirname: string,
    allTags: Set<string>,
    opts?: { dryRun?: boolean }
  ): Promise<UpdateRes> {
    const version = await npmPkg.readVersion(dirname, prefix);
    const tag = version.toString();
    const isAdded = await setTagIfUpdate(allTags, tag, opts);
    return { version, tag, isAdded, dirname };
  },
};
/** 对PNPM工作区中的子包打标签(如果标签不存在). 返回已经添加的标签 */
export async function setPnpmWorkspaceTags(
  allTags: Set<string>,
  opts: {
    dryRun?: boolean;
  } = {}
) {
  const { dryRun } = opts;
  const { success } = await pkg.findPnpmWorkspacePkgs(".");

  if (success.length === 0) console.log("没有任何升级, 跳过");
  const tags: string[] = [];
  for (const { pkg, dir } of success) {
    let name: string = pkg.name;
    if (typeof name !== "string") {
      name = dir.slice(dir.lastIndexOf(path.sep));
    }
    if (name.startsWith("@")) name = name.slice(name.indexOf("/") + 1);
    if (name === "") throw new Error(dir + ": 包名无效");

    const version = new SemverVersion(pkg.version);
    version.prefix = name + "/v";
    const tag = version.toString();
    if (allTags.has(tag)) {
      console.log(tag + ": skin");
      continue;
    }

    tags.push(tag);
  }

  for (const tag of tags) {
    if (!dryRun) await gitCmd.tag.add(tag);
    console.log(tag + ": added");
  }
  return tags;
}
/** 从远程仓库删除匹配的标签 */
export async function deleteMatchFromRemote(
  allTags: Set<string>,
  matchList: (string | SemverVersion) | (string | SemverVersion)[],
  level: "major" | "minor" | "patch"
) {
  const needDeletes = matchVersions(allTags, matchList, level);
  if (needDeletes.length === 0) return;

  console.log("正在删除: " + needDeletes.join(", "));
  await git.tag.deleteRemote(needDeletes);
  console.log("已删除");
  return needDeletes;
}

export function matchVersions(
  allTags: Set<string> | string[],
  matchList: (string | SemverVersion) | (string | SemverVersion)[],
  level: "major" | "minor" | "patch"
) {
  const versionList = new Set<SemverVersion>();
  for (const tag of allTags) {
    const v = SemverVersion.safeCreate(tag);
    if (v) versionList.add(v);
  }
  if (!(matchList instanceof Array)) matchList = [matchList];

  const matchVersionList: SemverVersion[] = [];
  for (const vStr of matchList) {
    const version = SemverVersion.safeCreate(vStr);
    if (!version) continue;
    switch (level) {
      case "major":
        version.major = NaN;
        version.minor = NaN;
        version.patch = NaN;
        break;
      case "minor":
        version.minor = NaN;
        version.patch = NaN;
        break;
      case "patch":
        version.patch = NaN;
        break;
      default:
        continue;
    }
    matchVersionList.push(version);
  }

  const match: string[] = [];
  for (const matchVersion of matchVersionList) {
    for (const version of versionList) {
      if (matchVersion.include(version)) {
        versionList.delete(version);
        match.push(version.toString());
      }
    }
  }
  return match;
}
