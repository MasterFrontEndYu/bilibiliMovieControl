import type { JumpPanelConfig, SubmitSegmentInput } from "@/types/types";
import { effectiveEnd, MIN_SEGMENT_SECONDS } from "@/utils/segments";

/**
 * 把手动片段转换成待提交的片段：
 * - skip → intro（从 0 秒开始）或 sponsor
 * - next → outro（到结束位置或视频结尾）
 * 云端来源（source=api）不重复提交。
 */
export function buildSubmitSegments(
    config: JumpPanelConfig,
    videoDuration: number,
): SubmitSegmentInput[] {
    const segments: SubmitSegmentInput[] = [];

    for (const segment of config.segments) {
        if (segment.source === "api") continue;

        if (segment.kind === "skip") {
            const end =
                videoDuration > 0
                    ? Math.min(segment.end, videoDuration)
                    : segment.end;
            if (end - segment.start < MIN_SEGMENT_SECONDS) continue;

            segments.push({
                start: segment.start,
                end,
                category: segment.start <= 1 ? "intro" : "sponsor",
                actionType: "skip",
            });
            continue;
        }

        const end = effectiveEnd(segment, videoDuration);
        if (end - segment.start < MIN_SEGMENT_SECONDS) continue;

        segments.push({
            start: segment.start,
            end,
            category: "outro",
            actionType: "skip",
        });
    }

    return segments;
}
