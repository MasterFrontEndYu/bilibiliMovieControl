import { describe, expect, test } from "bun:test";
import { generateUserID, MIN_USER_ID_LENGTH } from "../utils/userId";

describe("generateUserID", () => {
    test("生成长度满足服务端要求且为十六进制", () => {
        const id = generateUserID();

        expect(id).toHaveLength(40);
        expect(id.length).toBeGreaterThanOrEqual(MIN_USER_ID_LENGTH);
        expect(id).toMatch(/^[0-9a-f]+$/);
    });

    test("每次生成不同", () => {
        expect(generateUserID()).not.toBe(generateUserID());
    });
});
