import { TimePoint } from "@/types/types";

export const toSeconds = (t: TimePoint) =>
    (t.h || 0) * 3600 + (t.m || 0) * 60 + (t.s || 0);

export const pad = (n: number) => n.toString().padStart(2, "0");
export const formatTime = (t: TimePoint) => `${t.h}:${pad(t.m)}:${pad(t.s)}`;
