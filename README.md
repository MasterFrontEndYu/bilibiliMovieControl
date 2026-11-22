# BilibiliMovieControl（B 站连播助手）

> 面向 B 站**用户上传合集**的连播辅助插件：在播放页管理「OP 跳过 / 下一 P」片段，自动连播，并可将片段上传到 BilibiliSponsorBlock。

![Version](https://img.shields.io/github/package-json/v/sanguogege/BilibiliMovieControl)
![Manifest](https://img.shields.io/badge/Manifest_V3-✓-green)
![Tech](https://img.shields.io/badge/WXT%20%2B%20SolidJS-fb7299)

---

## ✨ 功能

- **OP 跳过**：播放进入片段区间时，自动跳到区间终点
- **下一 P**：播放到达片段起点时，自动点击「下一 P」
- **片段管理**：播放页的「查看」展示手动片段与云端片段；「上传」里编辑起止位置与类型，支持预览、定位、删除
- **云端片段**：查询 BilibiliSponsorBlock 的片段，带 `BiliSB` 标识
- **上传**：把手动片段提交到 bsbsb.top
- **存档**：自动记录最近播放，也支持手动存档（各 20 条）

## 🎯 适用范围

仅对**带选集列表**（`.video-pod`）的合集视频生效；电影、番剧、普通单视频不处理。

## 🚀 使用

1. 打开合集视频，标题下方出现状态条与「查看 / 上传」按钮
2. **查看**：浏览手动片段和云端片段
3. **上传**：
   - 编辑片段：填写起止时间、选择类型（OP跳过 / 下一P）
   - 按钮：删除、预览、开头、结尾、编辑/保存
   - 已保存片段：点击载入编辑，或「＋ 新建片段」以当前进度为起点
   - 私人 ID：首次自动生成并保存在本地，也可替换
4. 播放时按片段自动跳过或切集

## 🖥️ 界面

- **播放页**：悬浮状态条 + 可拖拽的「查看 / 上传」窗口
- **Popup**：片段概览、最近播放、手动存档、进入设置页
- **Options**：功能讲解 / 自动存档 / 手动存档 / 关于

## 💾 存储

| 键名 | 说明 |
| --- | --- |
| `segments` | 片段列表（`skip` / `next`） |
| `latestHistory` | 自动存档，最多 20 条 |
| `pinnedHistory` | 手动存档，最多 20 条 |
| `sbUserID` | 上传用的私人 ID |

## 🛠️ 技术

| 类别 | 选型 |
| --- | --- |
| 扩展框架 | [WXT](https://wxt.dev)（MV3） |
| UI | Popup / Options 使用 [SolidJS](https://www.solidjs.com)；内容脚本为原生 DOM |
| 样式 | TailwindCSS 4 + [DaisyUI](https://daisyui.com) |
| 接口 | [BilibiliSponsorBlock API](https://github.com/hanydd/BilibiliSponsorBlock/wiki/API) |
| 构建 | Vite + Bun |

API 环境：

- 正式：`https://bsbsb.top/api/skipSegments`
- 测试：`https://bsbsb.top/test/api/skipSegments`

默认使用正式环境；需要查询测试环境时，启动前设置 `VITE_SB_API=test`。测试环境只支持查询，不支持上传。

## 📎 第三方引用与许可证

云端片段的查询与上传基于 [BilibiliSponsorBlock](https://github.com/hanydd/BilibiliSponsorBlock) 的公开 HTTP API：

- 项目地址：<https://github.com/hanydd/BilibiliSponsorBlock>
- API 文档：<https://github.com/hanydd/BilibiliSponsorBlock/wiki/API>
- 服务地址：<https://bsbsb.top>

需要注意：BilibiliSponsorBlock 整体采用 **GPL-3.0** 许可证（[许可证原文](https://www.gnu.org/licenses/gpl-3.0.html)）。

- 本项目没有复制或修改其源代码，只在运行时调用其 API；片段数据由该项目社区提交
- 如果你的分发版本包含该项目的数据或衍生代码，可能同样需要以 **GPL-3.0 兼容的开源许可证**发布
- 如果计划闭源或用于商业产品，请先确认 GPL-3.0 的“传染性”是否会构成限制

以上仅为项目引用与许可证信息说明，不构成法律意见。

## 💻 开发

```bash
bun install      # 安装依赖
bun dev          # 开发模式（Chrome）
bun build        # 构建生产包
bun compile      # 类型检查
bun zip          # 生成发布包
```

## 📄 说明

- 本项目仅供学习与交流使用，请勿用于任何商业用途
- 仓库地址：<https://github.com/sanguogege/BilibiliMovieControl>
