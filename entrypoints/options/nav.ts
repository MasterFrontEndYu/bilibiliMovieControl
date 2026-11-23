// options 侧边栏导航项（与路由分离，避免 Layout 依赖 router 实例）
import type { Component } from "solid-js";
import type { LucideProps } from "lucide-solid";
import {
    BadgeAlert,
    Cloud,
    HouseHeart,
    MonitorCog,
    RobotVacuum,
    ScanEye,
} from "lucide-solid";

export interface NavItem {
    path: string;
    title: string;
    icon: Component<LucideProps>;
    index: number;
}

export const NAV_ITEMS: NavItem[] = [
    { path: "/", title: "功能讲解", icon: HouseHeart, index: 1 },
    { path: "/cloud", title: "云端片段", icon: Cloud, index: 2 },
    { path: "/ui", title: "界面显示", icon: MonitorCog, index: 3 },
    { path: "/history", title: "自动存档", icon: RobotVacuum, index: 4 },
    { path: "/manual", title: "手动存档", icon: ScanEye, index: 5 },
    { path: "/about", title: "关于", icon: BadgeAlert, index: 6 },
];
