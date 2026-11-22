import {
    For,
    Show,
    createSignal,
    createTrackedEffect,
    onSettled,
    untrack,
} from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import {
    ArrowLeft,
    EyeOff,
    Info,
    Lock,
    RefreshCw,
    RotateCcw,
    ThumbsDown,
    ThumbsUp,
    Vote,
} from "@lucide/solid";
import { browser } from "wxt/browser";
import { buildCloudPath, rememberCloudContext } from "@/utils/cloudContext";
import { getOrCreateUserID } from "@/utils/userId";
import type {
    ApiSegmentInfo,
    SegmentInfoResult,
    VoteResult,
    VoteType,
} from "@/types/types";

const REASON_TEXT: Record<string, string> = {
    "bad-request": "参数不完整",
    "not-found": "未找到该片段",
    "rate-limited": "操作过于频繁，请稍后再试",
    rejected: "被服务端拒绝（403）",
    timeout: "请求超时",
    network: "网络异常",
    "bad-json": "接口返回数据异常",
    "test-env": "测试环境不支持该操作",
};

const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatDate = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "未知";

    // 服务端目前返回毫秒时间戳，兼容旧数据的秒级时间戳
    const milliseconds = value > 1e12 ? value : value * 1000;
    return new Date(milliseconds).toLocaleString();
};

const reasonText = (reason?: string) =>
    REASON_TEXT[reason ?? ""] ?? `请求失败（${reason ?? "未知错误"}）`;

const categoryText = (category: string) => {
    const labels: Record<string, string> = {
        outro: "下一 P / 结尾",
        intro: "片头",
        sponsor: "赞助",
        selfpromo: "自我推广",
        preview: "预览",
        fill: "填充",
    };
    return labels[category] ?? category;
};

