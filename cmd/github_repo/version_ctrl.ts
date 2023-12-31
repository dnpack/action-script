import type { SemverVersion } from "../../lib.ts";
import { getEnvStrict, mergeInfo, RepoInfoOpts } from "./private/ci_octokit.ts";
import type { Octokit } from "../../deps/octokit.ts";
import { matchRepoVersions } from "./private/match_tag.ts";
import * as core from "../../deps/actions/core.ts";

export class GitHubRepo {
  readonly owner: string;
  readonly repo: string;
  readonly token?: string;
  private octokit: Octokit;
  constructor(opts?: RepoInfoOpts) {
    const info = mergeInfo(opts);
    this.repo = info.repo;
    this.owner = info.owner;
    this.token = info.token;
    this.octokit = info.octokit;
  }
  /**
   * @public
   * @remarks 从远程仓库删除匹配的标签, 并打印结果信息
   * @remarks 默认从 GITHUB_REPOSITORY 环境变量获取远程仓库
   */
  async deleteMatchVersionTag(
    allTags: Set<string>,
    matchList: (string | SemverVersion) | (string | SemverVersion)[],
    level: "major" | "minor" | "patch",
  ) {
    const { owner, repo, octokit } = this;
    const needDeletes = matchRepoVersions(allTags, matchList, level);
    if (needDeletes.length === 0) return;

    console.log("正在删除: " + needDeletes.join(", "));

    const resList = await Promise.allSettled(
      needDeletes.map((tag) => octokit.git.deleteRef({ owner, repo, ref: "tags/" + tag })),
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
  async listTags(matchPrix = "") {
    const { owner, repo, octokit } = this;
    const { data } = await octokit.git.listMatchingRefs({ owner, repo, ref: "tags/" + matchPrix });
    return data.map((item) => item.ref.slice(10)); //  refs/tags/
  }
  /**
   * @public
   * @remarks 在当前仓库创建一个标签
   * @param sha 如果不存在，则从 GITHUB_SHA 环境变量获取 (触发 Actions 的提交)
   */
  async addTag(tagName: string, sha = getEnvStrict("GITHUB_SHA")) {
    const { owner, repo, octokit } = this;
    const { data } = await octokit.git.createRef({ owner, repo, ref: "refs/tags/" + tagName, sha });
    return data;
  }
  /**
   * @remark 获取远程仓库的标签。 如果不存在，则抛出异常
   */
  async getTag(tagName: string) {
    const { owner, repo, octokit } = this;
    const { data } = await octokit.git.getRef({ owner, repo, ref: "tags/" + tagName });
    return data;
  }
  /**
   * @remarks 过滤在远程仓库中不存在的标签
   */
  async filterTagNoExist(tags: Iterable<string>, allTags?: Set<string>): Promise<Set<string>> {
    if (!allTags) {
      let tagList = await this.listTags();
      allTags = new Set(tagList);
    }

    const noExist = new Set<string>();
    for (const tag of tags) {
      if (!allTags.has(tag)) noExist.add(tag);
    }
    return noExist;
  }
  /**
   * @public
   * @remarks 检测 标签是否存在
   */
  async tagExist(tag: string): Promise<boolean> {
    const { repo, octokit, owner } = this;
    return octokit.git.getRef({ owner, repo, ref: "tags/" + tag }).then(() => true, (e) => {
      if (e?.status === 404) return false;
      else throw e;
    });
  }
}
/**
 * @public
 */
export const githubRepo = new GitHubRepo();

/** @public */
export interface PublishFlowOpts extends RepoInfoOpts {
  /** 发布过程。如果抛出异常，则跳过添加标签的步骤，否则添加返回的标签. 如果未指定函数, 则直接发布标签*/
  publish?: (needUpdate: Set<string>) => Promise<Iterable<string>> | Iterable<string>;
  /** 如果指定，则通过这个判断是否存在标签，否则从远程仓库判读是否存在标签 */
  allTags?: Set<string>;
  /** 模拟执行，不会更改标签 */
  dryRun?: boolean;
  /** 如果为 true, 则当标签发布失败时抛出异常*/
  tagFailThrow?: boolean;
}
/**
 * @public
 * @remarks 一个发布流程： 检查版本是否存在，如果不存在存在，执行发布，发布成功后添加标签到远程
 */
export async function publishFlow(tags: string | Iterable<string>, opts: PublishFlowOpts = {}) {
  if (typeof tags === "string") tags = [tags];
  let { allTags, publish, dryRun, tagFailThrow } = opts;
  const repo = new GitHubRepo(opts);
  let publishMsg = `Repository: ${repo.owner}/${repo.repo}`;
  if (!repo.token) publishMsg += "(without github token)";
  console.log(publishMsg);

  const needUpdateTags = new Set(tags);

  if (needUpdateTags.size > 1) {
    if (!allTags) allTags = new Set(await repo.listTags());
    for (const tag of needUpdateTags) {
      if (allTags.has(tag)) needUpdateTags.delete(tag);
    }
  } else {
    const tag = Array.from(needUpdateTags)[0];
    let exist: boolean;
    if (allTags) exist = allTags.has(tag);
    else exist = await repo.tagExist(tag);

    if (exist) needUpdateTags.clear();
  }
  if (needUpdateTags.size === 0) {
    console.log("没有更新版本，跳过发布");
    return;
  }

  let needAdd: Iterable<string>;
  if (publish) {
    try {
      needAdd = await publish(needUpdateTags) ?? [];
    } catch (err) {
      core.error("发布失败", { title: err?.message });
      throw err;
    }
  } else needAdd = needUpdateTags;

  console.log("将更新标签: " + Array.from(needAdd).join(", "));

  const success: string[] = [], fails: string[] = [];
  for (const tag of needAdd) {
    try {
      if (!dryRun) {
        const sha = getEnvStrict("GITHUB_SHA");
        core.debug(`Add tag ${tag}, sha=${sha}`);
        await repo.addTag(tag, sha);
      }
      success.push(tag);
    } catch (error) {
      if (tagFailThrow) throw error;
      else console.error(error);
      fails.push(tag);
    }
  }
  if (success.length) core.notice(`成功添加${success.length}个标签: ${success.join(", ")}`);
  else if (fails.length === 0) core.notice("跳过添加标签");
  if (fails.length) {
    core.error(`标签添加失败: ${fails.join(", ")}`);
  }
}
