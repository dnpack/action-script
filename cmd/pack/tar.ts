import tar from "npm:tar@6";
import { Readable, Writable } from "node:stream";
import { Stats } from "node:fs";
interface TarCreate {
  (): Readable;
}
interface TarExtract {
  (): Readable;
}

export const create: TarCreate = tar.create;
export const extract: TarExtract = tar.extract;

// export const replace: TarCreate = tar.replace;
// export const update: TarCreate = tar.update;
// export const list: TarCreate = tar.list;
interface Options {}

interface CreateOpts {
  /**  将 tarball 存档写入指定的文件名。如果指定了此值，则在写入文件时将触发回调，并将返回一个 promise，该 promise 将在写入文件时解析。如果未指定文件名，则将返回一个可读流，该流将发出文件数据。 */
  file: any;
  /**  同步行动。如果设置了此项，则在调用 后将完全写入任何提供的文件 tar.c 。如果设置了此设置，并且未提供文件，则生成的流将已经准备好数据， read 或者 emit('data') 在您请求数据时立即准备好数据。 */
  sync: any;
  /**  一个函数，如果遇到任何警告，都会被 (code, message, data) 调用。（请参阅“警告和错误”） */
  onwarn: any;
  /**  将警告视为值得崩溃的错误。默认值为 false。 */
  strict: any;
  /**  用于创建存档的当前工作目录。缺省值为 process.cwd() */
  cwd: any;
  /**  要作为存档中条目前缀的路径部分。 */
  prefix: any;
  /**  设置为任何 truthy 值以创建 gzip 压缩存档，或具有 [Alias： z ] 设置的 zlib.Gzip() 对象 */
  gzip: any;
  /**  一个函数， (path, stat) 用于添加每个条目。返回 true 以将条目添加到存档中，或 false 省略它。 */
  filter: any;
  /**  省略特定于系统的元数据： ctime 、、、 uid gid 、、、 uname gname dev ino atime 、和 nlink 。请注意，这仍然包括在内，因为这 mtime 对于其他基于时间的操作是必需的。此外，对于大多数 Unix 系统， mode 根据 umask 值 设置为 0o22 “合理默认值”。 */
  portable: any;
  /**  允许绝对路径。默认情况下， / 从绝对路径中剥离 */
  preservePaths: any;
  /**  在创建的文件存档上设置的模式 */
  mode: any;
  /**  不要以递归方式存档目录的内容。*/
  noDirRecurse: any;
  /**  设置为 true 以打包符号链接的目标。如果没有此选项，符号链接将按此方式存档。 */
  follow: any;
  /**  禁止显示 pax 扩展标头。请注意，这意味着长路径和链接路径将被截断，并且大值或负数值可能会被错误地解释。 */
  noPax: any;
  /**  设置为 true 可省略条目的写入 mtime 值。请注意，这会阻止使用其他基于 mtime 的功能，例如 tar.update 带有生成的 tar 存档 keepNewer 的选项。*/
  noMtime: any;
  /**  设置为对象 Date 以强制对添加到存档的所有内容进行特定 mtime 设置。被 noMtime 覆盖。 */
  mtime: any;
}

export interface TarPack extends Readable {
  /** 将条目添加到存档中。返回 Pack 流。 */
  add(path: string): TarPack;
  /** 将条目添加到存档中。如果刷新，则返回 true。 */
  write(path: string): boolean;
  /** 完成存档。 */
  end(): void;
}
export const Pack: new (options?: PackConstructorOpts) => TarPack = tar.Pack;
export interface Unpack extends Writable {}
export const Unpack: new (options?: UnpackConstructorOpts) => Unpack = tar.Unpack;

interface CommonOpts {
  /**  一个函数，如果遇到任何警告，都会被 (code, message, data) 调用。（请参阅“警告和错误”） */
  onwarn?(code: string, message: string, data: unknown): void;
  /**  用于创建存档的当前工作目录。缺省值为 process.cwd() . */
  cwd?: string;
  /**  允许绝对路径、包含 .. 的路径以及通过符号链接提取的路径。默认情况下，从绝对路径中剥离，不提取 .. 路径， / 并且不会提取其位置将被符号链接修改的任何文件。 */
  preservePaths?: boolean;
  /**  设置为 true 可省略条目的写入 mtime 值。请注意，这会阻止使用其他基于 mtime 的功能，例如 tar.update 带有生成的 tar 存档 keepNewer 的选项。 */
  noMtime?: boolean;
  /**  将警告视为值得崩溃的错误。默认值为 false。 */
  strict?: boolean;
  /**  用于添加每个条目。返回 true 以将条目添加到存档中，或 false 省略它。 */
  filter?(path: string, stat: Stats): boolean;
}
export interface PackConstructorOpts extends CommonOpts {
  /**  要作为存档中条目前缀的路径部分。 */
  prefix?: string;
  /**  设置为任何 truthy 值以创建 gzip 压缩存档，或具有 zlib.Gzip() */
  gzip?: boolean;
  /**  省略特定于系统的元数据。请注意，这仍然包括在内，因为这 mtime 对于其他基于时间的操作是必需的。此外，对于大多数 Unix 系统， mode 根据 umask 值 设置为 0o22 “合理默认值”。 */
  portable?: "ctime" | "uid" | "gid" | "uname" | "gname" | "dev" | "ino" | "atime" | "nlink";

