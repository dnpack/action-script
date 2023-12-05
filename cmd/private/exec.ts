export async function execCmdWaitExit(cmd: string, opts?: Deno.CommandOptions) {
    const command = new Deno.Command(cmd, opts);
    const res = await command.output();
    if (res.code !== 0) throw new Error(toUTF8(res.stderr));
    return toUTF8(res.stdout);
}

const utf8Decoder = new TextDecoder();
function toUTF8(buf: Uint8Array) {
    return utf8Decoder.decode(buf);
}
