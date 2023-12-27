import { SemverVersion, execCmdWaitExit } from "../../lib.ts";
import * as gitCmd from "../private/git.ts";

/** @remarks 从远程仓库删除匹配的标签 */
export async function deleteMatchVersions(
  allTags: Set<string>,
  matchList: (string | SemverVersion) | (string | SemverVersion)[],
  level: "major" | "minor" | "patch"
) {
  const needDeletes = matchRepoVersions(allTags, matchList, level);
  if (needDeletes.length === 0) return;

  console.log("正在删除: " + needDeletes.join(", "));
  await gitCmd.tag.deleteRemote(needDeletes);
  console.log("已删除");
  return needDeletes;
}
/**
 * @public
 * @remarks 按规则过滤标签
 * @param allTags 标签列表
 * @param matchList 要匹配的版本号
 * @param level
 * major: 匹配所有 matchList 中指定的主版本号\
 * minor: 匹配所有 matchList 中主版本号和次版本号\
 * patch: 匹配所有 matchList 版本
 */
export function matchRepoVersions(
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
