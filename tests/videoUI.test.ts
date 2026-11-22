import { describe, expect, test } from "bun:test";
import { pickNextSegment } from "../utils/videoUI";
import type { SkipSegment } from "../types/types";

const segment = (
    id: string,
    start: number,
    end: number,
    kind: SkipSegment["kind"] = "skip",
    source: SkipSegment["source"] = "manual",
): SkipSegment => ({ id, start, end, kind, source });

describe("pickNextSegment", () => {
    test("手动没有下一 P 时使用云端下一 P", () => {
        expect(
            pickNextSegment(
                [],
                [segment("cloud-next", 123, 200, "next", "api")],
            ),
        ).toMatchObject({ id: "cloud-next", start: 123 });
    });

    test("手动与云端都有时取先触发的", () => {
        const manual = segment("manual-next", 123, 200, "next");
        const cloud = segment("cloud-next", 456, 500, "next", "api");

        expect(pickNextSegment([manual], [cloud])).toMatchObject({
            id: "manual-next",
        });
        expect(pickNextSegment([manual], [cloud])?.start).toBe(123);

        const lateManual = segment("late-manual", 456, 500, "next");
        const earlyCloud = segment("early-cloud", 123, 200, "next", "api");
        expect(
            pickNextSegment([lateManual], [earlyCloud]),
        ).toMatchObject({ id: "early-cloud" });
    });

    test("与手动片段重叠的云端下一 P 会被忽略", () => {
        const manualSkip = segment("manual-skip", 100, 200);
        const cloudNext = segment("cloud-next", 150, 300, "next", "api");

        expect(pickNextSegment([manualSkip], [cloudNext])).toBeNull();
    });

    test("起始时间为 0 的下一 P 不参与（与播放逻辑一致）", () => {
        const zeroManual = segment("zero", 0, 100, "next");
        const cloud = segment("cloud-next", 123, 200, "next", "api");

        expect(pickNextSegment([zeroManual], [cloud])).toMatchObject({
            id: "cloud-next",
        });
        expect(pickNextSegment([zeroManual], [])).toBeNull();
    });

    test("只有云端跳过片段时仍为未设置", () => {
        expect(
            pickNextSegment([], [segment("cloud-skip", 10, 20, "skip", "api")]),
        ).toBeNull();
    });
});
