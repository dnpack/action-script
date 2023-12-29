import { extract, Headers, Pack, pack } from "../../deps/tar-stream.ts";
import { Readable, Writable } from "node:stream";
import { Buffer } from "node:buffer";

export type ChunkInfo = Pick<Headers, "mode" | "gid" | "uid" | "size" | "mtime"> & {
  type: "file" | "link" | "symlink" | "directory";
};
/**
 * @public
 * @remarks Tar 流
 */
export class TarStream {
  private pack: Pack;
  readable: ReadableStream<Uint8Array>;
  constructor() {
    this.pack = pack({ emitClose: true });
    this.readable = Readable.toWeb(this.pack) as ReadableStream;
    this.pack.on("error", (err) => {});
  }
  ended = false;
  /** @remarks 添加文件 */
  async add(name: string, content: ReadableStream<Uint8Array> | Uint8Array, chunkInfo: ChunkInfo) {
    if (this.ended) throw new Error("ended");
    let hd;
    const pms = new Promise((resolve, reject) => {
      hd = { resolve, reject };
    });

    if (content instanceof Uint8Array) {
      this.pack.entry({ ...chunkInfo, name }, content as any);
    } else {
      const stream = this.pack.entry({ ...chunkInfo, name }, (err) => {
        err ? hd!.reject(err) : hd!.resolve();
      });
      try {
        for await (const chunk of content) {
          await writeStream(stream, chunk);
        }
      } finally {
        stream.end();
      }
    }

    return pms;
  }
  private endPromise?: Promise<void>;
  end(): Promise<void> {
    if (this.endPromise) return this.endPromise;
    else if (this.ended) return Promise.resolve();

    this.endPromise = new Promise<void>((resolve, reject) => {
      this.pack.on("close", () => {
        this.endPromise = undefined;
        this.pack.errored ? reject(this.pack.errored) : resolve();
      });
      this.pack.finalize();
      this.ended = true;
    });
    return this.endPromise;
  }
}
export async function* unTarStream(readable: AsyncIterable<Uint8Array>) {
  const stream = extract({});
  async function itr() {
    for await (const chunk of readable) {
      stream.write(Buffer.from(chunk));
    }
  }
  itr().catch(() => {}).finally(() => stream.end());
  for await (const chunk of stream) {
    const headers = chunk.header;
    yield { headers, readable: Readable.toWeb(chunk) };
  }
}
function writeStream(writable: Writable, chunk: Uint8Array) {
  return new Promise((resolve, reject) => writable.write(chunk, (err) => err ? reject(err) : resolve));
}
