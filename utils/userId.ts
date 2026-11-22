import { browser } from "wxt/browser";

export const USER_ID_STORAGE_KEY = "sbUserID";
export const MIN_USER_ID_LENGTH = 30;

/** 20 字节随机数 → 40 位十六进制字符串，满足服务端 ≥30 位的要求 */
export function generateUserID(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

/** 读取已有私人 ID；没有则生成并保存 */
export async function getOrCreateUserID(): Promise<string> {
    const stored = await browser.storage.local.get({
        [USER_ID_STORAGE_KEY]: "",
    });
    const existing = String(stored[USER_ID_STORAGE_KEY] ?? "").trim();

    if (existing.length > 0) return existing;

    const id = generateUserID();
    await browser.storage.local.set({ [USER_ID_STORAGE_KEY]: id });
    return id;
}
