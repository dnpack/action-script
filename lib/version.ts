export interface VersionBase {
    prefix: string;
    version: string;
    suffix: string;

    major: number;
    minor: number;
    patch: number;

    tag?: string;
    tagNum?: number;
}
export class SemverVersion implements VersionBase {
    static compare(v1: SemverVersion | string, v2: SemverVersion | string): 0 | 1 | -1 {
        if (typeof v1 === "string") v1 = new SemverVersion(v1);
        if (typeof v2 === "string") v2 = new SemverVersion(v2);

        let res = v1.major - v2.major;
        if (res > 0) return 1;
        else if (res < 0) return -1;

        res = v1.minor - v2.minor;
        if (res > 0) return 1;
        else if (res < 0) return -1;

        res = v1.patch - v2.patch;
        if (res > 0) return 1;
        else if (res < 0) return -1;

        const v1Suffix = v1.suffix,
            v2Suffix = v2.suffix;

        if (v1Suffix && !v2Suffix) return 1;
        else if (v2Suffix && !v1Suffix) return -1;
        else if (v1Suffix === v2Suffix) return 0;

        if (v1.tagNum === undefined && v1.tagNum !== undefined) return -1;
        else if (v2.tagNum === undefined && v1.tagNum !== undefined) return 1;

        res = v1.tagNum! - v2.tagNum!;
        if (res < 0) return -1;
        else if (res > 0) return 1;
        else return 0;
    }
    prefix: string;
    get version() {
        const { major, minor, patch } = this;
        const anyFlag = this.anyFlag;
        return `${isNaN(major) ? anyFlag : major}.${isNaN(minor) ? anyFlag : minor}.${isNaN(patch) ? anyFlag : patch}`;
    }

    major: number;
    minor: number;
    patch: number;

    get suffix() {
        if (this.tag) {
            if (this.tagNum === undefined) return "-" + this.tag;
            return `-${this.tag}.${this.tagNum}`;
        } else if (this.tagNum) return "-" + this.tagNum;
        return "";
    }
    set suffix(suffix: string) {
        if (suffix === "") {
            this.tag = undefined;
            this.tagNum = undefined;
        } else if (suffix[0] === "-") {
            const group = suffix.match(/^-(?<tag>[^\.]+)(\.(?<tagNum>\d*))?$/)?.groups;
            if (group) {
                if (!group.tagNum && /^\d+$/.test(group.tag)) {
                    this.tagNum = +group.tag;
                } else {
                    this.tag = group.tag;
                    const tagNum = +group.tagNum;
                    this.tagNum = isNaN(tagNum) ? undefined : tagNum;
                }
            }
        } else throw new Error("suffix 必须以 '-'开头");
    }
    tag?: string;
    tagNum?: number;
    constructor(versionStr: string) {
        const regExp =
            /^(?<prefix>\D*)(?<major>[x\*]|(\d+))\.(?<minor>[x\*]|(\d+))\.(?<patch>[x\*]|(\d+))(?<suffix>.*)$/;
        const group = versionStr.match(regExp)?.groups;
        if (!group) throw new InvalidVersionError(versionStr);
        this.prefix = group.prefix;
        this.major = +group.major;
        this.minor = +group.minor;
        this.patch = +group.patch;
        this.suffix = group.suffix;
    }
    update(type: "major" | "minor" | "patch" | "tagNum") {
        switch (type) {
            case "major":
                this.major++;
                this.minor = 0;
                this.patch = 0;
                break;

            case "minor":
                this.minor++;
                this.patch = 0;
                break;
            case "patch":
                this.patch++;
                break;
            default:
                if (this.tagNum !== undefined) this.tagNum++;
        }
    }
    include(version: string | SemverVersion) {
        if (typeof version === "string") version = new SemverVersion(version);
        if (!isNaN(this.major) && this.major !== version.major) return false;
        if (!isNaN(this.minor) && this.minor !== version.minor) return false;
        if (!isNaN(this.patch) && this.patch !== version.patch) return false;
        return true;
    }
    anyFlag = "x";
    toString() {
        return this.prefix + this.version + this.suffix;
    }
    valueOf() {
        return this.toString();
    }
}
class InvalidVersionError extends Error {
    constructor(versionStr: string) {
        super(versionStr + " 不是有效的版本号");
    }
}
