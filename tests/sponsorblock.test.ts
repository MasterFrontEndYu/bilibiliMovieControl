import { afterEach, describe, expect, test } from "bun:test";
import {
    buildSegmentsUrl,
    isValidBvid,
    normalizeApiSegments,
    resolveVideoPage,
    submitSkipSegments,
} from "../utils/sponsorblock";

const VALID_BVID = "BV1M4sz6sEcu";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("normalizeApiSegments", () => {
    test("兼容扁平数组并归一化字段", () => {
        const result = normalizeApiSegments([
            {
                segment: [10, 20],
                UUID: "u1",
                cid: 123,
                category: "intro",
                actionType: "skip",
                locked: 1,
                votes: 3,
                videoDuration: 100,
            },
        ]);

        expect(result).toEqual([
            {
                id: "u1",
                cid: "123",
                start: 10,
                end: 20,
                category: "intro",
                actionType: "skip",
                locked: 1,
                votes: 3,
                videoDuration: 100,
            },
        ]);
    });

    test("兼容按视频分组的结构并排序", () => {
        const result = normalizeApiSegments([
            {
                videoID: VALID_BVID,
                segments: [
                    { segment: [30, 40], UUID: "b" },
                    { segment: [0, 5], UUID: "a" },
                ],
            },
        ]);

        expect(result.map((item) => item.id)).toEqual(["a", "b"]);
    });

    test("丢弃非法时间和空数据，cid 缺失时为空串", () => {
        const result = normalizeApiSegments([
            { segment: [5, 4] },
            { segment: [Number.NaN, 10] },
            null,
            { segment: [1, 2] },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            start: 1,
            end: 2,
            cid: "",
            category: "sponsor",
            actionType: "skip",
        });
    });
});

describe("isValidBvid / buildSegmentsUrl", () => {
    test("只接受 BV + 10 位字母数字", () => {
        expect(isValidBvid(VALID_BVID)).toBe(true);
        expect(isValidBvid("BV123")).toBe(false);
        expect(isValidBvid("av123")).toBe(false);
        expect(isValidBvid(undefined)).toBe(false);
    });

    test("带 cid 时附加 cid 参数", () => {
        const withCid = new URL(buildSegmentsUrl(VALID_BVID, "123"));
        const withoutCid = new URL(buildSegmentsUrl(VALID_BVID));

        expect(withCid.searchParams.get("videoID")).toBe(VALID_BVID);
        expect(withCid.searchParams.get("cid")).toBe("123");
        expect(withoutCid.searchParams.has("cid")).toBe(false);
    });
});

describe("resolveVideoPage", () => {
    test("精确匹配分 P，找不到时返回 null（不退回第 1 P）", async () => {
        globalThis.fetch = (async () =>
            new Response(
                JSON.stringify({
                    data: [{ page: 1, cid: 111, duration: 100 }],
                }),
            )) as unknown as typeof fetch;

        expect(await resolveVideoPage(VALID_BVID, 1)).toEqual({
            cid: "111",
            duration: 100,
        });
        expect(await resolveVideoPage(VALID_BVID, 2)).toBeNull();
    });
});

describe("submitSkipSegments", () => {
    test("无法解析 cid 时不发起上传", async () => {
        let posted = false;
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            if (String(input).includes("pagelist")) {
                return new Response(
                    JSON.stringify({
                        data: [{ page: 1, cid: 111, duration: 100 }],
                    }),
                );
            }
            posted = true;
            return new Response("{}");
        }) as unknown as typeof fetch;

        const result = await submitSkipSegments({
            bvid: VALID_BVID,
            page: 2,
            videoDuration: 100,
            userID: "a".repeat(40),
            segments: [{ start: 1, end: 2 }],
        });

        expect(result).toEqual({ ok: false, reason: "network" });
        expect(posted).toBe(false);
    });
});
