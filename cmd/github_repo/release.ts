import { pack } from "../pack/pack.ts";
import type { Octokit } from "../../deps/octokit.ts";
import { mergeInfo, octokit } from "./private/ci_octokit.ts";

export class Release {
  static async publish(
    tagName: string,
    opts: { name?: string; body?: string; prerelease?: boolean } = {},
  ) {
    const { owner, repo } = mergeInfo();
    const res = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: opts.name,
      body: opts.body,
      prerelease: opts.prerelease,
    });
    const { id, url, upload_url } = res.data;

    return { id, url, upload_url };
  }
  constructor(readonly owner: string, readonly repo: string, readonly id: number, private octokit: Octokit) {}
  async addAssets(filepath: string, name: string) {
    using file = await Deno.open(filepath);
    const stat = await file.stat();
    const { data } = await this.octokit.repos.uploadReleaseAsset({
      owner: this.owner,
      repo: this.repo,
      name,
      data: file.readable as any,
      release_id: this.id,
      headers: {
        "content-length": stat.size,
        "content-type": "application/tgz",
      },
    });
    const { uploader, state, download_count, created_at, updated_at, label, ...res } = data;
    return res;
  }
  async addAssetsByMatchFile(dir: string, match: string[], name: string) {
    const tempFile = await Deno.makeTempFile();
    const fileList = await pack(dir, tempFile, { gzip: true, globMatch: match, overTarget: true });
    const data = await this.addAssets(tempFile, name);
    await Deno.remove(tempFile);
    return { ...data, fileList };
  }
  async deleteAssets(assetId: number) {
    return this.octokit.repos.deleteReleaseAsset({ owner: this.owner, repo: this.repo, asset_id: assetId });
  }
}
