import { browser } from "wxt/browser";
import { cleanBiliUrl } from "@/utils/bilibili";
import { allowArchive, archiveLatest, archiveManual } from "@/utils/history";
import { invalidateCachedSegments } from "@/utils/segmentCache";
import {
    fetchVideoPages,
    getSegmentInfo,
    getSkipSegments,
    resolveVideoPage,
    submitSkipSegments,
    voteOnSegment,
} from "@/utils/sponsorblock";

/** 页面加载后等待多久再记录自动存档 */
const ARCHIVE_DELAY_MS = 4000;

/** 复用已打开的设置页，避免每次点「？」/「云端数据」都新建标签页 */
async function openOrFocusOptions(url: string): Promise<void> {
    const optionsBase = browser.runtime.getURL("/options.html");
    const tabs = await browser.tabs.query({});
    const existing = tabs.find((tab) => tab.url?.startsWith(optionsBase));

    if (existing?.id != null) {
        await browser.tabs.update(existing.id, { url, active: true });
        if (existing.windowId != null) {
            await browser.windows
                .update(existing.windowId, { focused: true })
                .catch(() => undefined);
        }
        return;
    }

    await browser.tabs.create({ url });
}

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

                        // 解析失败时不要退化为「全部 P」查询，否则可能串到别的分P
                        if (!pageInfo) {
                            sendResponse({
                                ok: false,
                                segments: [],
                                fromCache: false,
                                reason: "network",
                            });
                            return;
                        }

                        cid = pageInfo.cid;
                    }

                    sendResponse(
                        await getSkipSegments(
                            data.bvid,
                            cid,
                            Boolean(data.force),
                        ),
                    );
                })();
                return true;
            }

            case "OPEN_HELP_PAGE": {
                const url = browser.runtime.getURL(
                    "/options.html?section=settings#/",
                );
                void openOrFocusOptions(url).catch(() => undefined);
                sendResponse({ ok: true });
                return true;
            }

            case "BILI_PAGES": {
                const bvid = message.data?.bvid;
                if (
                    typeof bvid !== "string" ||
                    !/^BV[0-9A-Za-z]{10}$/.test(bvid)
                ) {
                    sendResponse({ ok: false, pages: [] });
                    return true;
                }

                void (async () => {
                    const pages = await fetchVideoPages(bvid);
                    sendResponse({ ok: pages.length > 0, pages });
                })();
                return true;
            }

            case "OPEN_CLOUD_PAGE": {
                const bvid = message.data?.bvid;
                const page = Number(message.data?.page) || 1;

                if (
                    typeof bvid !== "string" ||
                    !/^BV[0-9A-Za-z]{10}$/.test(bvid)
                ) {
                    sendResponse({ ok: false });
                    return true;
                }

                const url = browser.runtime.getURL(
                    `/options.html#/cloud?bvid=${encodeURIComponent(bvid)}&page=${page}`,
                );
                void openOrFocusOptions(url).catch(() => undefined);
                sendResponse({ ok: true });
                return true;
            }

            case "SB_SEGMENT_INFO": {
                const uuid = message.data?.uuid;
                if (typeof uuid !== "string" || uuid.length === 0) {
                    sendResponse({ ok: false, reason: "bad-request" });
                    return true;
                }

                void (async () => {
                    sendResponse(
                        await getSegmentInfo(uuid, Boolean(message.data?.force)),
                    );
                })();
                return true;
            }

            case "SB_VOTE": {
                const data = message.data ?? {};
                const type = Number(data.type);

                if (
                    typeof data.uuid !== "string" ||
                    data.uuid.length === 0 ||
                    typeof data.userID !== "string" ||
                    data.userID.length < 30 ||
                    ![0, 1, 20].includes(type)
                ) {
                    sendResponse({ ok: false, reason: "bad-request" });
                    return true;
                }

                void (async () => {
                    const result = await voteOnSegment(
                        data.uuid,
                        data.userID,
                        type as 0 | 1 | 20,
                    );

                    if (result.ok && typeof data.bvid === "string") {
                        await invalidateCachedSegments(data.bvid);
                    }

                    sendResponse(result);
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
        // 只处理完整的页面加载；先判断再等待，避免为每次 favicon/标题变化挂 4 秒定时器
        if (
            changeInfo.status !== "complete" ||
            !tab.url?.includes("bilibili.com/video")
        ) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, ARCHIVE_DELAY_MS));

        // 等待期间用户可能已经切走或关闭标签页，以当前标签状态为准
        const currentTab = await browser.tabs.get(tabId).catch(() => null);
        const pageUrl = currentTab?.url;
        if (!pageUrl?.includes("bilibili.com/video")) return;

        const cleanUrl = cleanBiliUrl(pageUrl);
        if (!allowArchive(cleanUrl)) return;

        await archiveLatest(tabId, cleanUrl);
    });
});
