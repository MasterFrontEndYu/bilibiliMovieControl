// entrypoints/options/pages/Shortcut.tsx
import { createSignal, For, onSettled, Show } from "solid-js";
import { browser } from "wxt/browser";
import { CircleX, Info, Keyboard, RotateCcw, Save, ShieldAlert, Sparkles } from "@lucide/solid";

// ========== 被占用的快捷键黑名单 ==========
// 来源: 浏览器/系统原生快捷键 + B站网页播放器原生快捷键
const RESERVED_SHORTCUTS: Record<string, string> = {
    // --- B站网页播放器原生快捷键 (单键) ---
    "Space": "B站 - 播放/暂停",
    "M": "B站 - 静音/取消静音",
    "F": "B站 - 全屏/退出全屏",
    "D": "B站 - 开启/关闭弹幕",
    "W": "B站 - 网页全屏",
    "T": "B站 - 宽屏模式",
    "J": "B站 - 后退",
    "P": "B站 - 播放/暂停 (部分扩展/脚本)",
    "Y": "B站 - 开灯/关灯 (部分扩展/脚本)",
    "↑": "B站 - 音量增加",
    "↓": "B站 - 音量降低",
    "←": "B站 - 快退",
    "→": "B站 - 快进",
    "[": "B站 - 上一P（原生已占用）",
    "]": "B站 - 下一P（原生已占用）",

    // --- 浏览器/系统级单键 ---
    "Tab": "系统 - 切换焦点",
    "Esc": "系统 - 取消/退出",
    "Enter": "系统 - 确认",
    "Backspace": "浏览器 - 后退",
    "Delete": "系统 - 删除",
    "Home": "浏览器 - 滚动到顶部",
    "End": "浏览器 - 滚动到底部",
    "PageUp": "浏览器 - 向上翻页",
    "PageDown": "浏览器 - 向下翻页",
    "F1": "浏览器 - 帮助",
    "F5": "浏览器 - 刷新",
    "F11": "浏览器 - 全屏",
    "F12": "浏览器 - 开发者工具",

    // --- 关键浏览器组合键 (防止用户录入组合时误触) ---
    "Ctrl+T": "浏览器 - 新建标签页",
    "Ctrl+W": "浏览器 - 关闭标签页",
    "Ctrl+N": "浏览器 - 新建窗口",
    "Ctrl+Shift+T": "浏览器 - 恢复关闭的标签页",
    "Ctrl+Shift+N": "浏览器 - 无痕窗口",
    "Ctrl+Tab": "浏览器 - 切换标签页",
    "Ctrl+D": "浏览器 - 收藏",
    "Ctrl+F": "浏览器 - 页内查找",
    "Ctrl+L": "浏览器 - 聚焦地址栏",
    "Alt+F": "浏览器 - 打开菜单 (Chrome)",
    "Alt+E": "浏览器 - 打开菜单 (Edge)",
    "Alt+Shift+B": "Edge - 聚焦收藏夹栏",
};

// 推荐的单键（不在黑名单中，且语义/手感友好）
const RECOMMENDED_KEYS: { key: string; desc: string }[] = [
    { key: "N", desc: "Next，语义最直观，首选推荐" },
    { key: "X", desc: "简单易按，位置顺手" },
    { key: "Z", desc: "同样空闲，可作为备选" },
];

// 规范化键名，使其与黑名单中的键一致
function normalizeKeyName(e: KeyboardEvent): string {
    const { key } = e;
    if (key === " ") return "Space";
    if (key === "ArrowUp") return "↑";
    if (key === "ArrowDown") return "↓";
    if (key === "ArrowLeft") return "←";
    if (key === "ArrowRight") return "→";
    if (key.length === 1) return key.toUpperCase();
    return key; // Tab, Esc, F1, Enter 等
}

