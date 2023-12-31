import { publishFlow } from "../../cmd/github_repo.ts";
import denoJson from "../../deno.json" assert { type: "json" };
const tag = denoJson.version;

console.log("::endgroup::");

await publishFlow(tag, { tagFailThrow: true });
