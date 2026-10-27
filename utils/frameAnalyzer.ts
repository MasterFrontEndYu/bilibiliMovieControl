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

const DEFAULT_CONFIG: AnalyzerConfig = {
    sampleWidth: 200,
    sampleHeight: 200,
    blackLuminanceThreshold: 30,
    staticPixelDiffThreshold: 15,
    staticDiffRatioThreshold: 0.05,
    blackFrameRequired: 3, // 约 3 秒
    staticFrameRequired: 8, // 约 8 秒
};

// 内部全局状态
let frameCanvas: HTMLCanvasElement | null = null;
let frameCtx: CanvasRenderingContext2D | null = null;
let previousBuffer: Uint8ClampedArray | null = null; // 存储上一帧采样数据
let isBufferValid = false; // 是否有有效的参考帧

let blackFrameCount = 0;
let staticFrameCount = 0;

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
        // 绘制视频到 canvas
        frameCtx.drawImage(
            video,
            0,
            0,
            currentConfig.sampleWidth,
            currentConfig.sampleHeight,
        );
        const imageData = frameCtx.getImageData(
            0,
            0,
            currentConfig.sampleWidth,
            currentConfig.sampleHeight,
        );
        const data = imageData.data;
        const totalPixels = data.length / 4;

        // 动态计算采样步长，使采样点数大约为 2000 个，但限制最大步长 8
        const targetSamples = 2000;
        let step = Math.max(
            1,
            Math.floor(Math.sqrt(totalPixels / targetSamples)),
        );
        step = Math.min(step, 8); // 防止采样过疏

        // 合并循环：同时计算平均亮度和静态差异
        let totalLuminance = 0;
        let sampledPixels = 0;
        let diffPixels = 0;
        const diffThreshold = currentConfig.staticPixelDiffThreshold;

        const isInitial = !isBufferValid;

        for (let i = 0; i < data.length; i += step * 4) {
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;

            // 1. 亮度累加
            totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sampledPixels++;

            // 2. 静态对比（仅当有有效参考帧）
            if (!isInitial) {
                const prevR = previousBuffer[i] ?? 0;
                const prevG = previousBuffer[i + 1] ?? 0;
                const prevB = previousBuffer[i + 2] ?? 0;
                const diff =
                    Math.abs(r - prevR) +
                    Math.abs(g - prevG) +
                    Math.abs(b - prevB);
                // 平均通道差异
                if (diff / 3 > diffThreshold) {
                    diffPixels++;
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

        return { black, static: staticFlag };
    } catch (e) {
        console.warn("[FrameAnalyzer] 分析帧异常:", e);
        // 异常时重置有效性标记，避免基于错误帧的后续检测
        isBufferValid = false;
        return { black: false, static: false };
    }
}

/**
 * 核心判定函数：受控于 Content Script 的时间逻辑
 * @param video 视频元素
 * @param isPlaying 播放状态
 */
export function checkEndingByFrame(
    video: HTMLVideoElement,
    isPlaying: boolean,
): boolean {
    // 1. 基础守卫
    if (!video || video.paused || !isPlaying) return false;
    if (isPictureInPictureActive() || video.readyState < 2) {
        // 画中画或未就绪时不分析，但保持状态（不重置计数器）
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
 */
export function updateAnalyzerConfig(config: Partial<AnalyzerConfig>): void {
    const oldWidth = currentConfig.sampleWidth;
    const oldHeight = currentConfig.sampleHeight;
    currentConfig = { ...currentConfig, ...config };

    // 如果尺寸变化，需要重新初始化
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
