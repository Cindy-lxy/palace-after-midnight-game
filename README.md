# 宫墙夜未央 · 中英双语部署版

《宫墙夜未央》纯静态网页游戏，已部署到 GitHub Pages，并保留原网址。

## 当前版本

- 支持中文 / English 即时切换，语言偏好保存在浏览器本地。
- 六张场景地图全部以内嵌 WebP 形式加载，避免单独地图请求失败。
- 角色与灵影素材使用轻量 WebP。
- 支持 PC、手机竖屏、手机横屏和安全区适配。
- 背景音乐由 Web Audio API 程序化生成，不依赖外部音频文件。

## 主要文件

- `index.html`：页面入口。
- `style-bi-v1.css`：双语及多端样式。
- `story-bi-v1.js`：中文剧情与房间数据。
- `locales-bi-v1.js`：英文翻译字典。
- `i18n-bi-v1.js`：语言切换逻辑。
- `audio-bi-v1.js`：程序化背景音乐。
- `game-bi-v1.js`：游戏交互逻辑。
- `embedded-maps-v2.js`：六张内嵌地图资源。
- `assets/`：轻量角色与灵影 WebP。
