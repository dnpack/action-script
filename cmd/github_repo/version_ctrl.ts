import type { SemverVersion } from "../../lib.ts";
import { getEnvStrict, mergeInfo, octokit } from "./private/ci_octokit.ts";
import { matchRepoVersions } from "./private/match_tag.ts";

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
/**
 * @public
 * @remarks 在当前仓库创建一个标签
 * @param sha 如果不存在，则从 GITHUB_SHA 环境变量获取 (触发 Actions 的提交)
 * @returns 如果成功添加，返回 true，否则返回 false
 */
export function addRemoteTagIfNotExist(tagName: string, sha?: string) {
  return addRemoteTag(tagName, sha).then(() => true, () => false);
}
