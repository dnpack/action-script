import { SemverVersion } from "../lib/version.ts";
import { execCmdWaitExit } from "./private/exec.ts";
import path from "node:path";

const gitAction = {
    async addTag(tagName: string, msg = tagName) {
        return execCmdWaitExit("git", { args: ["tag", "-a", tagName, "-m", msg] });
    },
    async deleteTags(tagName: string, lessThan: string | SemverVersion) {
        if (typeof lessThan === "string") lessThan = new SemverVersion(lessThan);
        const tags = await this.matchTags(tagName, lessThan);
        if (tags.length === 0) return [];
        await execCmdWaitExit("git", { args: ["tag", "-d", ...tags] });
        return tags;
    },
    /**
     * @remarks 获取匹配 tagName 的标签
     * @param lessThan 如果存在，将匹配小这个版本的标签
     */
    async matchTags(tagName: string, lessThan?: string | SemverVersion) {
        const output = await execCmdWaitExit("git", { args: ["tag", "-l", tagName] });
        if (lessThan && typeof lessThan === "string") lessThan = new SemverVersion(lessThan);
        return output.split("\n").filter((item) => {
            if (item.length === 0) return false;
            if (lessThan) return SemverVersion.compare(item, lessThan) === -1;
            return true;
        });
    },
    async push() {
        return execCmdWaitExit("git", { args: ["push", "--tag"] });
    },
};

export interface ExecCmdIfUpdateOpts {
    /** 如果为 true，在添加标签之前删除所有匹配的 minor 版本。 例如存在 1.2.1 1.2.3， 添加标签之前删除他们*/
    deletePatch?: boolean;
}
/**
 * 如果不存在标签， 则执行命令并添加标签
 *
 * @param options deletePatch: 删除 小于传入的所有 patch 版本
 * @returns 如果存在匹配（无需升级）返回 null. 否则返回 删除的 tag 列表
 */
export async function updateGitTag(versionStr: string, options: ExecCmdIfUpdateOpts = {}) {
    const currentVersion = new SemverVersion(versionStr);
    const { deletePatch } = options;
    const matchTags = await gitAction.matchTags(versionStr);
    if (matchTags.length > 0) return null;

    let deleteTags: string[] = [];
    if (deletePatch) {
        currentVersion.anyFlag = "*";
        deleteTags = await gitAction.deleteTags(versionStr.toString(), versionStr);
    }
    await gitAction.addTag(versionStr);

    return deleteTags;
}
export const npmPkg = {
    async readVersion(pkgDir: string) {
        const filename = path.resolve(pkgDir, "package.json");
        const json: Record<string, any> = JSON.parse(await Deno.readTextFile(filename));
        if (typeof json.version !== "string") throw new Error("version 字段不存在");
        return json.version;
    },
    /**
     * map:  prefix -> dirname
     * @returns 如果添加了 tag, 则返回 true. 否则返回 false
     */
    async updatePkgTags(map: Record<string, string>, options: ExecCmdIfUpdateOpts) {
        let skin = true;
        for (const [prefix, dirname] of Object.entries(map)) {
            const version: string = await npmPkg.readVersion(dirname);
            const tag = prefix + version;
            const deletes = await updateGitTag(tag, options);
            if (deletes === null) {
                console.log(tag + ": skin");
                continue;
            }
            console.log(tag + ": added");
            skin = false;

            if (deletes.length) console.log(prefix + ": delete tags[" + deletes.join(", ") + "]");
        }
        return skin;
    },
};

export { execCmdWaitExit };
