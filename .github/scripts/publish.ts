import { publishFlow } from "../../cmd/github_repo.ts";
import * as action from "npm:@actions/core@1.10.x";
import denoJson from "../../deno.json" assert { type: "json" };
const tag = denoJson.version;

action.endGroup();

await publishFlow(tag, { publish: (needUpdate) => needUpdate });
