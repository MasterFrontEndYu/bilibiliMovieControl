---
"B站连播助手": minor
---

- 统一为「片段」模型：`skip`（OP 跳过）与 `next`（到点下一 P），自动迁移旧的 `opRanges` / `jumpConfig`
- 播放页新增「查看 / 上传」浮动窗口：可拖拽；查看片段、编辑起止与类型、预览 / 定位 / 删除
- 接入 BilibiliSponsorBlock：查询云端片段、上传手动片段，新增 `bsbsb.top` host 权限
- 云端片段可开关是否参与播放：设置页「云端片段」提供 aura 开关，默认开启；intro / sponsor 作为跳过、outro 作为下一 P，手动片段优先
- 移除内置帧分析、状态设置页与 `isAutoHandle`、自定义快捷键
- 移除 Popup 的多 OP 编辑页，片段统一在播放页「设置」里编辑
- API 区分正式 / 测试环境：默认正式环境，可用 `VITE_SB_API=test` 切到测试环境（测试环境只支持查询，不支持上传）
- 内容脚本改为原生 DOM 并直接读取 `storage.local`，移除页面内的 SolidJS 依赖
- 图标只保留一套，去掉 active / inactive 切换；Popup 改为片段概览
