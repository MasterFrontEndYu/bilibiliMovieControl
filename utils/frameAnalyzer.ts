// utils/frameAnalyzer.ts

/**
 * 帧分析器配置 - 纯净版
 * 删除了业务层的时间/百分比判定，专注于图像算法
 */
interface AnalyzerConfig {
    sampleWidth: number; // 采样宽度
    sampleHeight: number; // 采样高度
    blackLuminanceThreshold: number; // 黑屏亮度阈值 (0-255)
    staticPixelDiffThreshold: number; // 像素差异阈值 (0-255)
    staticDiffRatioThreshold: number; // 静态帧比例阈值 (0-1)
    blackFrameRequired: number; // 触发所需的连续黑屏帧数
    staticFrameRequired: number; // 触发所需的连续静态帧数
}

/**
 * ⚠️ 检测频率由调用方决定。
 * content.tsx 中 FRAME_CHECK_INTERVAL = 200ms（5Hz），因此：
 *   blackFrameRequired: 15  ≈ 3 秒
 *   staticFrameRequired: 40 ≈ 8 秒
 * 若调整了 FRAME_CHECK_INTERVAL，这两个值必须同步调整。
 */
const DEFAULT_CONFIG: AnalyzerConfig = {
    sampleWidth: 200,
    sampleHeight: 200,
    blackLuminanceThreshold: 30,
    staticPixelDiffThreshold: 15,
    staticDiffRatioThreshold: 0.05,
    blackFrameRequired: 15, // 15 × 200ms ≈ 3 秒
    staticFrameRequired: 40, // 40 × 200ms ≈ 8 秒
};

// 内部全局状态
let frameCanvas: HTMLCanvasElement | null = null;
let frameCtx: CanvasRenderingContext2D | null = null;
let previousBuffer: Uint8ClampedArray | null = null; // 存储上一帧采样数据
let isBufferValid = false; // 是否有有效的参考帧

let blackFrameCount = 0;
let staticFrameCount = 0;

// 跨域污染等异常的处理：连续失败到阈值后禁用当前视频的分析，避免反复刷屏
let consecutiveErrors = 0;
let analysisDisabled = false;
let lastErrWarnTime = 0;
const MAX_CONSECUTIVE_ERRORS = 10;
const ERROR_WARN_INTERVAL = 10000; // 10 秒内最多 warn 一次

let currentConfig: AnalyzerConfig = { ...DEFAULT_CONFIG };

/**
 * 初始化分析器
 */
export function initFrameAnalyzer(config?: Partial<AnalyzerConfig>): void {
    if (config) {
        currentConfig = { ...DEFAULT_CONFIG, ...config };
    }

    if (frameCanvas) {
        // 若尺寸变化，重建
        if (
            frameCanvas.width !== currentConfig.sampleWidth ||
            frameCanvas.height !== currentConfig.sampleHeight
        ) {
            destroyFrameAnalyzer();
        } else {
            return;
        }
    }

    frameCanvas = document.createElement("canvas");
    frameCanvas.width = currentConfig.sampleWidth;
    frameCanvas.height = currentConfig.sampleHeight;
    frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });

    const bufferSize =
        currentConfig.sampleWidth * currentConfig.sampleHeight * 4;
    previousBuffer = new Uint8ClampedArray(bufferSize);
    isBufferValid = false; // 初始无有效参考帧

    resetFrameAnalyzer();
}

/**
 * 获取 B 站视频元素
 */
export function getMainVideo(): HTMLVideoElement | null {
    return (
        document.querySelector<HTMLVideoElement>(".bpx-player-video video") ||
        document.querySelector<HTMLVideoElement>("#bilibili-player video") ||
        document.querySelector<HTMLVideoElement>("video")
    );
}

/**
 * 画中画检测 (PiP 下抓取的帧通常是黑的，需要避开)
 */
function isPictureInPictureActive(): boolean {
    return !!document.pictureInPictureElement;
}

/**
 * 重置状态 (保留缓冲区，仅重置计数器，并清空有效性标记)
 */
export function resetFrameAnalyzer(): void {
    blackFrameCount = 0;
    staticFrameCount = 0;
    // 触发后重置标记，让静态检测从下一帧重新建立参考
    isBufferValid = false;
    // 重置异常状态，允许重新尝试分析（例如切换视频后）
    consecutiveErrors = 0;
    analysisDisabled = false;
    // 不清零 previousBuffer，但下次会覆盖
}

/**
 * 内部函数：一次绘制并分析帧，返回黑屏和静态帧判断
 */
