---
"B站连播助手": minor
---

- 统一为「片段」模型：`skip`（OP 跳过）与 `next`（到点下一 P），自动迁移旧的 `opRanges` / `jumpConfig`
- 播放页新增「查看 / 上传」浮动窗口：可拖拽；查看片段、编辑起止与类型、预览 / 定位 / 删除
- 接入 BilibiliSponsorBlock：查询云端片段、上传手动片段，新增 `bsbsb.top` host 权限
- 移除内置帧分析、状态设置页与 `isAutoHandle`、自定义快捷键
- 内容脚本改为原生 DOM 并直接读取 `storage.local`，移除页面内的 SolidJS 依赖
- 图标只保留一套，去掉 active / inactive 切换；Popup 改为片段概览
