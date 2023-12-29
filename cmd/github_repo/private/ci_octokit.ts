import { rest } from "../../../deps/octokit.ts";
const { Octokit } = rest;
const env = Deno.env;

export const GITHUB_TOKEN = env.get("GITHUB_TOKEN");

const GITHUB_REPO = env.get("GITHUB_REPOSITORY")?.split("/")?.[1];
const GITHUB_OWNER = env.get("GITHUB_REPOSITORY_OWNER");
export const octokit = new Octokit({ auth: GITHUB_TOKEN });

export function mergeInfo(info: { owner?: string; repo?: string } = {}) {
  const { owner = GITHUB_OWNER, repo = GITHUB_REPO } = info;
  if (!owner || !repo) throw new Error("请指定 GITHUB_OWNER 和 GITHUB_REPO 环境变量");
  return { owner, repo };
}
export function getEnvStrict(key: string) {
  const env = Deno.env.get(key);
  if (!env) throw new Error("需要指定 " + key + " 环境变量");
  return env;
}
