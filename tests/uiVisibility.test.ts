import { describe, expect, test } from "bun:test";
import { DEFAULT_UI, isUiEmpty, normalizeUi } from "../utils/uiVisibility";

describe("normalizeUi", () => {
    test("缺失 / 非法输入回落到全显示", () => {
        expect(normalizeUi(undefined)).toEqual(DEFAULT_UI);
        expect(normalizeUi(null)).toEqual(DEFAULT_UI);
        expect(normalizeUi("bad")).toEqual(DEFAULT_UI);
        expect(normalizeUi({})).toEqual(DEFAULT_UI);
    });

    test("部分字段生效，缺的字段补默认值", () => {
        expect(normalizeUi({ actionView: false, statusCloud: false })).toEqual({
            ...DEFAULT_UI,
            actionView: false,
            statusCloud: false,
        });
    });

    test("非布尔值被忽略（防止 storage 脏数据）", () => {
        expect(
            normalizeUi({
                actionView: "false",
                statusSkip: 0,
                cloudLink: false,
            }),
        ).toEqual({ ...DEFAULT_UI, cloudLink: false });
    });
});

describe("isUiEmpty", () => {
    test("默认不全空", () => {
        expect(isUiEmpty(DEFAULT_UI)).toBe(false);
    });

    test("任意一项可见就不算空", () => {
        expect(
            isUiEmpty({
                actionView: false,
                actionSubmit: false,
                cloudLink: false,
                statusSkip: false,
                statusNext: false,
                statusCloud: true,
            }),
        ).toBe(false);
    });

    test("全部关闭才算空", () => {
        expect(
            isUiEmpty({
                actionView: false,
                actionSubmit: false,
                cloudLink: false,
                statusSkip: false,
                statusNext: false,
                statusCloud: false,
            }),
        ).toBe(true);
    });
});
