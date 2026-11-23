export { formatSeconds } from "@/utils/format";

/** 支持 "90" / "01:30" / "00:01:30" */
export function parseTimeText(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return Number.NaN;

    const parts = trimmed.split(":").map((part) => Number(part.trim()));
    if (parts.some((part) => !Number.isFinite(part))) return Number.NaN;

    if (parts.length === 3) {
        const [h = 0, m = 0, s = 0] = parts;
        return h * 3600 + m * 60 + s;
    }
    if (parts.length === 2) {
        const [m = 0, s = 0] = parts;
        return m * 60 + s;
    }
    if (parts.length === 1) return parts[0] ?? Number.NaN;

    return Number.NaN;
}
