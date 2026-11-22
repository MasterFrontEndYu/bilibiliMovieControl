#!/usr/bin/env node
/**
 * 检查某个 B 站视频在 BilibiliSponsorBlock 上的片段状态。
 *
 * 这是一个独立的调试脚本，不属于插件功能，也不会被 WXT 打包进扩展。
 *
 * 用法：
 *   node scripts/check-bsbsb-submission.mjs <视频URL或BV号>
 *   node scripts/check-bsbsb-submission.mjs BV1M4sz6sEcu --test
 *   node scripts/check-bsbsb-submission.mjs BV1M4sz6sEcu --uuid <片段UUID>
 *   node scripts/check-bsbsb-submission.mjs BV1M4sz6sEcu --json
 *
 * 参数：
 *   --test      查询测试环境（https://bsbsb.top/test/api），默认正式环境
 *   --uuid ID   额外查询某个片段的详细信息（segmentInfo）
 *   --json      输出原始 JSON，便于排查
 *
 * 只调用 GET 接口，不会提交、修改或删除任何数据。
 */

const PRODUCTION_BASE = "https://bsbsb.top/api";
const TEST_BASE = "https://bsbsb.top/test/api";
const TIMEOUT_MS = 15000;

let input = "";
let uuid = "";
let useTest = false;
let jsonMode = false;

const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--test") {
        useTest = true;
    } else if (arg === "--json") {
        jsonMode = true;
    } else if (arg === "--uuid") {
        uuid = args[index + 1] ?? "";
        index += 1;
    } else if (!input) {
        input = arg;
    }
}

if (!input) {
    console.log(`用法: node scripts/check-bsbsb-submission.mjs <视频URL或BV号> [--test] [--uuid <UUID>] [--json]`);
    process.exit(1);
}

const match = input.match(/BV[0-9A-Za-z]{10}/);
if (!match) {
    console.error(`无法从参数中解析 BV 号: ${input}`);
    process.exit(1);
}

const bvid = match[0];
const base = useTest ? TEST_BASE : PRODUCTION_BASE;

const formatTime = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatRange = (start, end) =>
    `${formatTime(start)} → ${formatTime(end)}`;

const visibility = (segment) => {
    if (segment.hidden === 2) return "自动隐藏";
    if (segment.hidden === 1) return "已隐藏";
    if (segment.shadowHidden === 1) return "暗藏";
    return "可见";
};

const fetchJson = async (url) => {
    const response = await fetch(url, {
        headers: { "x-ext-version": "check-script" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 404) return { status: 404, data: null };
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return { status: response.status, data: await response.json() };
};

/** 兼容扁平数组和 [{ videoID, segments }] 两种返回结构 */
const extractPublicSegments = (payload) => {
    if (!Array.isArray(payload)) return [];

    const segments = [];
    for (const item of payload) {
        if (!item || typeof item !== "object") continue;

        if (Array.isArray(item.segments)) {
            segments.push(...item.segments);
        } else if (Array.isArray(item.segment)) {
            segments.push(item);
        }
    }

    return segments;
};

const publicUrl = `${base}/skipSegments?videoID=${encodeURIComponent(bvid)}`;
const searchUrl = `${base}/searchSegments?videoID=${encodeURIComponent(bvid)}`;

try {
    console.log(`视频: ${bvid}`);
    console.log(`环境: ${useTest ? "测试" : "正式"} (${base})`);
    console.log("");

    const publicResult = await fetchJson(publicUrl);
    const publicSegments = extractPublicSegments(publicResult.data);

    const searchResult = await fetchJson(searchUrl);
    const searchSegments = Array.isArray(searchResult.data?.segments)
        ? searchResult.data.segments
        : [];

    if (jsonMode) {
        console.log("=== skipSegments ===");
        console.log(JSON.stringify(publicResult.data, null, 2));
        console.log("=== searchSegments ===");
        console.log(JSON.stringify(searchResult.data, null, 2));
    } else {
        console.log(`公开片段（skipSegments，能被播放器使用）: ${publicSegments.length}`);
        if (publicResult.status === 404) {
            console.log("  接口返回 404：该视频暂无公开片段");
        } else if (publicSegments.length === 0) {
            console.log("  暂无公开片段");
        } else {
            for (const segment of publicSegments) {
                const start = segment.segment?.[0];
                const end = segment.segment?.[1];
                console.log(
                    `  ${formatRange(start, end)}  ${segment.category ?? "?"}/${segment.actionType ?? "?"}` +
                        `  votes=${segment.votes ?? "?"}  UUID=${segment.UUID ?? "?"}`,
                );
            }
        }

        console.log("");
        console.log(`检索结果（searchSegments，含隐藏/待审核）: ${searchSegments.length}`);
        if (searchResult.status === 404) {
            console.log("  接口返回 404：未检索到片段");
        } else if (searchSegments.length === 0) {
            console.log("  未检索到片段");
        } else {
            for (const segment of searchSegments) {
                console.log(
                    `  ${formatRange(segment.startTime, segment.endTime)}  ${segment.category ?? "?"}/${segment.actionType ?? "?"}` +
                        `  状态=${visibility(segment)}  votes=${segment.votes ?? "?"}` +
                        `  views=${segment.views ?? "?"}  UUID=${segment.UUID ?? "?"}`,
                );
            }
        }
    }

    if (uuid) {
        const infoUrl = `${base}/segmentInfo?UUID=${encodeURIComponent(uuid)}`;
        const infoResult = await fetchJson(infoUrl);

        console.log("");
        console.log(`片段详情（segmentInfo）: ${uuid}`);
        if (jsonMode) {
            console.log(JSON.stringify(infoResult.data, null, 2));
        } else if (!infoResult.data) {
            console.log("  未找到该片段");
        } else {
            const info = Array.isArray(infoResult.data)
                ? infoResult.data[0]
                : infoResult.data;
            if (!info) {
                console.log("  未找到该片段");
            } else {
                console.log(
                    `  ${formatRange(info.startTime, info.endTime)}  ${info.category ?? "?"}/${info.actionType ?? "?"}`,
                );
                console.log(
                    `  状态=${visibility(info)}  votes=${info.votes ?? "?"}  views=${info.views ?? "?"}  locked=${info.locked ?? "?"}`,
                );
                console.log(
                    `  提交者=${info.userID ?? "?"}  提交时间=${info.timeSubmitted ? new Date(info.timeSubmitted * 1000).toLocaleString() : "?"}`,
                );
            }
        }
    }

    console.log("");
    console.log("说明：");
    console.log("  - 公开片段（skipSegments）能直接出现在播放器的跳转逻辑里");
    console.log("  - 刚提交的片段可能只出现在 searchSegments 里，状态为隐藏/暗藏时通常还在审核");
    console.log("  - 两个接口都没有，可能是提交失败、未入库，或查询了错误的环境（--test）");
} catch (error) {
    console.error(`查询失败: ${error?.message ?? error}`);
    process.exitCode = 1;
}
