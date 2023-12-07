import { unsafeFetch } from "../lib/fetch.ts";
import { Octokit } from "../cli/deps/github.ts";
const TOKEN = "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";

export const octokit = new Octokit({
    auth: TOKEN,
    request: {
        fetch: unsafeFetch,
    },
});
