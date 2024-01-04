import { writeNewTagToOutput } from "../../cmd/github_repo.ts";
import denoJson from "../../deno.json" with { type: "json" };
console.log("::endgroup::");

await writeNewTagToOutput(denoJson.version, "NEW_TAG");
