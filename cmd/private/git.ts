import { execCmdWaitExit } from "../../lib.ts";

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
  async deleteRemote(tags: string[], remote = "origin") {
    return execCmdWaitExit("git", { args: ["push", remote, ...tags.map((tag) => ":" + tag)] });
  },
  /** @remarks 获取所有的远程标签 */
  async getRemoteTags() {
    const output = await execCmdWaitExit("git", {
      args: ["ls-remote", "--tag"],
    });
    const tags: string[] = [];
    for (const item of output.split("\n")) {
      if (item.endsWith("^{}") || item.length === 0) continue;
      const res = item.match(/refs\/tags\/(?<tag>.+)$/)?.groups;
      if (res) tags.push(res.tag);
    }
    return tags;
  },
};
