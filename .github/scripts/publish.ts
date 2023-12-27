import { setTagIfUpdate } from "../../cmd/package.ts";
import { git as gitCmd, setCIUser } from "../../cmd/github_repo.ts";
import { execCmdSync } from "../../lib.ts";
import * as action from "npm:@actions/core@1.10.x";
import denoJson from "../../deno.json" assert { type: "json" };
const tag = denoJson.version;

action.startGroup("deno output");

const allTags: Set<string> = new Set(await gitCmd.tag.getRemoteTags());
const isCI = Deno.env.get("CI") === "true";
if (isCI) await setCIUser();

const isAdded = await setTagIfUpdate(allTags, tag, { dryRun: !isCI });

if (!isAdded) {
  console.log("skin publish");
} else {
  execCmdSync("git", ["push", "--tag"], {
    exitIfFail: true,
    beforeExit: () => {
      action.error("标签推送失败: " + tag);
      action.endGroup();
      Deno.exit(0);
    },
  });
  // await deleteMatchFromRemote(allTags, tag, "patch").catch((e) => action.error("删除标签失败: " + e?.message));
}

action.endGroup();