function analyzeFrame(video: HTMLVideoElement): {
    black: boolean;
    static: boolean;
} {
    if (!frameCtx || video.readyState < 2 || !previousBuffer) {
        return { black: false, static: false };
    }

    try {
        const { sampleWidth, sampleHeight } = currentConfig;

        // 绘制视频到 canvas（等比拉伸到采样尺寸，对黑屏/静态判定无影响）
        frameCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
        const imageData = frameCtx.getImageData(
            0,
            0,
            sampleWidth,
            sampleHeight,
        );
        const data = imageData.data;
        const totalPixels = sampleWidth * sampleHeight;

        // 采样步长：目标约 2000 个采样点，限制最大步长 8
        const targetSamples = 2000;
        const step = Math.max(
            1,
            Math.min(8, Math.floor(Math.sqrt(totalPixels / targetSamples))),
        );

        let totalLuminance = 0;
        let sampledPixels = 0;
        let diffPixels = 0;
        const diffThreshold = currentConfig.staticPixelDiffThreshold;
        const isInitial = !isBufferValid;

        // 按网格采样，保证采样点分布均匀（原扁平跳步会呈斜线分布，某些区域永远采不到）
        for (let y = 0; y < sampleHeight; y += step) {
            for (let x = 0; x < sampleWidth; x += step) {
                const i = (y * sampleWidth + x) * 4;
                const r = data[i] ?? 0;
                const g = data[i + 1] ?? 0;
                const b = data[i + 2] ?? 0;

                // 1. 亮度累加
                totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
                sampledPixels++;

                // 2. 静态对比（仅当有有效参考帧）
                if (!isInitial) {
                    const prevR = previousBuffer![i] ?? 0;
                    const prevG = previousBuffer![i + 1] ?? 0;
                    const prevB = previousBuffer![i + 2] ?? 0;
                    const diff =
                        Math.abs(r - prevR) +
                        Math.abs(g - prevG) +
                        Math.abs(b - prevB);
                    if (diff / 3 > diffThreshold) {
                        diffPixels++;
                    }
                }
            }
        }

        const avgLuminance =
            sampledPixels > 0 ? totalLuminance / sampledPixels : 0;
        const black = avgLuminance < currentConfig.blackLuminanceThreshold;

        // 静态判断（仅当有参考帧）
        let staticFlag = false;
        if (!isInitial && sampledPixels > 0) {
            const diffRatio = diffPixels / sampledPixels;
            staticFlag = diffRatio < currentConfig.staticDiffRatioThreshold;
        }

        // 更新缓冲区并标记有效
        previousBuffer.set(data);
        isBufferValid = true;
        consecutiveErrors = 0; // 成功一次就清零连续错误计数

        return { black, static: staticFlag };
    } catch (e) {
        isBufferValid = false;
        consecutiveErrors++;

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !analysisDisabled) {
            analysisDisabled = true;
            console.warn(
                `[FrameAnalyzer] 连续 ${MAX_CONSECUTIVE_ERRORS} 次分析失败，当前视频帧分析已禁用，切换视频后恢复`,
            );
        } else if (Date.now() - lastErrWarnTime > ERROR_WARN_INTERVAL) {
            lastErrWarnTime = Date.now();
            console.warn("[FrameAnalyzer] 分析帧异常:", e);
        }

        return { black: false, static: false };
    }
}

/**
 * 核心判定函数：受控于 Content Script 的时间逻辑
 * @param video 视频元素
 */
export function checkEndingByFrame(video: HTMLVideoElement): boolean {
    // 当前视频因连续异常被禁用
    if (analysisDisabled) return false;

    // 1. 基础守卫：暂停时清零计数，避免暂停期间静止画面继续累计
    if (!video || video.paused) {
        blackFrameCount = 0;
        staticFrameCount = 0;
        return false;
    }
    // 画中画或未就绪：只清静态计数（黑屏需要连续帧累积，不应被短暂波动重置）
    if (isPictureInPictureActive() || video.readyState < 2) {
        staticFrameCount = 0;
        return false;
    }

    // 2. 执行图像分析
    const { black, static: stat } = analyzeFrame(video);

    // 3. 更新计数器
    blackFrameCount = black ? blackFrameCount + 1 : 0;
    staticFrameCount = stat ? staticFrameCount + 1 : 0;

    // 4. 触发判断
    if (
        blackFrameCount >= currentConfig.blackFrameRequired ||
        staticFrameCount >= currentConfig.staticFrameRequired
    ) {
        console.log(
            `[BiliControl] 帧分析通过: 黑屏(${blackFrameCount}) | 静态(${staticFrameCount})`,
        );
        resetFrameAnalyzer(); // 触发后重置状态（包括清空有效性标记）
        return true;
    }

    return false;
}

/**
 * 运行时动态更新算法敏感度（若尺寸改变则重建 canvas）
 * 注意：当前 content.tsx 未调用此函数，AnalyzerConfig 全部使用默认值。
 * 若将来要在设置页开放"敏感度"，从这里接入。
 */
export function updateAnalyzerConfig(config: Partial<AnalyzerConfig>): void {
    const oldWidth = currentConfig.sampleWidth;
    const oldHeight = currentConfig.sampleHeight;
    currentConfig = { ...currentConfig, ...config };

    if (
        oldWidth !== currentConfig.sampleWidth ||
        oldHeight !== currentConfig.sampleHeight
    ) {
        destroyFrameAnalyzer();
        initFrameAnalyzer(currentConfig);
    }
}

/**
 * 释放内存
 */
export function destroyFrameAnalyzer(): void {
    frameCanvas = null;
    frameCtx = null;
    previousBuffer = null;
    isBufferValid = false;
    resetFrameAnalyzer();
}
