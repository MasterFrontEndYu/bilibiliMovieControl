import { For, Show, createSignal, onSettled } from "solid-js";
import { Cloud, Info, RefreshCw } from "@lucide/solid";
import { browser } from "wxt/browser";
import { useConfig } from "@/hooks/useStorageConfig";
import type { ApiSegment, BiliVideoPageInfo } from "@/types/types";

const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const readBvid = () => {
    const query = location.hash.split("?")[1] ?? "";
    return new URLSearchParams(query).get("bvid") ?? "";
};

const readPage = () => {
    const query = location.hash.split("?")[1] ?? "";
    return Number(new URLSearchParams(query).get("page")) || 0;
};

export default function CloudPage() {
    const { config, update } = useConfig(["useCloudSegments"]);

    const initialBvid = readBvid();
    const [bvid, setBvid] = createSignal(initialBvid);
    const [currentPage, setCurrentPage] = createSignal(readPage());
    const [segments, setSegments] = createSignal<ApiSegment[]>([]);
    const [pages, setPages] = createSignal<BiliVideoPageInfo[]>([]);
    const [loading, setLoading] = createSignal(Boolean(initialBvid));
    const [error, setError] = createSignal("");
    /** 请求序号：快速切换 BV 时丢弃迟到的旧响应 */
    let querySeq = 0;

    const enabled = () => config.useCloudSegments;

    const toggle = () => {
        void update({ useCloudSegments: !enabled() });
    };

    const loadPages = async () => {
        const id = bvid();
        if (!id) return;

        try {
            const result = (await browser.runtime.sendMessage({
                type: "BILI_PAGES",
                data: { bvid: id },
            })) as { pages?: BiliVideoPageInfo[] } | undefined;

            if (bvid() !== id) return;
            setPages(result?.pages ?? []);
        } catch {
            if (bvid() !== id) return;
            setPages([]);
        }
    };

    const query = async (force = false) => {
        const id = bvid();
        if (!id) return;

        const seq = ++querySeq;
        setLoading(true);
        setError("");
        void loadPages();

        try {
            const result = (await browser.runtime.sendMessage({
                type: "SB_LOOKUP",
                data: { bvid: id, force },
            })) as
                | {
                      ok?: boolean;
                      segments?: ApiSegment[];
                      reason?: string;
                  }
                | undefined;

            if (seq !== querySeq) return;

            if (!result?.ok) {
                setError(`查询失败：${result?.reason ?? "未知错误"}`);
                setSegments([]);
                return;
            }

            setSegments(result.segments ?? []);
        } catch {
            if (seq !== querySeq) return;
            setError("查询失败：网络异常");
            setSegments([]);
        } finally {
            if (seq === querySeq) setLoading(false);
        }
    };

    onSettled(() => {
        const sync = () => {
            const next = readBvid();

            // 换 BV 时先清空旧视频的数据，避免新标题下短暂显示旧片段
            if (next !== bvid()) {
                setSegments([]);
                setPages([]);
            }

            setBvid(next);
            setCurrentPage(readPage());
            if (next) void query(true);
        };

        sync();
        window.addEventListener("hashchange", sync);
        return () => window.removeEventListener("hashchange", sync);
    });

    const groups = () => {
        const map = new Map<string, ApiSegment[]>();

        for (const segment of segments()) {
            const key = segment.cid || "未知";
            const list = map.get(key) ?? [];
            list.push(segment);
            map.set(key, list);
        }

        return [...map.entries()]
            .map(([cid, list]) => {
                const info = pages().find((item) => item.cid === cid);
                return {
                    cid,
                    page: info?.page ?? null,
                    title: info?.title ?? "",
                    segments: [...list].sort((a, b) => a.start - b.start),
                };
            })
            .sort(
                (a, b) =>
                    (a.page ?? Number.MAX_SAFE_INTEGER) -
                        (b.page ?? Number.MAX_SAFE_INTEGER) ||
                    a.cid.localeCompare(b.cid),
            );
    };

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <Cloud size={26} />
                        云端片段
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        云端片段开关，以及当前视频的云端数据（按 cid 分组）。
                    </p>
                </div>
            </header>

            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-4 p-6">
                    <h2 class="card-title text-base font-bold text-base-content">
                        使用云端片段：{enabled() ? "已开启" : "已关闭"}
                    </h2>
                    <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                        开启后，intro / sponsor 作为 OP 跳过，outro 作为下一 P；
                        与手动片段重叠时手动优先。
                    </p>
                    <div class="flex items-center">
                        <div
                            class={`aura ${
                                enabled()
                                    ? "aura-rainbow duration-1000"
                                    : "text-orange-600"
                            }`}
                        >
                            <button
                                class={`btn btn-soft ${
                                    enabled() ? "btn-success" : "btn-error"
                                }`}
                                onClick={toggle}
                            >
                                {enabled() ? "已开启" : "已关闭"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <Show
                when={bvid()}
                fallback={
                    <div class="card bg-base-100 shadow-sm border border-base-300">
                        <div class="card-body gap-3 p-6 flex-row items-start">
                            <Info
                                size={18}
                                class="text-primary shrink-0 mt-0.5"
                            />
                            <div>
                                <h2 class="card-title text-base font-bold text-base-content">
                                    没有 BV 号
                                </h2>
                                <p class="text-sm text-base-content/60 m-0 mt-2 leading-relaxed">
                                    从 Popup 进入时不会带 BV
                                    号，因此这里看不到数据。
                                    请到播放页状态条点「查看云端数据→」进入，会带上当前
                                    BV 和分 P。
                                </p>
                            </div>
                        </div>
                    </div>
                }
            >
                <div class="card bg-base-100 shadow-sm border border-base-300 mb-6">
                    <div class="card-body gap-3 p-6">
                        <div class="flex justify-between items-center gap-3">
                            <div>
                                <h2 class="card-title text-base font-bold text-base-content">
                                    当前视频：{bvid()}
                                </h2>
                                <p class="text-xs text-base-content/50 m-0 mt-1">
                                    数据来源 /api/skipSegments（公开片段），按
                                    cid 分组
                                </p>
                            </div>
                            <button
                                class="btn btn-outline btn-primary btn-sm"
                                disabled={loading()}
                                onClick={() => void query(true)}
                            >
                                <RefreshCw size={12} />
                                {loading() ? "查询中…" : "刷新"}
                            </button>
                        </div>

                        <Show when={error()}>
                            <p class="text-sm text-error m-0">{error()}</p>
                        </Show>

                        <p class="text-xs text-base-content/50 m-0">
                            服务器可能有延迟，刚上传的片段建议等待 1–2
                            分钟后再刷新。
                        </p>
                    </div>
                </div>

                <Show when={!loading() && segments().length === 0 && !error()}>
                    <div class="text-center py-12 bg-base-100 rounded-2xl border-2 border-dashed border-base-300">
                        <p class="text-base-content/50 m-0">
                            该视频暂无云端片段
                        </p>
                    </div>
                </Show>

                <div class="flex flex-col gap-6">
                    <For each={groups()}>
                        {(group) => (
                            <div class="card bg-base-100 shadow-sm border border-base-300">
                                <div class="card-body gap-3 p-5">
                                    <div class="flex justify-between items-center gap-3">
                                        <div class="flex flex-col gap-0.5 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <h3 class="font-bold text-sm text-base-content">
                                                    {group.page != null
                                                        ? `P${group.page} · `
                                                        : ""}
                                                    cid: {group.cid}
                                                </h3>
                                                <Show
                                                    when={
                                                        group.page != null &&
                                                        group.page ===
                                                            currentPage()
                                                    }
                                                >
                                                    <span class="badge badge-xs badge-primary">
                                                        当前
                                                    </span>
                                                </Show>
                                            </div>
                                            <Show when={group.title}>
                                                <span class="text-xs text-base-content/50 truncate">
                                                    {group.title}
                                                </span>
                                            </Show>
                                        </div>
                                        <span class="text-xs text-base-content/50 shrink-0">
                                            {group.segments.length} 段
                                        </span>
                                    </div>

                                    <div class="flex flex-col gap-2">
                                        <For each={group.segments}>
                                            {(segment) => (
                                                <div class="bg-base-200/60 rounded-xl p-3">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <span
                                                            class={`badge badge-sm ${
                                                                segment.category ===
                                                                "outro"
                                                                    ? "badge-secondary"
                                                                    : "badge-primary"
                                                            }`}
                                                            title={
                                                                segment.category ===
                                                                "outro"
                                                                    ? "下一 P 片段"
                                                                    : "跳过片段"
                                                            }
                                                        >
                                                            {segment.category ===
                                                            "outro"
                                                                ? "P"
                                                                : "⏭"}
                                                        </span>
                                                        <span class="text-xs text-base-content/70">
                                                            {segment.category}/
                                                            {segment.actionType}
                                                        </span>
                                                        <span class="font-mono text-xs text-base-content/80">
                                                            {formatTime(
                                                                segment.start,
                                                            )}{" "}
                                                            →{" "}
                                                            {formatTime(
                                                                segment.end,
                                                            )}
                                                        </span>
                                                        <span class="text-xs text-base-content/50">
                                                            votes=
                                                            {segment.votes} ·
                                                            duration=
                                                            {
                                                                segment.videoDuration
                                                            }
                                                        </span>
                                                    </div>
                                                    <div class="text-[10px] text-base-content/40 font-mono break-all mt-1">
                                                        UUID: {segment.id}
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>
        </div>
    );
}