export default function ShortcutPage() {
    const [shortcut, setShortcut] = createSignal<string>("");
    const [savedShortcut, setSavedShortcut] = createSignal<string>("");
    const [recording, setRecording] = createSignal<boolean>(false);
    const [hint, setHint] = createSignal<string>("点击右侧「录入」按钮开始设置快捷键");
    const [conflictMsg, setConflictMsg] = createSignal<string>("");

    // 初始化加载
    onSettled(() => {
        let alive = true;
        (async () => {
            try {
                const res = await browser.storage.local.get({ shortcut: "" });
                if (!alive) return;
                const v = (res.shortcut as string) || "";
                setShortcut(v);
                setSavedShortcut(v);
            } catch (err) {
                console.error("[Shortcut] 初始化读取失败:", (err as Error)?.cause ?? err);
            }
        })();
        return () => {
            alive = false;
        };
    });

    const startRecording = () => {
        setRecording(true);
        setConflictMsg("");
        setHint("请按下一个按键（或组合键），Esc 取消");
    };

    const cancelRecording = () => {
        setRecording(false);
        setConflictMsg("");
        setHint(shortcut() ? `当前快捷键：${shortcut()}` : "已取消录入");
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (!recording()) return;

        e.preventDefault();
        e.stopPropagation();

        // Esc 取消
        if (e.key === "Escape") {
            cancelRecording();
            return;
        }

        // 纯修饰键：继续等待主键
        if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

        // 构建按键名称
        const keyName = normalizeKeyName(e);

        // 构建修饰键列表
        const parts: string[] = [];
        if (e.ctrlKey) parts.push("Ctrl");
        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");
        if (e.metaKey) parts.push("Meta");

        // 最终组合字符串：如果有修饰键，则组合；否则就是单键
        const combo = parts.length > 0 ? [...parts, keyName].join("+") : keyName;

        // 检查黑名单
        if (RESERVED_SHORTCUTS[combo]) {
            setConflictMsg(`「${combo}」已被占用：${RESERVED_SHORTCUTS[combo]}，请换一个键`);
            setHint("");
            return;
        }

        // 允许单键，也允许组合键
        setShortcut(combo);
        setRecording(false);
        setConflictMsg("");
        setHint(`已录入：${combo}`);
    };

    // Solid 2.0: onSettled 中返回清理函数
    onSettled(() => {
        window.addEventListener("keydown", onKeyDown, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
        };
    });

    const save = async () => {
        const next = shortcut();
        try {
            await browser.storage.local.set({ shortcut: next });
            setSavedShortcut(next);
            setHint("已保存快捷键");
        } catch (err) {
            console.error("[Shortcut] 保存失败:", (err as Error)?.cause ?? err);
            setHint(`保存失败：${(err as Error)?.message ?? "未知错误"}`);
        }
    };

    const reset = async () => {
        if (confirm("确定要清空快捷键吗？")) {
            const prev = shortcut();
            setShortcut("");
            try {
                await browser.storage.local.set({ shortcut: "" });
                setSavedShortcut("");
                setHint("已清空快捷键");
            } catch (err) {
                console.error("[Shortcut] 清空保存失败:", (err as Error)?.cause ?? err);
                setShortcut(prev); // 回滚
                setHint("清空失败，请重试");
            }
        }
    };

    // 点击推荐键快速填入
    const applyRecommended = (key: string) => {
        setShortcut(key);
        setRecording(false);
        setConflictMsg("");
        setHint(`已选择推荐键：${key}，记得点击「保存」`);
    };

    const isDirty = () => shortcut() !== savedShortcut();

    return (
        <div class="max-w-4xl mx-auto">
            {/* ===== 头部 ===== */}
            <header class="flex justify-between items-center mb-10">
                <div>
                    <h1 class="text-3xl mb-3 text-primary flex items-center gap-3">
                        <Keyboard size={26} />
                        快捷键设置
                    </h1>
                    <p class="text-base-content/70 text-base leading-relaxed">
                        为「跳转到合集下一P」设置一个顺手的快捷键，作为 B 站原生方案的增强替代。
                    </p>
                </div>
            </header>

            {/* ===== 原生功能说明 ===== */}
            <div class="bg-primary/5 border border-primary/20 p-5 rounded-xl mb-8 flex gap-4 items-start">
                <Info size={16} class="text-primary shrink-0 mt-0.5" />
                <div>
                    <strong class="text-primary text-base">B 站其实自带下一P快捷键</strong>
                    <p class="mt-1 m-0 text-base-content/70 text-sm leading-relaxed">
                        B 站网页播放器原生支持用{" "}
                        <kbd class="kbd kbd-sm">]</kbd> 跳转下一P、<kbd class="kbd kbd-sm">[</kbd> 跳转上一P。
                        不过 <kbd class="kbd kbd-sm">]</kbd> 位于回车键附近，单手操作不够顺手，也缺乏
                        “下一”的语义联想。
                        <br />
                        本页面提供的是<strong>更友好、更易记的替代键</strong>
                        （例如 <kbd class="kbd kbd-sm">N</kbd> = Next），原生快捷键仍会正常工作，两者互不干扰。
                    </p>
                </div>
            </div>

            {/* ===== 录入卡片 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-4 p-6">
                    <h2 class="card-title text-base font-bold text-base-content flex items-center gap-2">
                        <span class="text-accent">⌨️</span> 快捷键录入
                    </h2>

                    <div class="bg-base-200/60 rounded-xl p-4">
                        <p class="text-sm text-base-content/70 m-0">
                            推荐使用单键以方便操作。如果按键出现在下方的占用表中，将无法被录入。
                        </p>
                    </div>

                    <div class="flex items-center gap-3 flex-wrap">
                        {/* 快捷键展示区 */}
                        <div
                            class={`flex-1 min-w-65 px-4 py-3 rounded-xl border-2 flex items-center gap-3 transition-colors ${recording()
                                ? "border-primary bg-primary/5"
                                : conflictMsg()
                                    ? "border-error bg-error/5"
                                    : "border-base-300 bg-base-100"
                                }`}
                        >
                            <Show
                                when={shortcut()}
                                fallback={
                                    <span class={`text-sm ${conflictMsg() ? "text-error font-semibold" : "text-base-content/40"}`}>
                                        {recording()
                                            ? "正在录入，请按下按键…"
                                            : conflictMsg() || "尚未设置快捷键"}
                                    </span>
                                }
                            >
                                <div class="flex items-center gap-2 flex-wrap">
                                    <For each={shortcut().split("+")}>
                                        {(part) => <kbd class="kbd kbd-md">{part}</kbd>}
                                    </For>
                                </div>
                            </Show>
                        </div>

                        {/* 操作按钮 */}
                        <button
                            onClick={() => (recording() ? cancelRecording() : startRecording())}
                            class={`btn ${recording() ? "btn-error" : "btn-primary"}`}
                        >
                            <Show when={recording()} fallback={
                                <Keyboard size={16} />
                                }>
                                <CircleX size={16} /> 
                                取消
                            </Show>
                        </button>

                        <button
                            onClick={reset}
                            class="btn btn-ghost btn-error"
                            disabled={!shortcut() && !savedShortcut()}
                        >
                            <RotateCcw size={16} /> 
                            清空
                        </button>

                        <button
                            onClick={save}
                            class="btn btn-soft btn-success"
                            disabled={!shortcut() || !isDirty()}
                        >
                            <Save size={16} /> 
                            保存
                        </button>
                    </div>

                    {/* 推荐键快速填入 */}
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm text-base-content/60 flex items-center gap-1">
                            <Sparkles size={14} class="text-warning" /> 
                            推荐键：
                        </span>
                        <For each={RECOMMENDED_KEYS}>
                            {(item) => (
                                <button
                                    type="button"
                                    onClick={() => applyRecommended(item.key)}
                                    class={`btn btn-sm ${shortcut() === item.key ? "btn-primary" : "btn-outline"}`}
                                    title={item.desc}
                                >
                                    <kbd class="kbd kbd-xs">{item.key}</kbd>
                                    <span class="ml-1 text-xs font-normal">{item.desc.split("，")[0]}</span>
                                </button>
                            )}
                        </For>
                    </div>

                    {/* 提示信息 / 冲突信息 */}
                    <Show when={conflictMsg()}>
                        <div class="alert alert-error py-2 px-4 rounded-xl flex items-center gap-2">
                            <ShieldAlert size={16} />
                            <span class="text-sm">{conflictMsg()}</span>
                        </div>
                    </Show>
                    <Show when={!conflictMsg() && hint()}>
                        <p class={`text-sm m-0 ${recording() ? "text-primary font-semibold" : "text-base-content/60"}`}>
                            {hint()}
                        </p>
                    </Show>
                </div>
            </div>

            {/* ===== 快捷键占用表 ===== */}
            <div class="card bg-base-100 shadow-sm border border-base-300 mb-8">
                <div class="card-body gap-3 p-6">
                    <h2 class="card-title text-base font-bold text-base-content flex items-center gap-2">
                        <span class="text-warning">🚫</span> 已被占用的快捷键（无法录入）
                    </h2>
                    <p class="text-sm text-base-content/60 m-0">
                        以下按键已被浏览器或 B 站播放器占用，录入时将被拒绝。
                        其中 <kbd class="kbd kbd-xs">[</kbd> / <kbd class="kbd kbd-xs">]</kbd>{" "}
                        就是 B 站原生的上一P / 下一P，所以不能再被本插件注册。
                    </p>

                    <div class="overflow-x-auto mt-2 max-h-96 overflow-y-auto">
                        <table class="table table-sm table-zebra w-full">
                            <thead class="sticky top-0 bg-base-100">
                                <tr>
                                    <th class="w-1/4">按键</th>
                                    <th>占用来源</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={Object.entries(RESERVED_SHORTCUTS)}>
                                    {([key, source]) => (
                                        <tr class={key === "]" || key === "[" ? "bg-warning/10" : ""}>
                                            <td>
                                                <kbd class="kbd kbd-sm">{key}</kbd>
                                            </td>
                                            <td class="text-sm text-base-content/80">{source}</td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ===== 底部提示 ===== */}
            <div class="mt-8 p-4 bg-info/10 border border-info/20 rounded-xl flex gap-2.5 items-start">
                <p class="m-0 text-xs text-base-content/70 leading-relaxed">
                    <b>关于快捷键：</b>
                    B 站原生已支持 <kbd class="kbd kbd-xs">]</kbd> 跳下一P，本插件提供的是更顺手的替代方案
                    （推荐 <kbd class="kbd kbd-xs">N</kbd> = Next），两者可共存，不冲突。
                    <br />
                    录入过程中按 <kbd class="kbd kbd-xs">Esc</kbd> 可取消；录入的按键若命中占用表会被实时拒绝。
                    <br />
                    快捷键保存在浏览器本地，清除扩展数据或重装后需重新设置。
                </p>
            </div>
        </div>
    );
}