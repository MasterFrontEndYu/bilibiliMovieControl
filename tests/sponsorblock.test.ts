import { afterEach, describe, expect, test } from "bun:test";
import {
    buildSegmentsUrl,
    getSegmentInfo,
    isValidBvid,
    normalizeApiSegments,
    resolveVideoPage,
    submitSkipSegments,
    voteOnSegment,
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

describe("getSegmentInfo", () => {
    test("解析 segmentInfo 数组并归一化字段", async () => {
        globalThis.fetch = (async () =>
            new Response(
                JSON.stringify([
                    {
                        videoID: VALID_BVID,
                        cid: 123,
                        startTime: 10,
                        endTime: 20,
                        votes: 5,
                        locked: 1,
                        UUID: "uuid-1",
                        userID: "public-user",
                        timeSubmitted: 100,
                        views: 30,
                        category: "outro",
                        actionType: "skip",
                        videoDuration: 100,
                        hidden: 1,
                        reputation: 2.5,
                        shadowHidden: 0,
                    },
                ]),
            )) as unknown as typeof fetch;

        const result = await getSegmentInfo("uuid-1", true);

        expect(result.ok).toBe(true);
        expect(result.info).toMatchObject({
            videoID: VALID_BVID,
            cid: "123",
            startTime: 10,
            endTime: 20,
            votes: 5,
            locked: 1,
            UUID: "uuid-1",
            hidden: 1,
            reputation: 2.5,
            shadowHidden: 0,
        });
    });

    test("404 返回 not-found", async () => {
        globalThis.fetch = (async () =>
            new Response("", { status: 404 })) as unknown as typeof fetch;

        expect(await getSegmentInfo("missing")).toEqual({
            ok: false,
            reason: "not-found",
        });
    });
});

describe("voteOnSegment", () => {
    test("提交正确的投票 body", async () => {
        let body: unknown;
        globalThis.fetch = (async (
            _input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            body = JSON.parse(String(init?.body));
            return new Response("");
        }) as unknown as typeof fetch;

        const userID = "a".repeat(40);
        expect(await voteOnSegment("uuid-1", userID, 1)).toEqual({ ok: true });
        expect(body).toEqual({ UUID: "uuid-1", userID, type: 1 });
    });

    test("403 返回 rejected", async () => {
        globalThis.fetch = (async () =>
            new Response("rejected", {
                status: 403,
            })) as unknown as typeof fetch;

        const result = await voteOnSegment("uuid-1", "a".repeat(40), 0);
        expect(result).toMatchObject({ ok: false, reason: "rejected" });
    });
});
