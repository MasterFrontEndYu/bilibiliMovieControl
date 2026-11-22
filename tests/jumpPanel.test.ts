import { describe, expect, test } from "bun:test";
import { buildSubmitSegments } from "../utils/jumpPanel";
import type { JumpPanelConfig, SkipSegment } from "../types/types";

const segment = (
    id: string,
    start: number,
    end: number,
    kind: SkipSegment["kind"] = "skip",
    source: SkipSegment["source"] = "manual",
): SkipSegment => ({ id, start, end, kind, source });

const config = (segments: SkipSegment[]): JumpPanelConfig => ({
    segments,
    useCloudSegments: true,
});

describe("buildSubmitSegments", () => {
    test("0 秒起的跳过转 intro，非 0 秒转 sponsor", () => {
        const result = buildSubmitSegments(
            config([
                segment("intro", 0, 60),
                segment("sponsor", 120, 180),
            ]),
            1000,
        );

        expect(result).toEqual([
            {
                start: 0,
                end: 60,
                category: "intro",
                actionType: "skip",
            },
            {
                start: 120,
                end: 180,
                category: "sponsor",
                actionType: "skip",
            },
        ]);
    });

    test("下一 P 转 outro，end<=start 时用视频结尾", () => {
        const result = buildSubmitSegments(
            config([segment("next", 900, 0, "next")]),
            1000,
        );

        expect(result).toEqual([
            {
                start: 900,
                end: 1000,
                category: "outro",
                actionType: "skip",
            },
        ]);
    });

    test("结束时间不超过视频时长", () => {
        const result = buildSubmitSegments(
            config([segment("long", 950, 1200)]),
            1000,
        );

        expect(result[0]).toMatchObject({ start: 950, end: 1000 });
    });

    test("过滤云端来源、过短片段与无效内容", () => {
        const result = buildSubmitSegments(
            config([
                segment("api", 10, 20, "skip", "api"),
                segment("short", 30, 30.5),
                segment("bad", 50, 40),
            ]),
            1000,
        );

        expect(result).toEqual([]);
    });

    test("视频时长未知时保留原始结束时间", () => {
        const result = buildSubmitSegments(
            config([segment("plain", 10, 20)]),
            0,
        );

        expect(result[0]).toMatchObject({ start: 10, end: 20 });
    });
});
