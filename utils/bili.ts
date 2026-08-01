import { browser } from "wxt/browser";

export const MAX_HISTORY_LENGTH = 20;

/**
 * 检测当前页面是否为合集页，并返回合集标题
 */
export const getCollectionTitle = async (tabId: number): Promise<string> => {
    try {
        const results = await browser.scripting.executeScript({
            target: { tabId },
            func: () => {
                const isPod = !!document.querySelector(".video-pod");
                if (!isPod) return "";
                const titleEl =
                    document
                        .querySelector(".video-title")
                        ?.textContent?.trim() || "未知合集";
                const titleEl2 = document
                    .querySelector(
                        ".simple-base-item.video-pod__item.active.normal .title-txt",
                    )
                    ?.textContent?.trim();
                if (titleEl !== "未知合集") {
                    return (
                        titleEl
                            .replace(/(\[|【)?(电视剧|美剧)(\]|】)?/g, "")
                            .slice(0, 10) +
                        (titleEl2 ? `- ${titleEl2.slice(0, 8)}` : "")
                    );
                }
                return titleEl;
            },
        });
        return results[0]?.result || "";
    } catch {
        return "";
    }
};

export const getSoftName = () => browser.runtime.getManifest().name;

export const getSoftVersion = () => browser.runtime.getManifest().version;

export const getActiveTab = async () => {
    try {
        const tabs = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        
        console.log("tab", tabs);

        return tabs[0] || null;
    } catch {
        return null;
    }
};


export const cleanBiliUrl = (url: string): string => {
    try {
        const u = new URL(url);
        const p = u.searchParams.get("p");
        const baseUrl = `${u.origin}${u.pathname}`;
        return p && p !== "1" ? `${baseUrl}?p=${p}` : baseUrl;
    } catch (e) {
        return url;
    }
};



//https://www.bilibili.com/video/BV16CGK6nETp
//https://www.bilibili.com/video/BV16CGK6nETp

/**
 * 创建一个 storage.onChanged 监听器，只处理指定的配置键
 * @param configKeys 需要监听的配置键列表（如 DEFAULT_CONFIG 的键）
 * @param onUpdate 当配置变更时的回调函数，传入变更后的配置对象
 * @returns 一个符合 storage.onChanged 签名的事件处理函数
 */
export function createStorageListener<T extends Record<string, any>>(
    configKeys: (keyof T)[],
    onUpdate: (partial: Partial<T>) => void,
) {
    return (changes: Record<string, any>, area: string) => {
        if (area !== "local") return;
        const data: Partial<T> = {};
        for (const key of configKeys) {
            const change = changes[key as string];
            if (change) {
                data[key] = change.newValue;
            }
        }
        if (Object.keys(data).length) {
            onUpdate(data);
        }
    };
}
