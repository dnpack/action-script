import { SemverVersion } from "../lib/version.ts";
import { execCmdWaitExit } from "./private/exec.ts";
import * as gitCmd from "./git.ts";
import path from "node:path";

export const gitAction = {
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
  /** @remarks 获取所有的远程标签 */
  async getRemoteTags() {
    const output = await execCmdWaitExit("git", {
      args: ["ls-remote", "--tag"],
    });
    const tags: string[] = [];
    for (const item of output.split("\n")) {
      if (item.endsWith("^{}") || item.length === 0) continue;
      const res = item.match(/refs\/tags\/(?<tag>.+)$/)?.groups;
      if (res) tags.push(res.tag);
    }
    return tags;
  },
  /** @remarks 匹配远程标签*/
  async matchRemoteVersionTags(version: string | SemverVersion) {
    if (typeof version === "string") version = new SemverVersion(version);
    const tags = await this.getRemoteTags();
    const filterList: string[] = [];
    for (const tag of tags) {
      try {
        if (version.include(tag)) filterList.push(tag);
      } catch (error) {}
    }
    return filterList;
  },
  /**
   * @remarks 从远程搜索标签, 如果不存在标签, 则添加标签. 如果存在, 跳过添加
   * @returns 如果成功添加, 则返回 true, 否则返回 false
   */
  async setTag(versionTag: string) {
    const matchTags = await gitAction.matchRemoteVersionTags(new SemverVersion(versionTag));
    if (matchTags.length > 0) return false;
    await gitCmd.tag.add(versionTag);
    return true;
  },
};
type UpdateRes = {
  dirname: string;
  isAdded: boolean;
  version: SemverVersion;
};
export const npmPkg = {
  /** 读取 npm 包的版本字段 */
  async readVersion(pkgDir: string) {
    const filename = path.resolve(pkgDir, "package.json");
    const json: Record<string, any> = JSON.parse(await Deno.readTextFile(filename));
    if (typeof json.version !== "string") throw new Error("不存在 version 字段");
    return new SemverVersion(json.version);
  },
  /**
   * @param map prefix -> dirname 前缀到 npm 包的目录映射
   * @remarks 根据 package.json 中的 version 设置标签(如果标签不存在)
   */
  async setGitTagsFromPkg(map: Record<string, string>): Promise<Map<string, UpdateRes>> {
    const res: Map<string, UpdateRes> = new Map();
    for (const [prefix, dirname] of Object.entries(map)) {
      const version = await npmPkg.readVersion(dirname);
      const tag = prefix + version.toString();
      const isAdded = await gitAction.setTag(tag);
      res.set(prefix, { dirname: dirname, isAdded, version });
      if (!isAdded) {
        console.log(tag + ": skin");
        continue;
      }
      console.log(tag + ": added");
    }
    return res;
  },
};

export { execCmdWaitExit };
