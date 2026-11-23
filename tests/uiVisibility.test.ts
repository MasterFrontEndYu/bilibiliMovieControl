import { describe, expect, test } from "bun:test";
import {
    DEFAULT_UI,
    hasVisibleRow,
    isUiEmpty,
    normalizeUi,
} from "../utils/uiVisibility";

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

    test("旧版本没有进度条开关时补默认为开启", () => {
        // 模拟只存了六项的老数据
        expect(
            normalizeUi({
                actionView: true,
                actionSubmit: true,
                cloudLink: true,
                statusSkip: true,
                statusNext: true,
                statusCloud: true,
            }),
        ).toEqual({
            ...DEFAULT_UI,
            progressMarkers: true,
            idleMarkers: true,
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

describe("hasVisibleRow", () => {
    test("进度条开关不影响顶部那一行", () => {
        expect(
            hasVisibleRow({
                actionView: false,
                actionSubmit: false,
                cloudLink: false,
                statusSkip: false,
                statusNext: false,
                statusCloud: false,
                progressMarkers: true,
                idleMarkers: true,
            }),
        ).toBe(false);
    });

    test("任意一个行内项可见就算可见", () => {
        expect(
            hasVisibleRow({
                ...DEFAULT_UI,
                actionView: false,
                actionSubmit: false,
                cloudLink: false,
                statusSkip: false,
                statusNext: false,
                statusCloud: true,
            }),
        ).toBe(true);
    });
});

describe("isUiEmpty", () => {
    test("默认不全空", () => {
        expect(isUiEmpty(DEFAULT_UI)).toBe(false);
    });

    test("任意一项可见就不算空", () => {
        expect(
            isUiEmpty({
                ...DEFAULT_UI,
                actionView: false,
                actionSubmit: false,
                cloudLink: false,
                statusSkip: false,
                statusNext: false,
                statusCloud: false,
                progressMarkers: false,
                idleMarkers: true,
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
                progressMarkers: false,
                idleMarkers: false,
            }),
        ).toBe(true);
    });
});
