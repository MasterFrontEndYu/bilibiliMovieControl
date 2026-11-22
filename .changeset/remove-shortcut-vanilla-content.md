---
"B站连播助手": minor
---

移除自定义快捷键功能（内容脚本 keydown 监听、快捷键设置页与 `shortcut` 配置）；内容脚本改为原生 DOM + 直接读取 `storage.local`，不再依赖 SolidJS，悬浮条实现移到 `utils/videoUI.ts`。
