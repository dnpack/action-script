import { SemverVersion, execCmdWaitExit } from "../../lib.ts";
import * as pkg from "./workspace.ts";
import * as gitCmd from "../private/git.ts";
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
};
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
    opts: { dryRun?: boolean } = {}
  ): Promise<UpdateRes> {
    const { dryRun } = opts;
    const version = await npmPkg.readVersion(dirname, prefix);
    const tag = version.toString();

    const has = allTags.has(tag);
    if (has) {
      console.log(tag + ": skin");
      return { version, isAdded: false, dirname };
    }
    if (!dryRun) await gitCmd.tag.add(tag);
    console.log(tag + ": added");
    return { version, isAdded: true, dirname };
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
