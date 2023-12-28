import { unsafeFetch } from "../lib/fetch.ts";
import { Octokit } from "../deps/octokit.ts";
const TOKEN = "";

export const octokit = new Octokit({
  auth: TOKEN,
  request: {
    fetch: unsafeFetch,
  },
});
