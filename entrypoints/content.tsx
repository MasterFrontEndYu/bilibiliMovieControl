import { render } from "solid-js/web";
import { createSignal, Show } from "solid-js";
import { browser } from "wxt/browser";
import {
  initFrameAnalyzer,
  getMainVideo,
  checkEndingByFrame,
  resetFrameAnalyzer,
  updateAnalyzerConfig,
  destroyFrameAnalyzer,
} from "../utils/frameAnalyzer";
import { TimeRange, TimePoint } from "@/assets/types";

// TODO 1. 将ui 移至components，content只负责逻辑和状态管理

export default defineContentScript({
  matches: ["*://*.bilibili.com/video/*"],
  cssInjectionMode: "manual",

  async main(ctx) {
    // 初始等待 DOM 就绪（可优化为更精确的等待）
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // --- 响应式状态 ---
    const [opRanges, setOpRanges] = createSignal<TimeRange[]>([]);
    const [mode, setMode] = createSignal<"frame" | "manual">("frame");
    const [isAnalyzing, setIsAnalyzing] = createSignal(false);
    const [frameConfig, setFrameConfig] = createSignal<TimePoint>({
      h: 0,
      m: 0,
      s: 0,
    });
    const [jumpConfig, setJumpConfig] = createSignal<TimePoint>({
      h: 0,
      m: 0,
      s: 0,
    });

    const [isCollectionPage, setIsCollectionPage] = createSignal(false);
    const [isAutoHandle, setIsAutoHandle] = createSignal<boolean>(true);
    

    let lastUrl = location.href;
    let lastJumpTime = 0;
    let disposeUI: (() => void) | null = null;

    let lastSentReadyState = false; 

    // --- 辅助函数 ---
    const toSeconds = (t: TimePoint) =>
      (t.h || 0) * 3600 + (t.m || 0) * 60 + (t.s || 0);

    // 修复：正确处理 false 值
    const updateConfig = (data: any) => {
      if (data.isAutoHandle !== undefined) setIsAutoHandle(data.isAutoHandle);
      if (data.opRanges) setOpRanges(data.opRanges);
      if (data.frameConfig) setFrameConfig(data.frameConfig);
      if (data.jumpConfig) setJumpConfig(data.jumpConfig);
      if (data.mode) setMode(data.mode);
      if (data.analyzerSettings) {
        updateAnalyzerConfig(data.analyzerSettings);
      }
    };

    // 清理 UI（销毁 Solid 根 + 移除 DOM 挂载点）
    const cleanupUI = () => {
      disposeUI?.();
      disposeUI = null;
      const el = document.getElementById("bili-skip-wrapper-unique");
      if (el) el.remove();
    };

    // 挂载 UI（每次调用先清理旧实例，再创建新实例）
    const mountUI = () => {
      if (!isCollectionPage()) return;

      // 先清理，避免重复根
      cleanupUI();

      const anchor =
        document.getElementById("viewbox_report") ||
        document.querySelector(".video-info-title") ||
        document.querySelector(".cl-info-title");

      if (!anchor) return;

      const mountPoint = document.createElement("span");
      mountPoint.id = "bili-skip-wrapper-unique";
      anchor.appendChild(mountPoint);

      const format = (t: TimePoint) => {
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${t.h}:${pad(t.m)}:${pad(t.s)}`;
      };

      disposeUI = render(
        () => (
          <Show when={isCollectionPage()}>
            <div style={{ display: "flex", "align-items": "center","justify-content":"space-between", }}>
              <div
                style={{
                  display: "inline-flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "1px 12px",
                  background: "#fb7299",
                  color: "white",
                  "border-radius": "8px",
                  "font-size": "12px",
                  "vertical-align": "middle",
                  "box-shadow": "0 2px 6px rgba(251,114,153,0.3)",
                  "font-family": "sans-serif",
                }}
              >
                <span title="跳过段数">⏭ {opRanges().length}段</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>
                  {mode() === "manual"
                    ? `🏁 切集起点: ${format(jumpConfig())}`
                    : `🔍 分析起点: ${format(frameConfig())}`}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    "margin-left": "4px",
                    animation: "blink 1s infinite",
                    color: "#fff",
                  }}
                >
                  {isAnalyzing() ? "●" : ""}
                </span>
              </div>
              <div style={{
                display: `${isAutoHandle() ? 'none' : 'inline-flex'}`,
                "align-items": "center",
              }}>
                <p>当前为用户设置状态</p>
                <span
                  style={{
                    display: "inline-block",
                    background: "white",
                    color: "#fb7299",
                    border: "1px solid #fb7299",
                    "border-radius": "4px",
                    padding: "2px 10px",
                    cursor: "pointer",
                    "font-size": "12px",
                    "font-weight": "bold",
                    transition: "background 0.2s, color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fb7299";
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "#fb7299";
                  }}
                >
                  启用跳过
                </span>
              </div>
            </div>
          </Show>
        ),
        mountPoint
      );
    };

    const executeJump = () => {
      const now = Date.now();
      if (now - lastJumpTime < 3000) return;
      const nextBtn = document.querySelector(
        ".bpx-player-ctrl-next"
      ) as HTMLElement;
      if (nextBtn) {
        lastJumpTime = now;
        nextBtn.click();
        resetFrameAnalyzer();
      }
    };

    const runControlLogic = () => {
      const video = getMainVideo();
      if (!video || video.readyState < 2) return;

      const cur = video.currentTime;

      // 1. 多段跳过
      for (const range of opRanges()) {
        const start = toSeconds(range.start);
        const end = toSeconds(range.end);
        if (end > start && cur >= start && cur < end) {
          video.currentTime = end;
          return;
        }
      }

      // 2. 切集逻辑
      if (mode() === "manual") {
        const jumpTime = toSeconds(jumpConfig());
        if (jumpTime > 0 && cur >= jumpTime) executeJump();
      } else {
        // 自动模式
        const analyzeStartTime = toSeconds(frameConfig());
        if (analyzeStartTime > 0 && cur >= analyzeStartTime) {
          if (!isAnalyzing()) setIsAnalyzing(true);
          // 检查片尾
          if (checkEndingByFrame(video, !video.paused)) {
            executeJump();
            setIsAnalyzing(false);
          }
        } else {
          if (isAnalyzing()) setIsAnalyzing(false);
        }
      }
    };

    // --- 初始化 ---
    const stored = await browser.storage.local.get([
      "opRanges",
      "frameConfig",
      "jumpConfig",
      "mode",
      "isAutoHandle",
    ]);
    updateConfig(stored);
    initFrameAnalyzer();

    // --- 消息监听 ---
    const handleMessage = (msg: any, sender: any, sendResponse: any) => {
      if (msg.type === "UPDATE_CONFIG") {
        updateConfig(msg.data);
        mountUI();
      }
      if (msg.type === "QUERY_READY_STATUS") {
        sendResponse({ isCollection: isCollectionPage() && isAutoHandle() });
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);

    // --- 主循环 ---
    const mainTimer = setInterval(async () => {
      const isCol = !!(
        document.querySelector(".video-pod") ||
        document.querySelector(".multi-page") ||
        document.querySelector(".cur-list")
      );

      const res = await browser.storage.local.get({ isAutoHandle: true });

      setIsAutoHandle(res.isAutoHandle as boolean);
      const active = isCol && res.isAutoHandle as boolean;

      // 只在状态变化时发送消息
      if (isCol !== lastSentReadyState) {
        lastSentReadyState = isCol;
        browser.runtime.sendMessage({
          type: "SYNC_PAGE_READY",
          isPageReady: isCol,
        });
      }

      if (isCol) {
        // 同步页面类型状态（仅在第一次变为 true 时触发 UI 变化）
        if (isCol !== isCollectionPage()) {
          setIsCollectionPage(isCol);
        }

        // URL 变化时重置并重新挂载
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          lastJumpTime = 0;
          resetFrameAnalyzer();
          // 切换视频时清理旧 UI，再重新挂载
          cleanupUI();
          setTimeout(mountUI, 1000);
        } else {
          // 未换 URL 但需要确保 UI 存在（如果被意外移除则重建）
          const existing = document.getElementById("bili-skip-wrapper-unique");
          if (!existing) {
            mountUI();
          }
        }

        // 执行主逻辑（每秒一次）
        runControlLogic();
      } else {
        // 不再激活：清理 UI 并重置状态
        if (isCollectionPage()) {
          setIsCollectionPage(false);
        }
        cleanupUI();
        // 重置消息发送状态，以便再次激活时重新发送
        lastSentReadyState = false;
      }
    }, 1000);

    // --- 清理 ---
    ctx.onInvalidated(() => {
      clearInterval(mainTimer);
      browser.runtime.onMessage.removeListener(handleMessage);
      cleanupUI();
      destroyFrameAnalyzer();
    });
  },
});