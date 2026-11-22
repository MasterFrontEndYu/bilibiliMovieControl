import { describe, expect, test } from "bun:test";
import {
    migrateLegacySegments,
    normalizeSegments,
    parseCreatedSegments,
} from "../utils/segments";

describe("normalizeSegments", () => {
    test("过滤非法/过短片段并排序", () => {
        const result = normalizeSegments([
            { id: "a", start: 10, end: 20, kind: "skip", source: "manual" },
            { id: "b", start: 30, end: 30.5, kind: "skip" },
            { start: -1, end: 5, kind: "skip" },
            { start: 20, end: 0, kind: "next" },
            { start: 5, end: 10, kind: "weird", source: "api" },
            { start: 0, end: 5, kind: "skip" },
        ]);

        expect(result).toHaveLength(4);
        expect(result[0]).toMatchObject({ start: 0, end: 5, kind: "skip" });
        expect(result[1]).toMatchObject({
            start: 5,
            end: 10,
            kind: "skip",
            source: "api",
        });
        expect(result[2]).toMatchObject({ start: 10, end: 20, kind: "skip" });
        expect(result[3]).toMatchObject({ start: 20, end: 0, kind: "next" });
    });

    test("缺少 id 时生成 id，source 默认 manual", () => {
        const segment = normalizeSegments([
            { start: 0, end: 5, kind: "skip" },
        ])[0]!;

        expect(segment.id).toBeString();
        expect(segment.id.length).toBeGreaterThan(0);
        expect(segment.source).toBe("manual");
    });

    test("非数组返回空数组", () => {
        expect(normalizeSegments(null)).toEqual([]);
        expect(normalizeSegments("bad")).toEqual([]);
    });
});

describe("migrateLegacySegments", () => {
    test("迁移 opRanges 与 jumpConfig", () => {
        const result = migrateLegacySegments(
            [
                {
                    start: { h: 0, m: 1, s: 0 },
                    end: { h: 0, m: 2, s: 0 },
                },
                {
                    start: { h: 0, m: 0, s: 10 },
                    end: { h: 0, m: 0, s: 10 },
                },
            ],
            { h: 0, m: 3, s: 0 },
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            start: 60,
            end: 120,
            kind: "skip",
            source: "manual",
        });
        expect(result[1]).toMatchObject({
            start: 180,
            end: 0,
            kind: "next",
            source: "manual",
        });
    });
});

describe("parseCreatedSegments", () => {
    test("解析上传返回的片段，支持 outro 与 UUID 缺失", () => {
        const result = parseCreatedSegments([
            { UUID: "u1", segment: [1, 2], category: "outro" },
            { segment: [3, 4], category: "sponsor" },
            { segment: [5, 4], category: "sponsor" },
            null,
            "bad",
        ]);

        expect(result).toEqual([
            { id: "u1", start: 1, end: 2, kind: "next", source: "api" },
            { id: "3-4", start: 3, end: 4, kind: "skip", source: "api" },
        ]);
    });

    test("非数组返回空数组", () => {
        expect(parseCreatedSegments(undefined)).toEqual([]);
        expect(parseCreatedSegments({})).toEqual([]);
    });
});
