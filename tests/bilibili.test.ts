import { describe, expect, test } from "bun:test";
import {
    cleanBiliUrl,
    formatTime,
    getBvidFromUrl,
    pad,
    toSeconds,
} from "../utils/bilibili";

describe("getBvidFromUrl", () => {
    test("从视频 URL 中提取 BV 号", () => {
        expect(
            getBvidFromUrl(
                "https://www.bilibili.com/video/BV1M4sz6sEcu/?p=2&spm_id_from=333",
            ),
        ).toBe("BV1M4sz6sEcu");
        expect(
            getBvidFromUrl("https://www.bilibili.com/video/BV1M4sz6sEcu"),
        ).toBe("BV1M4sz6sEcu");
    });

    test("无 BV 时返回 null", () => {
        expect(
            getBvidFromUrl("https://www.bilibili.com/video/av123"),
        ).toBeNull();
        expect(getBvidFromUrl("https://www.bilibili.com/")).toBeNull();
    });
});

describe("cleanBiliUrl", () => {
    test("保留 p 参数并去掉其他查询参数/末尾斜杠", () => {
        expect(
            cleanBiliUrl(
                "https://www.bilibili.com/video/BV1M4sz6sEcu/?p=2&t=10",
            ),
        ).toBe("https://www.bilibili.com/video/BV1M4sz6sEcu?p=2");
        expect(
            cleanBiliUrl("https://www.bilibili.com/video/BV1M4sz6sEcu/"),
        ).toBe("https://www.bilibili.com/video/BV1M4sz6sEcu");
    });

    test("非法 URL 原样返回", () => {
        expect(cleanBiliUrl("not a url")).toBe("not a url");
    });
});

describe("时间工具", () => {
    test("toSeconds / formatTime / pad", () => {
        expect(toSeconds({ h: 1, m: 2, s: 3 })).toBe(3723);
        expect(toSeconds({ h: 0, m: 0, s: 0 })).toBe(0);
        expect(pad(5)).toBe("05");
        expect(formatTime({ h: 1, m: 2, s: 3 })).toBe("1:02:03");
    });
});
