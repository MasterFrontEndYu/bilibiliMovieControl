import { browser } from "wxt/browser";
import { cleanBiliUrl } from "@/utils/bilibili";
import { allowArchive, archiveLatest, archiveManual } from "@/utils/history";
import { invalidateCachedSegments } from "@/utils/segmentCache";
import {
    getSkipSegments,
    resolveVideoPage,
    submitSkipSegments,
} from "@/utils/sponsorblock";

/** 页面加载后等待多久再记录自动存档 */
const ARCHIVE_DELAY_MS = 4000;

export default defineBackground(() => {
    /**
     * 消息路由：Popup / Content Script 发来的请求统一在这里分发
     */
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // 只接受本扩展自己的上下文
        if (!message || sender.id !== browser.runtime.id) return;

        switch (message.type) {
            case "DO_ARCHIVE":
                archiveManual(message.data.tab, message.data.config).then(
                    (pinnedHistory) =>
                        sendResponse({ success: true, pinnedHistory }),
                );
                return true; // 保持异步通道

            case "SB_LOOKUP": {
                const data = message.data ?? {};
                void (async () => {
                    let cid = data.cid as string | undefined;

                    // 未传 cid 时按分P 解析，避免拿到其他分P 的片段
                    if (!cid && data.page) {
                        const pageInfo = await resolveVideoPage(
                            data.bvid,
                            Number(data.page),
                        );
                        cid = pageInfo?.cid;
                    }

                    sendResponse(await getSkipSegments(data.bvid, cid));
                })();
                return true;
            }

            case "SB_SUBMIT": {
                const data = message.data;
                if (!data || typeof data !== "object") {
                    sendResponse({ ok: false, reason: "bad-request" });
                    return true;
                }
                submitSkipSegments(data).then(async (result) => {
                    if (result.ok && typeof data.bvid === "string") {
                        // 上传成功后清掉旧缓存，内容脚本/面板重新拉取时能拿到新片段
                        await invalidateCachedSegments(data.bvid);
                    }
                    sendResponse(result);
                });
                return true;
            }
        }
    });

    /**
     * 自动存档：页面加载稳定后记录当前配置快照
     */
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        await new Promise((resolve) => setTimeout(resolve, ARCHIVE_DELAY_MS));

        const pageUrl = tab.url;
        if (
            changeInfo.status !== "complete" ||
            !pageUrl?.includes("bilibili.com/video")
        ) {
            return;
        }

        const cleanUrl = cleanBiliUrl(pageUrl);
        if (!allowArchive(cleanUrl)) return;

        await archiveLatest(tabId, cleanUrl);
    });
});