export default function SegmentPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const param = (key: string) => {
        const value = (searchParams as Record<string, unknown>)[key];
        return typeof value === "string" ? value : "";
    };

    const initialUuid = param("uuid");
    const [uuid, setUuid] = createSignal(initialUuid);
    const [bvid, setBvid] = createSignal(param("bvid"));
    const [cid, setCid] = createSignal(param("cid"));
    const [page, setPage] = createSignal(Number(param("page")) || 0);
    const [info, setInfo] = createSignal<ApiSegmentInfo | null>(null);
    const [loading, setLoading] = createSignal(Boolean(initialUuid));
    const [error, setError] = createSignal("");
    const [status, setStatus] = createSignal("");
    const [userID, setUserID] = createSignal("");
    const [voting, setVoting] = createSignal(false);

    let requestSeq = 0;

    const load = async (force = false) => {
        const id = uuid();
        if (!id) {
            setError("缺少片段 UUID，请从云端片段页进入");
            setLoading(false);
            return;
        }

        const seq = ++requestSeq;
        setLoading(true);
        setError("");

        try {
            const result = (await browser.runtime.sendMessage({
                type: "SB_SEGMENT_INFO",
                data: { uuid: id, force },
            })) as SegmentInfoResult | undefined;

            if (seq !== requestSeq) return;

            if (!result?.ok) {
                setInfo(null);
                setError(reasonText(result?.reason));
                return;
            }

            setInfo(result.info ?? null);
        } catch {
            if (seq !== requestSeq) return;
            setInfo(null);
            setError("网络异常");
        } finally {
            if (seq === requestSeq) setLoading(false);
        }
    };

    const vote = async (type: VoteType) => {
        const id = uuid();
        const user = userID();

        if (!id || voting()) return;
        if (!user) {
            setStatus("私人 ID 尚未就绪，请稍后重试");
            return;
        }

        setVoting(true);
        setStatus("");

        try {
            const result = (await browser.runtime.sendMessage({
                type: "SB_VOTE",
                data: { uuid: id, userID: user, type, bvid: bvid() },
            })) as VoteResult | undefined;

            if (!result?.ok) {
                const message = result?.message
                    ? `：${result.message}`
                    : "";
                setStatus(`操作失败：${reasonText(result?.reason)}${message}`);
                return;
            }

            setStatus(
                type === 1
                    ? "已点赞"
                    : type === 0
                      ? "已点踩"
                      : "已撤销投票",
            );
            await load(true);
        } catch {
            setStatus("操作失败：网络异常");
        } finally {
            setVoting(false);
        }
    };

    createTrackedEffect(() => {
        const nextUuid = param("uuid");
        const nextBvid = param("bvid");
        const nextPage = Number(param("page")) || 0;

        setUuid(nextUuid);
        setBvid(nextBvid);
        setCid(param("cid"));
        setPage(nextPage);

        if (nextBvid) {
            rememberCloudContext(nextBvid, nextPage);
        }

        if (nextUuid) {
            untrack(() => void load(true));
        } else {
            setInfo(null);
            setError("缺少片段 UUID，请从云端片段页进入");
            setLoading(false);
        }
    });

    onSettled(() => {
        void getOrCreateUserID()
            .then(setUserID)
            .catch(() => setStatus("私人 ID 读取失败，投票功能不可用"));
    });

    const hiddenText = (value: number) =>
        value === 2 ? "自动隐藏" : value === 1 ? "已隐藏" : "未隐藏";
    const lockText = (value: number) =>
        value === 1 ? "已锁定" : "未锁定";

    const stats = () => {
        const item = info();
        if (!item) return [];

        return [
            { label: "投票", value: `${item.votes}` },
            { label: "跳过次数", value: `${item.views}` },
            { label: "提交者声誉", value: `${item.reputation}` },
            { label: "提交时间", value: formatDate(item.timeSubmitted) },
            {
                label: "提交者公开 ID",
                value: item.userID || "未知",
            },
            {
                label: "提交时视频时长",
                value: formatTime(item.videoDuration),
            },
        ];
    };

    const statusIsError = () =>
        status().startsWith("操作失败") ||
        status().includes("不可用") ||
        status().includes("尚未");

    return (
        <div class="max-w-4xl mx-auto">
            <header class="flex flex-wrap justify-between items-center gap-3 mb-8">
                <div>
                    <h1 class="text-3xl mb-2 text-primary flex items-center gap-3">
                        <Vote size={26} />
                        片段社区状态
                    </h1>
                    <p class="text-base-content/70 text-sm m-0">
                        查看片段的投票、隐藏、锁定信息，并参与社区投票。
                    </p>
                </div>
                <button
                    class="btn btn-outline btn-primary btn-sm"
                    onClick={() =>
                        navigate(
                            bvid()
                                ? buildCloudPath(bvid(), page())
                                : "/cloud",
                        )
                    }
                >
                    <ArrowLeft size={14} />
                    返回云端片段
                </button>
            </header>

            <Show when={!uuid()}>
                <div class="card bg-base-100 shadow-sm border border-base-300">
                    <div class="card-body p-6 flex-row items-start gap-3">
                        <Info size={18} class="text-primary shrink-0 mt-0.5" />
                        <p class="text-sm text-base-content/70 m-0">
                            缺少片段 UUID。请从「云端片段」页的 P 片段点击「社区」进入。
                        </p>
                    </div>
                </div>
            </Show>

            <Show when={uuid()}>
                <Show when={loading()}>
                    <div class="text-center py-16 bg-base-100 rounded-2xl border-2 border-dashed border-base-300">
                        <span class="loading loading-spinner loading-md text-primary"></span>
                        <p class="text-sm text-base-content/50 m-0 mt-3">
                            正在读取片段信息…
                        </p>
                    </div>
                </Show>

                <Show when={!loading() && error()}>
                    <div class="card bg-base-100 shadow-sm border border-base-300">
                        <div class="card-body p-6 gap-3">
                            <p class="text-sm text-error m-0">{error()}</p>
                            <div>
                                <button
                                    class="btn btn-outline btn-primary btn-sm"
                                    onClick={() => void load(true)}
                                >
                                    <RefreshCw size={12} />
                                    重试
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={info()}>
                    <div class="flex flex-col gap-5">
                        <div class="card bg-base-100 shadow-sm border border-base-300">
                            <div class="card-body gap-3 p-6">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span
                                        class={`badge ${
                                            info()!.category === "outro"
                                                ? "badge-secondary"
                                                : "badge-primary"
                                        }`}
                                    >
                                        {info()!.category === "outro"
                                            ? "P"
                                            : "⏭"}
                                    </span>
                                    <span class="badge badge-outline badge-sm">
                                        {info()!.category}/
                                        {info()!.actionType}
                                    </span>
                                    <span class="badge badge-sm">
                                        {lockText(info()!.locked)}
                                    </span>
                                    <span
                                        class={`badge badge-sm ${
                                            info()!.hidden
                                                ? "badge-error"
                                                : "badge-ghost"
                                        }`}
                                    >
                                        {hiddenText(info()!.hidden)}
                                    </span>
                                    <Show when={info()!.shadowHidden}>
                                        <span class="badge badge-warning badge-sm">
                                            已暗藏
                                        </span>
                                    </Show>
                                </div>

                                <h2 class="card-title text-base font-bold text-base-content">
                                    {categoryText(info()!.category)}
                                </h2>
                                <p class="font-mono text-sm m-0 text-base-content/80">
                                    {formatTime(info()!.startTime)} →{" "}
                                    {formatTime(info()!.endTime)}
                                </p>

                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-base-content/60">
                                    <span class="break-all">
                                        视频：{info()!.videoID || bvid() || "未知"}
                                    </span>
                                    <span class="break-all">
                                        cid：{info()!.cid || cid() || "未知"}
                                    </span>
                                    <span class="break-all">
                                        UUID：{info()!.UUID || uuid()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <For each={stats()}>
                                {(item) => (
                                    <div class="bg-base-100 border border-base-300 rounded-xl p-4">
                                        <div class="text-xs text-base-content/50">
                                            {item.label}
                                        </div>
                                        <div class="text-sm font-semibold text-base-content break-all mt-1">
                                            {item.value}
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>

                        <div class="card bg-base-100 shadow-sm border border-base-300">
                            <div class="card-body gap-4 p-6">
                                <h2 class="card-title text-base font-bold text-base-content flex items-center gap-2">
                                    <Vote size={16} />
                                    社区操作
                                </h2>
                                <p class="text-sm text-base-content/60 m-0 leading-relaxed">
                                    公开 API 提供点赞 / 点踩 / 撤销投票。隐藏通常由提交者或
                                    VIP 的一票、社区投票结果决定，锁定由服务端 / 管理处理；
                                    本页展示 hidden / locked 状态，不伪造隐藏或锁定接口。
                                </p>

                                <div class="flex flex-wrap gap-2">
                                    <button
                                        class="btn btn-success btn-sm"
                                        disabled={voting()}
                                        onClick={() => void vote(1)}
                                    >
                                        <ThumbsUp size={14} />
                                        点赞
                                    </button>
                                    <button
                                        class="btn btn-error btn-sm"
                                        disabled={voting()}
                                        title="点踩；提交者 / VIP 可能因此隐藏该片段"
                                        onClick={() => void vote(0)}
                                    >
                                        <ThumbsDown size={14} />
                                        点踩/隐藏
                                    </button>
                                    <button
                                        class="btn btn-outline btn-sm"
                                        disabled={voting()}
                                        onClick={() => void vote(20)}
                                    >
                                        <RotateCcw size={14} />
                                        撤销投票
                                    </button>
                                    <button
                                        class="btn btn-outline btn-sm"
                                        disabled={loading()}
                                        onClick={() => void load(true)}
                                    >
                                        <RefreshCw size={14} />
                                        刷新
                                    </button>
                                </div>

                                <Show when={status()}>
                                    <p
                                        class={`text-sm m-0 ${
                                            statusIsError()
                                                ? "text-error"
                                                : "text-success"
                                        }`}
                                    >
                                        {status()}
                                    </p>
                                </Show>

                                <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/50">
                                    <span class="flex items-center gap-1">
                                        <EyeOff size={12} />
                                        hidden：{hiddenText(info()!.hidden)}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <Lock size={12} />
                                        locked：{lockText(info()!.locked)}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <Info size={12} />
                                        私人 ID：
                                        {userID()
                                            ? "已就绪"
                                            : status().includes("读取失败")
                                              ? "不可用"
                                              : "读取中"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
