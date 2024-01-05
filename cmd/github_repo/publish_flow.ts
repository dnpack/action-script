import { getEnvStrict, RepoInfoOpts } from "./private/ci_octokit.ts";
import { GitHubRepo, githubRepo } from "./version_ctrl.ts";
import * as core from "../../deps/actions/core.ts";

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
export async function publishFlow(tags: string | Iterable<string>, opts: PublishFlowOpts = {}): Promise<Set<string>> {
  if (typeof tags === "string") tags = [tags];
  const { allTags, publish, dryRun, tagFailThrow } = opts;
  const repo = new GitHubRepo(opts);
  let publishMsg = `Repository: ${repo.owner}/${repo.repo}`;
  if (!repo.token) publishMsg += "(without github token)";
  console.log(publishMsg);

  let needUpdateTags = new Set(tags);
  if (typeof tags === "string") {
    needUpdateTags = new Set();
    const exist = allTags ? allTags.has(tags) : await repo.tagExist(tags);
    if (exist) needUpdateTags.add(tags);
  } else needUpdateTags = await repo.filterTagNoExist(tags, allTags);

  if (needUpdateTags.size === 0) {
    console.log("没有更新版本，跳过发布");
    return needUpdateTags;
  }

  if (publish) {
    try {
      const needAdd = await publish(needUpdateTags) ?? [];
      needUpdateTags = new Set(needAdd);
    } catch (err) {
      core.error("发布失败", { title: err?.message });
      throw err;
    }
  }

  console.log("将更新标签: " + Array.from(needUpdateTags).join(", "));

  const success: string[] = [], fails: string[] = [];
  for (const tag of needUpdateTags) {
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
  return needUpdateTags;
}

/**
 * @public
 * @remarks 过滤新标签，写入github actions 的输出
 * @param tags - 要检测的标签名
 * @param outputName actions 的输出名
 */
export async function writeNewTagsToOutput(
  tags: Iterable<string>,
  outputName: string,
) {
  console.log("Check: " + Array.from(tags).join(", "));
  const newTags: string[] = Array.from(await githubRepo.filterTagNoExist(tags));

  if (newTags.length) {
    console.log(`"Write ${newTags.join(", ")} to ${outputName}`);
    core.setOutput(outputName, JSON.stringify(newTags));
  } else {
    console.log("No update");
  }

  return newTags;
}
/**
 * @public
 * @remarks 如果是新标签，则写入到 actions 的输出
 * @param tag - 要检测的标签名
 * @param outputName actions 的输出名
 */
export async function writeNewTagToOutput(tag: string, outputName: string) {
  console.log("Check: " + tag);

  const exist = await githubRepo.tagExist(tag);
  if (!exist) {
    console.log(`Write tag '${tag}' to ${outputName}`);
    core.setOutput(outputName, tag);
  } else {
    console.log("No update");
  }
  return exist;
}
/**
 * @public
 * @remarks 从环境变量解析新标签
 */
function paseNewTagsFromOutput(name: string): Set<string> {
  const text = Deno.env.get(name);
  if (!text) throw new Error("请指定 " + name + "环境变量");
  let val: unknown;
  try {
    val = JSON.parse(text);
  } catch (error) {
    console.error("JSON解析失败");
    throw error;
  }
  if (!(val instanceof Array)) throw new Error("值必须是一个Array格式的JSON文本");
  return new Set(val);
}
/**
 * @public @remarks 单标签发布流
 */
export async function tagPublishFlow(envName: string, publish: (tag: string) => unknown) {
  const tag = Deno.env.get(envName);
  if (!tag) throw new Error("请指定 " + name + "环境变量");
  await publish(tag);
  try {
    await githubRepo.addTag(tag);
    core.notice("添加标签: " + tag);
  } catch (error) {
    console.error(error);
    core.warning("添加标签失败：" + tag);
  }
}
/**
 * @public @remarks 多标签发布流
 */
export async function tagsPublishFlow(envName: string, publish: (tags: Set<string>) => unknown) {
  const tags = paseNewTagsFromOutput(envName);

  await publish(tags);

  const waitList: Promise<{ tag: string; err?: boolean }>[] = [];
  for (const tag of tags) {
    waitList.push(githubRepo.addTag(tag).then(() => ({ tag }), (e) => ({ tag, err: e })));
  }

  const success: string[] = [], fails: string[] = [];
  for (const { err, tag } of await Promise.all(waitList)) {
    if (err === undefined) success.push(tag);
    else {
      console.error(err);
      fails.push(tag);
    }
  }
  if (success.length) {
    core.notice("添加标签: " + success.join(","));
  }
  if (fails.length) {
    core.warning("添加标签失败：" + fails.join(", "));
  }
}
