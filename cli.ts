import denoJson from "./deno.json" assert { type: "json" };
import { Command } from "https://esm.sh/commander@11";

const cmd = new Command("Action script").version(denoJson.version).addHelpCommand(false);
await cmd.parseAsync(["", "", ...Deno.args]);
