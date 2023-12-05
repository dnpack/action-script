import { SemverVersion, VersionBase } from "./version.ts";
import { assertEquals, assertObjectMatch, assert, assertThrows, assertFalse } from "std/assert/mod.ts";
const { test } = Deno;
const basePase = {
    major: 1,
    minor: 21,
    patch: 4,
};
test("基础版本", function () {
    const version = new SemverVersion("1.21.4");
    const versionBase = toVersionBase(version);
    assertObjectMatch(versionBase, {
        ...basePase,
        prefix: "",
        suffix: "",
        version: "1.21.4",
    } as VersionBase as any);
});
test("带前缀", function () {
    const version = new SemverVersion("v1.21.4");
    const versionBase = toVersionBase(version);
    assertObjectMatch(versionBase, {
        ...basePase,
        prefix: "v",
        suffix: "",
        version: "1.21.4",
        tag: undefined,
        tagNum: undefined,
    } as VersionBase as any);
});
test("只有tag后缀", function () {
    const version = new SemverVersion("1.21.4-beta");
    const versionBase = toVersionBase(version);
    assertObjectMatch(versionBase, {
        ...basePase,
        prefix: "",
        suffix: "-beta",
        tag: "beta",
        tagNum: undefined,
        version: "1.21.4",
    } as VersionBase as any);
});
test("只有tagNum后缀", function () {
    const version = new SemverVersion("1.21.4-3");
    const versionBase = toVersionBase(version);
    assertObjectMatch(versionBase, {
        ...basePase,
        prefix: "",
        suffix: "-3",
        tag: undefined,
        tagNum: 3,
        version: "1.21.4",
    } as VersionBase as any);
});
test("标准解析", function () {
    const version = new SemverVersion("v1.21.4-beta.9");
    const versionBase = toVersionBase(version);
    assertObjectMatch(versionBase, {
        ...basePase,
        prefix: "v",
        suffix: "-beta.9",
        version: "1.21.4",
        tag: "beta",
        tagNum: 9,
    } as VersionBase as any);
});
test("错误的版本号", function () {
    assertThrows(() => new SemverVersion("1.2.i"));
    assertThrows(() => new SemverVersion("1.2.2.beta"));
    assertThrows(() => new SemverVersion("1.-.i"));
});
test("比较", function () {
    assertEquals(SemverVersion.compare("1.2.3", "1.2.2"), 1);
    assertEquals(SemverVersion.compare("1.2.4", "1.2.4"), 0);
    assertEquals(SemverVersion.compare("1.5.3", "1.2.43"), 1);
    assertEquals(SemverVersion.compare("2.1.3", "1.2.43"), 1);

    assertEquals(SemverVersion.compare("1.2.3-beta", "1.2.3"), 1);
    assertEquals(SemverVersion.compare("1.2.3-1", "1.2.3"), 1);
    assertEquals(SemverVersion.compare("1.2.3-beta.4", "1.2.3-beta.3"), 1);

    assertEquals(SemverVersion.compare("1.2.3", "1.x.2"), 1);
});
test("toString", function () {
    assertEquals(new SemverVersion("1.2.x").toString(), "1.2.x");
    assertEquals(new SemverVersion("1.*.x").toString(), "1.x.x");
    assertEquals(new SemverVersion("*.2.x").toString(), "x.2.x");
});
test("include", function () {
    assert(new SemverVersion("1.2.x").include("1.2.4"));
    assert(new SemverVersion("1.2.x").include("1.2.x"));
    assertFalse(new SemverVersion("1.2.x").include("1.3.4"));
    assertFalse(new SemverVersion("1.2.x").include("2.0.0"));

    assert(new SemverVersion("1.x.x").include("1.3.x-beta"));
    assert(new SemverVersion("1.x.x").include("1.3.3-3"));
    assertFalse(new SemverVersion("1.x.x").include("2.0.0"));
    assert(new SemverVersion("x.x.x").include("2.4.5"));
});
function toVersionBase(version: SemverVersion): VersionBase {
    return {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        prefix: version.prefix,
        suffix: version.suffix,
        version: version.version,
        tag: version.tag,
        tagNum: version.tagNum,
    };
}
