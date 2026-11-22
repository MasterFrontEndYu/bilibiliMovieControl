import { describe, expect, test } from "bun:test";
import { pickNextSegment } from "../utils/segments";
import type { SkipSegment } from "../types/types";

const segment = (
    id: string,
    start: number,
    end: number,
    kind: SkipSegment["kind"] = "skip",
    source: SkipSegment["source"] = "manual",
): SkipSegment => ({ id, start, end, kind, source });

describe("pickNextSegment", () => {
    test("没有手动下一 P 时使用云端下一 P", () => {
        expect(
            pickNextSegment(
                [],
                [segment("cloud-next", 123, 200, "next", "api")],
            ),
        ).toMatchObject({ id: "cloud-next", start: 123 });
    });

    test("云端多条下一 P 只取 start 最大的一条", () => {
        const result = pickNextSegment(
            [],
            [
                segment("early", 100, 150, "next", "api"),
                segment("late", 300, 350, "next", "api"),
                segment("middle", 200, 250, "next", "api"),
            ],
        );

        expect(result).toMatchObject({ id: "late", start: 300 });
    });

    test("手动 next 优先于云端（即使云端更早）", () => {
        const result = pickNextSegment(
            [segment("manual", 456, 500, "next")],
            [segment("cloud", 123, 200, "next", "api")],
        );

        expect(result).toMatchObject({ id: "manual", start: 456 });
    });

    test("手动意外存在多条 next 时也只取 start 最大", () => {
        const result = pickNextSegment(
            [
                segment("early-manual", 100, 150, "next"),
                segment("late-manual", 300, 350, "next"),
            ],
            [],
        );

        expect(result).toMatchObject({ id: "late-manual", start: 300 });
    });

    test("与任意手动片段重叠的云端 next 会被忽略", () => {
        const manualSkip = segment("manual-skip", 100, 200);
        const cloudNext = segment("cloud-next", 150, 300, "next", "api");

        expect(pickNextSegment([manualSkip], [cloudNext])).toBeNull();
    });

    test("start <= 0 或超过视频时长的候选被丢弃", () => {
        expect(
            pickNextSegment(
                [segment("zero", 0, 100, "next")],
                [segment("cloud", 123, 200, "next", "api")],
            ),
        ).toMatchObject({ id: "cloud" });

        expect(
            pickNextSegment(
                [],
                [segment("beyond", 600, 700, "next", "api")],
                500,
            ),
        ).toBeNull();

        expect(
            pickNextSegment(
                [segment("manual-beyond", 600, 700, "next")],
                [segment("cloud", 123, 200, "next", "api")],
                500,
            ),
        ).toMatchObject({ id: "cloud" });
    });

    test("只有云端跳过片段时仍为未设置", () => {
        expect(
            pickNextSegment([], [segment("cloud-skip", 10, 20, "skip", "api")]),
        ).toBeNull();
    });

    test("视频时长未知时不按 start 过滤", () => {
        expect(
            pickNextSegment(
                [],
                [segment("cloud", 10_000, 10_100, "next", "api")],
                0,
            ),
        ).toMatchObject({ id: "cloud" });
    });
});
