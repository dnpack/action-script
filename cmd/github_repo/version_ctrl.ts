import type { SemverVersion } from "../../lib.ts";
import { getEnvStrict, mergeInfo, octokit } from "./private/ci_octokit.ts";
import { matchRepoVersions } from "./private/match_tag.ts";
import * as actions from "../../deps/actions/core.ts";

/**
 * @public
 * @remarks 从远程仓库删除匹配的标签, 并打印结果信息
 * @remarks 默认从 GITHUB_REPOSITORY 环境变量获取远程仓库
 */
export async function deleteMatchVersionTag(
  allTags: Set<string>,
  matchList: (string | SemverVersion) | (string | SemverVersion)[],
  level: "major" | "minor" | "patch",
) {
  const { owner, repo } = mergeInfo();
  const needDeletes = matchRepoVersions(allTags, matchList, level);
  if (needDeletes.length === 0) return;

  console.log("正在删除: " + needDeletes.join(", "));

  const resList = await Promise.allSettled(
    needDeletes.map((tag) => octokit.git.deleteRef({ owner, repo, ref: "refs/tags/" + tag })),
  );
  const fail: any[] = [], success: any[] = [];
  for (const res of resList) {
    if (res.status === "rejected") fail.push(res.reason);
    else success.push(res.value);
  }
  const failMsg = fail.length ? (fail.join(",") + " 删除失败") : "";
  console.log(`成功删除 ${success.length} 标签。${failMsg}`);
  return needDeletes;
}

/**
 * @public
 * @remark 获取当前仓库的所有标签
 */
export async function listRemoteTags(matchPrix = "") {
  const { owner, repo } = mergeInfo();
  const { data } = await octokit.git.listMatchingRefs({ owner, repo, ref: "tags/" + matchPrix });
  return data.map((item) => item.ref.slice(10)); //  refs/tags/
}
/**
 * @public
 * @remarks 在当前仓库创建一个标签
 * @param sha 如果不存在，则从 GITHUB_SHA 环境变量获取 (触发 Actions 的提交)
 */
export async function addRemoteTag(tagName: string, sha = getEnvStrict("GITHUB_SHA")) {
  const { owner, repo } = mergeInfo();
  const { data } = await octokit.git.createRef({ owner, repo, ref: "refs/tags/" + tagName, sha });
}
/**
 * @remark 获取远程仓库的标签。 如果不存在，则抛出异常
 */
export async function getRemoteTag(tagName: string) {
  const { owner, repo } = mergeInfo();
  return octokit.git.getRef({ owner, repo, ref: "refs/tags/" + tagName });
}

function tagExist(tagName: string) {
  return getRemoteTag(tagName).then(() => true, () => false);
}

/** @public */
export interface PublishFlowOpts {
  /** 发布过程。如果抛出异常，则跳过添加标签的步骤，否则添加返回的标签 */
  publish?: (needUpdate: Set<string>) => Promise<Iterable<string>> | Iterable<string>;
  /** 如果指定，则通过这个判断是否存在标签，否则从远程仓库判读是否存在标签 */
  allTags?: Set<string>;
  /** 模拟执行，不会更改标签 */
  dryRun?: boolean;
}
/**
 * @public
 * @remarks 一个发布流程： 检查版本是否存在，如果不存在存在，执行发布，发布成功后添加标签到远程
 */
export async function publishFlow(tags: string | Iterable<string>, opts: PublishFlowOpts = {}) {
  if (typeof tags === "string") tags = [tags];
  let { allTags, publish, dryRun } = opts;

  const needUpdateTags = new Set(tags);

  if (needUpdateTags.size > 1) {
    if (!allTags) allTags = new Set(await listRemoteTags());
    for (const tag of needUpdateTags) {
      if (allTags.has(tag)) needUpdateTags.delete(tag);
    }
  } else {
    const tag = Array.from(needUpdateTags)[0];
    let exist: boolean;
    if (allTags) exist = allTags.has(tag);
    else exist = await tagExist(tag);

    if (!exist) needUpdateTags.clear();
  }
  if (needUpdateTags.size === 0) {
    console.log("没有更新版本，跳过发布");
    return;
  }

  let needAdd: Iterable<string>;
  try {
    needAdd = await publish?.(needUpdateTags) ?? [];
  } catch (error) {
    actions.error("发布失败", { title: error?.message });
    throw error;
  }
  const success: string[] = [], fails: string[] = [];
  for (const tag of needAdd) {
    try {
      if (!dryRun) await addRemoteTag(tag);
      success.push(tag);
    } catch (error) {
      fails.push(tag);
    }
  }
  if (success.length) actions.notice(`成功添加${success.length}个标签: ${success.join(", ")}`);
  else if (fails.length === 0) actions.notice("跳过添加标签");
  if (fails.length) {
    actions.error(`标签添加失败: ${fails.join(", ")}`);
  }
}
