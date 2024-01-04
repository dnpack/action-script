import { tagPublishFlow } from "../../cmd/github_repo.ts";

console.log("::endgroup::");
await tagPublishFlow("NEW_TAG", () => {});
