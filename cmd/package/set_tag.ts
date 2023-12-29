import { SemverVersion } from "../../lib.ts";
import * as pkg from "./workspace.ts";
import * as gitCmd from "../private/git.ts";
import path from "node:path";

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

/** 对PNPM工作区中的子包打标签(如果标签不存在). 返回已经添加的标签 */
export async function setPnpmWorkspaceTags(
  allTags: Set<string>,
  opts: {
    dryRun?: boolean;
  } = {},
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
