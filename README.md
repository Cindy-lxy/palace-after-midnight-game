# 宫墙夜未央

一款《魔女之家》《杀戮天使》风格的**中式皇宫像素逃脱 / 悬疑解谜**网页小游戏。深夜宫闱，你扮演灯匠徒弟沈青，被提前落下的宫门锁在其中；点亮琉璃灯、在六间宫室间穿梭、躲避怨灵追逐、搜集三年前「映霜阁掌灯人苏婉」旧案的证据，最终完成复核、替她沉冤昭雪并出宫。

- 纯静态：**HTML + CSS + 原生 JavaScript，无后端、无构建、无外部网络依赖**。
- BGM 为 Web Audio API 程序化生成的中式恐怖悬疑配乐（无外部音频文件）。
- 支持键盘（方向键 / WASD 移动，E 或空格互动）、屏幕方向键、点击热点行走；桌面与手机自适应。
- 本地存档 `localStorage` 键 `palace:escape:v3`，音乐偏好键 `palace:audio:v1`。

## 目录结构

```
index.html            页面骨架（封面、游戏画框、调查弹层、暂停/音乐按钮）
style-cn.css          全部样式（像素画面、桌面撑满布局、移动端、追逐路线）
story.js              剧情/文案/房间/热点/线索数据
game-allmaps.js       游戏引擎（移动、交互、追逐、推理、结局、存档）
audio.js              Web Audio 程序化中式悬疑 BGM
embedded-maps-v2.js  六张内嵌场景地图，减少弱网与跨地域静态资源失败
assets/               主角四方向、怨灵等优化后的 WebP 像素素材
tests/                Playwright 回归测试（见下）
```

## 本地运行

无需构建，任选一种静态服务器在本目录启动：

```bash
# 方式一（已内置 npm script）
npm run serve

# 方式二（直接用 Python）
python3 -m http.server 8765 --bind 127.0.0.1 --directory .
```

浏览器打开 <http://127.0.0.1:8765> 即可游玩。
（用 `file://` 直接双击打开也能运行，但建议走本地服务器以获得与线上一致的行为。）

## 玩法说明

- **移动**：方向键 / WASD，或按住屏幕方向键，或直接点击画面上的目标点自动行走。
- **互动 / 调查**：靠近发光热点后按 `E` 或空格（或点击热点）。
- **目标**：跟随右侧目标栏推进——点灯、取物、解谜；触发追逐时按绿色路线逃到藏身点（衣柜 / 屏风 / 掩体）。
- **线索簿**：右上角灯泡按钮可查看提示；线索面板的关闭 `×` 固定常驻。
- **结局**：集齐证据并完成复核后带着复核说明出宫，依选择走向不同结局（沉冤昭雪 / 同行 / 独行）。
- **音乐**：右上角 `♪ 音乐 / ♪ 静音` 可随时切换，切换标签页时自动暂停。

## 跑回归测试

测试基于 Playwright，默认驱动系统 Chrome（`/opt/google/chrome/chrome`），并假设游戏已在 **127.0.0.1:8765** 提供服务。

```bash
npm install            # 安装 playwright（首次）
npx playwright install-deps chromium   # 如环境没有可用浏览器可改用自带 chromium
npm run serve          # 另开一个终端启动服务
node tests/full-regression.cjs
```

若没有系统 Chrome，可把各 `tests/*.cjs` 里的
`chromium.launch({executablePath:'/opt/google/chrome/chrome', ...})`
改为 `chromium.launch({headless:true,args:['--no-sandbox']})` 使用 Playwright 自带 chromium。

测试清单（`tests/`）：

| 文件 | 覆盖内容 |
| --- | --- |
| `full-regression.cjs` | 跨房间、目标栏、证据、存档重读的全流程回归 |
| `dup-description.cjs` | 暗门/相邻房间调查说明不重复 |
| `departure-objective.cjs` | 复核完成后目标正确变为「出宫」 |
| `prologue.cjs` | 开场背景介绍 / 楔子、关闭 X 固定 |
| `bgm.cjs` | 程序化 BGM 起停、追逐紧张层、静音持久化 |
| `pc-layout.cjs` | PC 端画面撑满、文字信息下移、点击行走 |
| `mobile.cjs` | 移动端追逐路线、藏身点、无横向溢出 |
| `clue-x-fixed.cjs` | 线索/长内容弹层关闭 X 常驻 |

截图产物输出到 `tests/shots/`。

## 部署（可选）

本工程为纯静态目录，可直接部署到任意静态托管。仓库中的 `web-application.json` 记录了它当前已发布页面的 id（CN region）；使用内部 web 发布工具时以相同 id 覆盖发布即可保留同一访问地址，存档存于玩家浏览器本地，不受重新部署影响。
