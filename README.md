# Brent 原油技术分析看板

Oil Technical Dashboard 是一个可部署到 GitHub Pages 的 Brent 原油技术分析看板。第一版只展示 Brent，不展示 WTI，也不展示 Brent-WTI 价差。

页面用于帮助技术分析新手理解趋势评分、均线、RSI、MACD、布林带、ATR、支撑阻力和趋势通道。项目仅用于研究和信息展示，不构成投资建议。

## 功能

- 每日自动更新 Brent 原油价格
- 展示 Brent 最新价格、综合信号和 trend_score
- 展示综合信号的五项评分来源
- 展示关键支撑位 S1/S2/S3 和阻力位 R1/R2/R3
- Brent 价格图默认只显示价格、支撑位、阻力位
- 图表开关可选显示 MA20、MA60、MA120、布林带、60日趋势通道
- 页面底部显示更新时间、数据来源、数据状态和免责声明

## 本地运行

正确本地预览方式：

1. 更新数据：

```bash
python scripts/update_data.py
```

2. 开发模式：

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:5173/
```

3. 正式构建预览：

```bash
npm run build
npm run preview
```

打开终端提示的地址，通常是：

```text
http://localhost:4173/
```

不要直接双击 `index.html` 或旧的 `preview.html` 预览。本项目的前端需要通过本地服务器读取 `public/data/*.json`，使用 `file://` 打开 HTML 容易导致数据读取失败。

安装或更新 Python 依赖：

```bash
pip install -r requirements.txt
```

如果本机同时安装了多个 Python，建议使用当前可用的 Python 解释器显式运行数据脚本，例如：

```powershell
py scripts/update_data.py
```

检查是否接入真实数据：

```bash
cat public/data/metadata.json
```

确认 `data_status` 是否为 `real`。如果是 `real`，说明当前 JSON 来自真实行情源；如果不是 `real`，请查看 `errors` 字段。

## 数据源

优先数据源：

- yfinance `BZ=F`
- 用途：Brent futures 的 open/high/low/close
- 成功时图表显示 K 线，ATR14 正常计算

备用数据源：

- FRED/EIA `DCOILBRENTEU`
- 用途：Brent spot close
- 成功时图表显示收盘价折线，open/high/low 为 null，ATR14 为空

重要规则：

- 不混合 yfinance 的 open/high/low 和 FRED 的 close
- yfinance 成功时整套 OHLC 都来自 yfinance
- yfinance 失败且 FRED 成功时，只使用 FRED close

当前版本不接入新浪 OIL。未来如果 yfinance 和 FRED 都不稳定，可以考虑增加 Sina Finance OIL 作为第三备用源，但需要注意：新浪 OIL 可能是新浪外盘或 CFD 行情口径，不一定等同于 ICE Brent 主力连续期货；新浪网页或接口稳定性也不如正式 API，因此不作为第一版主数据源。

## FRED_API_KEY

本地 PowerShell：

```powershell
$env:FRED_API_KEY="你的_FRED_API_KEY"
python scripts/update_data.py
```

Linux/macOS：

```bash
export FRED_API_KEY=你的_FRED_API_KEY
python scripts/update_data.py
```

GitHub Actions 中配置：

1. 打开仓库 `Settings`
2. 进入 `Secrets and variables` -> `Actions`
3. 新增 repository secret
4. 名称填写 `FRED_API_KEY`
5. 值填写你的 FRED API Key

没有 `FRED_API_KEY` 时，脚本不会直接崩溃，会先尝试 yfinance；如果 yfinance 也失败，会尽量保留上一版 `public/data/brent.json`。

## 数据失败时的 fallback

如果 yfinance 和 FRED 都失败：

- 优先保留上一版 `public/data/brent.json`
- 不生成伪装成真实行情的随机油价
- `metadata.json` 会写出 `data_status`
- 前端会明显提示当前不是实时真实行情，或暂无真实行情数据

数据状态示例：

- `real`：真实行情数据
- `fallback_previous_static`：沿用上一版静态数据
- `fallback_or_sample`：沿用的旧数据可能是示例或 fallback 数据
- `no_real_data`：暂无真实行情数据

## 为什么剔除当天未完成日线？

本看板用于日度收盘技术分析，不用于盘中实时交易。yfinance 等数据源可能在交易日当天返回正在形成中的日线数据。如果直接使用这根未完成日线，RSI、MACD、布林带、支撑阻力和综合信号会在盘中变化，容易造成误读。因此项目默认只使用 `date < 当前 UTC 日期` 的完整日线数据。

页面显示的“数据日期”是实际用于技术指标计算的最后完整交易日，“更新时间”是脚本最近一次运行并生成 JSON 的时间。`metadata.json` 中会记录 `last_raw_data_date`、`latest_data_date`、`dropped_incomplete_latest_bar` 和 `dropped_rows`，用于确认是否剔除了未完成日线。

如果在交易日盘中手动运行 `update_data.py`，脚本会删除当天未完成日线，因此 `latest_data_date` 可能停留在上一个完整交易日。等到下一交易日或 GitHub Actions 定时运行后，数据会更新到最新完整交易日。

## 输出文件

`scripts/update_data.py` 只生成并维护：

- `public/data/brent.json`
- `public/data/signals.json`
- `public/data/metadata.json`

旧版 `wti.json` 和 `spread.json` 会被删除，不再被前端依赖。

## GitHub Actions

`.github/workflows/update-and-deploy.yml` 支持：

- `workflow_dispatch` 手动触发
- 每日自动更新：北京时间 14:20、14:50、15:20、15:50，对应 UTC 06:20、06:50、07:20、07:50。GitHub Actions 的 cron 使用 UTC 时间
- 安装 Python 依赖
- 运行 `python scripts/update_data.py`
- 安装 Node 依赖
- 执行 `npm run build`
- 部署到 GitHub Pages
- 从 GitHub Secrets 读取 `FRED_API_KEY`
- 尽量恢复上一版 `public/data`，避免数据源失败导致页面空白

## GitHub Pages 部署

1. 将项目推送到 GitHub 仓库。
2. 在仓库 `Settings` -> `Pages` 中选择 `GitHub Actions`。
3. 手动触发 `Update data and deploy` workflow。

`vite.config.ts` 会在 GitHub Actions 中根据 `GITHUB_REPOSITORY` 自动设置 `base: '/仓库名/'`，适配：

```text
https://用户名.github.io/仓库名/
```

如果你改成自定义域名或特殊部署路径，请同步检查 `vite.config.ts` 的 `base` 配置。

## 免责声明

本页面仅用于研究和信息展示，不构成投资建议。技术指标基于历史价格计算，不保证未来走势。
