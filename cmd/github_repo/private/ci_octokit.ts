import { rest } from "../../../deps/octokit.ts";
const { Octokit } = rest;
const env = Deno.env;

export const GITHUB_TOKEN = env.get("GITHUB_TOKEN");

const [GITHUB_OWNER, GITHUB_REPO] = env.get("GITHUB_REPOSITORY")?.split("/") ?? [];
export const octokit = new Octokit({ auth: GITHUB_TOKEN });
export interface RepoInfoOpts {
  owner?: string;
  repo?: string;
  token?: string;
}

export function mergeInfo(info: RepoInfoOpts = {}) {
  const { owner = GITHUB_OWNER, repo = GITHUB_REPO, token = GITHUB_TOKEN } = info;
  if (!owner || !repo) throw new Error("需要指定 GITHUB_REPOSITORY 环境变量");
  return { owner, repo, token, octokit: new Octokit({ auth: token }) };
}
export function getEnvStrict(key: string) {
  const env = Deno.env.get(key);
  if (!env) throw new Error("需要指定 " + key + " 环境变量");
  return env;
}
