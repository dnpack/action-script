import { addRemoteTagIfNotExist } from "../../cmd/github_repo.ts";
import * as action from "npm:@actions/core@1.10.x";
import denoJson from "../../deno.json" assert { type: "json" };
const tag = denoJson.version;

action.endGroup();

const isAdded = await addRemoteTagIfNotExist(tag);

if (!isAdded) {
  console.log("skin publish");
} else {
  console.log(`Published ${tag}`);
  // await deleteMatchVersions(allTags, tag, "patch").catch((e) => action.error("删除标签失败: " + e?.message));
}
