import { execCmdWaitExit } from "./exec.ts";

export const config = {
  async setUser(name: string, email: string) {
    await execCmdWaitExit("git", { args: ["config", "user.name", name] });
    await execCmdWaitExit("git", { args: ["config", "user.email", email] });
  },
};
export const tag = {
  async add(tagName: string, msg = tagName) {
    return execCmdWaitExit("git", { args: ["tag", "-a", tagName, "-m", msg] });
  },
  async push() {
    return execCmdWaitExit("git", { args: ["push", "--tag"] });
  },
};
