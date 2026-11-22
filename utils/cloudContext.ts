// 当前设置页内记住最近一次「云端数据」的 BV / 分P，
// 侧边栏进入云端片段时带回去，避免客户端跳转丢失查询信息。
const SESSION_KEY = "bmcCloudContext";

interface StoredCloudContext {
    bvid: string;
    page: number;
}

function readStoredContext(): StoredCloudContext | null {
    try {
        if (typeof sessionStorage === "undefined") return null;

        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        const value = JSON.parse(raw) as Partial<StoredCloudContext>;
        if (typeof value.bvid !== "string" || !value.bvid) return null;

        return {
            bvid: value.bvid,
            page: Number(value.page) > 0 ? Number(value.page) : 1,
        };
    } catch {
        return null;
    }
}

const initial = readStoredContext();
let lastBvid = initial?.bvid ?? "";
let lastPage = initial?.page ?? 1;

export function rememberCloudContext(bvid: string, page: number): void {
    if (!bvid) return;

    lastBvid = bvid;
    lastPage = Number.isFinite(page) && page > 0 ? page : 1;

    try {
        if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(
                SESSION_KEY,
                JSON.stringify({ bvid: lastBvid, page: lastPage }),
            );
        }
    } catch {
        // sessionStorage 不可用时只保留内存中的上下文
    }
}

export function getCloudContext(): { bvid: string; page: number } {
    return { bvid: lastBvid, page: lastPage };
}

export function buildCloudPath(bvid: string, page: number): string {
    if (!bvid) return "/cloud";

    const params = new URLSearchParams({ bvid });
    if (Number.isFinite(page) && page > 0) {
        params.set("page", String(page));
    }
    return `/cloud?${params.toString()}`;
}
