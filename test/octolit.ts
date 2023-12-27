import { unsafeFetch } from "../lib/fetch.ts";
import { Octokit } from "npm:@octokit/rest";
const TOKEN = "";

export const octokit = new Octokit({
  auth: TOKEN,
  request: {
    fetch: unsafeFetch,
  },
});
