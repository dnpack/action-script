import { config } from "../private/git.ts";

/**
 * @public
 * @remarks 设置 CI 环境下 git 用户名和邮箱
 */
export async function setCIUser() {
  const name = "github-ci";
  const email = "github-ci@github.com";
  await config.setUser(name, email);
  console.log(`set git user:${name} ${email}`);
}
