# 网球课报名工具 — 项目规则

## 项目概述
一个固定链接的网球课报名工具（Vue 3 + Vite 前端 + Node.js/Express 后端 + SQLite），可通过手机微信点击报名。

## 启动方式
```bash
# 安装依赖（沙箱重启后 node_modules 会丢失，必须重装）
pnpm install
# 启动开发/生产服务
cd /workspace && npx tsx api/server.ts
```
服务运行在 http://localhost:3001/

## 预览须知
服务启动后，IDE 预览面板可能不会自动连接。需要用 `OpenPreview` 工具显式绑定 URL `http://localhost:3001/`，用户才能在 IDE 中看到页面。仅启动服务器是不够的，必须调用预览工具挂载链接。如果预览面板空白，先检查服务器进程是否存活（`lsof -i :3001`），确认运行后使用 OpenPreview 工具。

## 架构
- 前端：Vue 3 + Vite + Tailwind CSS + Vue Router
- 后端：Express + better-sqlite3
- 数据库：SQLite（文件存储于 /workspace/data/registrations.db）
- 部署：Railway（前后端一体部署）

## 路由
| 路径 | 说明 |
|------|------|
| `/` | 报名页面（核心） |
| `/success` | 报名成功页面 |
| `/admin` | 管理后台 |

## 数据库表
- `registrations`：报名记录（name, phone, class_day, class_date, source, week_key, created_at）
- `members`：成员名单（name UNIQUE, source：CNCC/CFID/SQQ）
- `settings`：键值配置（force_open, max_tuesday, max_wednesday, multi_day_enabled）

## 核心业务规则
- 同一人同一周同一天不可重复报名（但 multi_day_enabled 开启时可同时报周二+周三）
- 每天有独立上限，默认 10 人，可在后台修改
- 报名需在成员列表中（来源从成员记录自动获取，用户不选择）
- 非成员提示"您不是网球小组成员，请联系网球小组组长"
- 临时开放报名：后台开关，绕过"每周一9:00"时间限制
- 管理员口令：tEnis2026%（SHA256 加密存储，环境变量 EXPORT_PASSWORD_HASH 可覆盖）
- member_check API 返回已报名天数列表（existingRegistrations）

## API 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/status | 状态（含 maxTuesday/maxWednesday/multiDayEnabled/forceOpen） |
| GET | /api/check-member?name= | 成员校验 |
| POST | /api/register | 报名（支持 classDay 字符串或 classDays 数组） |
| GET | /api/registrations?week= | 按周查报名列表 |
| POST | /api/reschedule | 调课（需口令） |
| GET/POST | /api/settings | 系统设置 |
| GET | /api/members | 成员列表 |
| POST | /api/members/import | 导入成员（需口令） |
| POST | /api/members/delete | 删除成员（需口令） |
| GET | /api/members/export-template | 下载导入模板 |
| GET | /api/members/export | 导出成员 |
| POST | /api/export-all | 全量导出CSV（需口令） |
| GET | /api/export?week= | 按周导出 |
| POST | /api/auth-admin | 管理员认证 |

## 编码注意事项
- CSV 导出/模板均带 BOM（\uFEFF），确保 Excel 识别 UTF-8 中文
- CSV 导入需自动检测 GBK 编码（中国 Excel 默认编码）
- 导入时处理 CRLF 换行符、BOM 头、大小写容错

## 开发习惯
- 所有日期格式使用 YYYY/M/D
- 周次显示格式："2026年第22周（2026/5/25-2026/5/31）"
- 使用 Tailwind CSS，颜色主色调 #2D8A4E
- 后台管理不要用 alert()，使用页面内 notification 提示
- settings POST 接口不需要口令验证（已在后台登录状态）

## 测试要求
每次修改代码后必须自行验证以下内容，确认无误再告知用户：
1. 首页 `/` 是否正常打开（curl 200）
2. 管理页 `/admin` 是否正常打开（curl 200）
3. API `/api/status` 是否正常返回
4. 使用 `OpenPreview` 工具将预览挂载到 `http://localhost:3001/`
5. 如需重启服务：先 `kill -9 $(lsof -ti :3001)` 再重新启动

## 预览连接问题（no healthy upstream / upstream request timeout）
- 沙箱环境的服务进程可能被系统回收，导致端口 3001 停止响应
- IDE 预览代理（16000 端口）连不上后端时，报「no healthy upstream」或「upstream request timeout」
- 此时先确认 3001 端口是否存活：`lsof -i :3001`
- 如果 3001 离线则重启：`pnpm install && npx tsx api/server.ts`
- 重启后用直连端口 3001 挂载预览：`OpenPreview` → `http://localhost:3001/`
- 不要用代理端口 16000 挂载预览，直连 3001 更稳定
- 不要误杀 agent-too 进程（IDE 代理），杀了会导致代理重建后 400 Bad Request

## 前后端修改注意事项
- 修改前端源码（`/workspace/src/` 下的 .vue 文件）后，必须运行 `pnpm build` 重建 `/workspace/dist/`，修改才会生效
- 修改后端代码（`/workspace/api/` 下的 .ts 文件）后，只需重启服务即可
- 测试验证时必须前后端都考虑到：前端看页面表现，后端 curl API 接口

## API 开发规范（避免代理兼容问题）
- 沙箱环境的 IDE 代理（16000 端口）不兼容中文 URL 编码的查询参数，中文名 GET 请求会返回 400
- **所有涉及中文参数的 API，必须用 POST + JSON body 传参，禁止用 GET 查询参数传中文**
- 这条规则适用于新增 API 和修改现有 API

## 后台管理密码持久化（踩坑经验）
- 用户登入后仅重建 `authenticated` 状态到 `sessionStorage`（`AUTH_KEY = '1'`）是不够的
- `adminPassword` 也必须保存到 `sessionStorage`（key: `tennis_admin_pwd`），否则页面刷新后所有需口令的操作（成员编辑/删除、清空报名、导出全部、调课）会因密码为空而返回"口令错误"
- 页面挂载时恢复逻辑：`sessionStorage.getItem(AUTH_KEY) === '1'` → 同时恢复 `adminPassword` 和 `authenticated`
- 如果用户是旧 session（只有 AUTH_KEY 没有密码），用自定义密码弹窗（`requestPassword()`）提示用户重新输入

## 禁止使用 prompt() / alert() / confirm()
- 沙箱预览环境（trae-preview）**不支持 `prompt()`**，调用会抛 `Error: prompt() is not supported.`
- `confirm()` 和 `alert()` 在预览环境中也可能有兼容问题
- 所有需要用户输入确认的场景，必须使用自定义 Vue 模态框替代
- 后台已封装 `requestPassword(title?)` → Promise 模式密码弹窗，可直接 `await` 使用
- 后台已有 `showNotification(msg, type)` 替代 `alert()`

## 前端修改后浏览器缓存
- `pnpm build` 后 Vite 输出的 JS/CSS 文件 hash 会变化，但用户浏览器可能缓存了旧文件
- `prompt is not supported`、`成员编辑显示口令错误` 等异常，首先检查用户是否未硬刷新
- 告知用户按 **Ctrl+F5**（Mac: Cmd+Shift+R）强制刷新清除缓存
- 服务器响应头可加 Cache-Control 加速更新（已在 `api/app.ts` 配置）