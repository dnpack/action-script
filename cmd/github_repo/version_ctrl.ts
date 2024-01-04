import type { SemverVersion } from "../../lib.ts";
import { getEnvStrict, mergeInfo, RepoInfoOpts } from "./private/ci_octokit.ts";
import type { Octokit } from "../../deps/octokit.ts";
import { matchRepoVersions } from "./private/match_tag.ts";

/** @public */
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
