import { browser } from 'wxt/browser';


export const MAX_HISTORY_LENGTH = 20;



/**
 * 检测当前页面是否为合集页，并返回合集标题
 */
export const getCollectionTitle = async (tabId: number): Promise<string> => {
    try {
        const results = await browser.scripting.executeScript({
            target: { tabId },
            func: () => {
                const isPod = !!document.querySelector('.video-pod');
                if (!isPod) return '';
                const titleEl = document.querySelector('.video-title')?.textContent?.trim() || '未知合集';
                const titleEl2 = document.querySelector('.simple-base-item.video-pod__item.active.normal .title-txt')?.textContent?.trim();
                if (titleEl !== '未知合集') {
                    return titleEl.replace(/(\[|【)?(电视剧|美剧)(\]|】)?/g, '').slice(0, 10) + (titleEl2 ? `- ${titleEl2.slice(0, 8) }` : '');
                }
                return titleEl;
            },
        });
        return results[0]?.result || '';
    } catch {
        return '';
    }
};


export const getSoftName = () => browser.runtime.getManifest().name;


export const getSoftVersion = () => browser.runtime.getManifest().version;


export const getActiveTab = async () => {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
    } catch {
        return null;
    }
};

export const sendToActiveTab = async (message: any) => {
    const tab = await getActiveTab();
    // 只有 B站视频页才发送消息
    if (tab?.id && tab.url?.includes("bilibili.com/video")) {
        try {
            return await browser.tabs.sendMessage(tab.id, message);
        } catch (e) {
            // 捕获“接收端不存在”的错误，避免控制台炸出红色报错
            console.warn("[Extension] 消息发送失败，可能是页面未就绪:", e);
            return null;
        }
    }
    return null;
};