  /**  一个 Map 对象，其中包含 nlink 为 >1 的任何文件的设备和 inode 值，用于标识硬链接。 */
  linkCache?: Map<unknown, unknown>;
  /**  缓存调用 lstat 的 Map 对象。 */
  statCache?: Map<string, Stats>;
  /**  一个 Map 对象，该对象缓存对 readdir 的调用。 */
  readdirCache?: Map<string, string[]>;
  /**  指定要运行的并发作业数的数字。默认值为 4。 */
  jobs?: number;
  /**  操作的最大 fs.read() 缓冲区大小。默认值为 16 MB。 */
  maxReadSize?: number;
  /**  不要以递归方式存档目录的内容。 */
  noDirRecurse?: boolean;
  /**  设置为 true 以打包符号链接的目标。如果没有此选项，符号链接将按此方式存档。 */
  follow?: boolean;
  /**  禁止显示 pax 扩展标头。请注意，这意味着长路径和链接路径将被截断，并且大值或负数值可能会被错误地解释。 */
  noPax?: boolean;
  /**  设置为对象 Date 以强制对添加到存档的所有内容进行特定 mtime 设置。被 noMtime 覆盖。 */
  mtime?: boolean;
}
export interface UnpackConstructorOpts extends CommonOpts {
  /**  设置为 true 以将现有文件保留在磁盘上（如果它比存档中的文件新）。 */
  newer: any;
  /**  不要覆盖现有文件。特别是，如果一个文件在存档中多次出现，则以后的副本不会覆盖以前的副本。 */
  keep: any;
  /**  在创建文件之前取消链接。如果没有此选项，tar 将覆盖现有文件，从而保留现有的硬链接。使用此选项，现有的硬链接将被破坏，任何会影响提取文件位置的符号链接也将被破坏。 */
  unlink: boolean;
  /**  删除指定数量的前导路径元素。元素较少的路径名将被静默跳过。请注意，路径名是在应用筛选器之后，但在安全检查之前编辑的。 */
  strip: any;
  /**  过滤条目的模式，如 process.umask() 。 */
  umask: any;
  /**  目录的默认模式 */
  dmode: any;
  /**  文件的默认模式 */
  fmode: any;
  /**  目录所在的 Map 对象。 */
  dirCache: any;
  /**  支持的元条目的最大大小。默认值为 1 MB。 */
  maxMetaEntrySize: any;
  /**  如果为 true，则 tar 会将提取条目的 and 设置为存档中的 uid uid and gid gid 字段。以 root 身份运行时，默认值为 true，否则为 false。如果为 false，则文件和目录将设置运行进程的用户的所有者和组。这与 -p in tar(1) 类似，但在此实现中，ACL 和其他特定于系统的数据永远不会解压缩，并且默认情况下已设置了模式。 */
  preserveOwner: any;
  /**  如果在 Windows 平台上，则为 True。导致包含 <|>? 字符的文件名在解压缩时转换为与 Windows 兼容的值的行为。 */
  win32: any;
  /**  设置为一个数字可强制所有提取的文件和文件夹以及所有隐式创建的目录的所有权归指定用户 ID 所有，而不考虑归档文件中的 uid 字段。不能与 preserveOwner 一起使用。还需要设置一个 gid 选项。 */
  uid: any;
  /**  设置为一个数字可强制所有提取的文件和文件夹以及所有隐式创建的目录的所有权归指定的组 ID 所有，而不考虑存档中的 gid 字段。不能与 preserveOwner 一起使用。还需要设置一个 uid 选项。 */
  gid: any;
  /**  提供一个函数，该函数接受一个 entry 对象，并返回一个流或任何 falsey 值。如果提供了流，则将写入该流的数据，而不是存档条目的内容。如果提供了 falsey 值，则该条目将正常写入磁盘。（若要从提取中排除项目，请使用上述 filter 选项。 */
  transform: any;

  /**  用于通过筛选器的每个条目。 */
  onentry?(entry: string): boolean;

  /**  设置为 true 可省略调用 fs.chmod() ，以确保提取的文件与输入模式匹配。这也抑制了对 process.umask() 确定默认 umask 值的调用，因为 tar 将使用提供的任何模式进行提取，并让进程 umask 正常应用。 */
  noChmod: any;
}
