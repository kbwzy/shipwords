# AI Pose Gallery: 生成与积分套餐设计 v1

> 历史方案，已被产品方向调整取代：本文描述六格人台生成，不是当前的人物照片换姿 MVP，旧价格、积分、模型和发布门均不得据此对外承诺或启用。当前验证方案见 `POSE-EDIT-VALIDATION.md`。

状态：产品设计稿。当前生产站仍是免费静态图库：`site.models.ts` 和 `products` 为空。Waffo 店铺、测试密钥及 webhook 已配置，但付费功能和生成器尚未开放。2026-10-29 使用 Yir 直接生成了一张测试图，结算 $0.02；详情见 `research/yir-2026-10-29/README.md`。这不是站内生成或支付链路验收。

目标：在不破坏现有免费图库 SEO 的前提下，增加一条可收费的姿势参考图生成链路，并把单位成本、支付、退款和滥用风险控制在可验证范围内。

## 1. 产品定义

一句话：**Describe a pose. Get a six-panel studio pose sheet you can draw from.**

卖点不是"又一个 AI 生图"，而是：

- 一次生成一张 6 格姿势表，而不是一张单图；对画师更接近可直接使用的参考素材。
- 统一的中性人台、棚拍光线和全身构图，方便比较动作，不混入无关风格。
- 每张图附内部 prompt，可复制、可改、可二次生成。
- 与免费图库共用分类和搜索，图库负责 SEO，生成器负责转化。

不做：

- 不做通用文生图、换脸、真人肖像、成人内容。
- 不做"无限生成"、不做"版权买断"这类无法兑现的承诺。
- 首发不做订阅，只做一次性积分包，降低账单和退款复杂度。

## 2. 用户流程

1. 用户从 Google 搜索进入 `/` 或某张姿势详情页。
2. 点 `Generate a sheet like this`，进入 `/pose-generator`，brief 自动预填。
3. 未登录：先出 1 次游客试用（可选，见第 4 节）；继续生成时打开登录（Google 或邮箱验证码）。
4. 新账号送 1 credit；余额不足时打开价格弹窗。
5. 购买积分包，Waffo Checkout 完成后回到生成器，余额到账。
6. 生成完成：下载 PNG、复制 prompt、生成变体（再扣 1 credit）。
7. 失败或取消：自动退回 credit；主观不满意不退款，但首单可按退款政策处理。

关键原则：**先让用户看到图，再要求付款。** 生成按钮永远先检查登录和余额，未满足时不清空已填的 brief。

## 3. 生成器规格

### 输入

| 控件 | 选项 | 默认 |
|---|---|---|
| Pose brief | 自由文本，最多 200 字符 | 空，必填 |
| 预设 | standing / sitting / action / dance / hands & gesture / group | 无 |
| 视角 | front / three-quarter / side / back / mixed | mixed |
| 构图 | full body / upper body | full body |
| 画幅 | 1:1 / 3:2 / 2:3 | 1:1 |
| 参考图 | 可选 1 张（姿势草图或照片） | 无 |

固定参数：6 个互不重复的姿势，等分网格，中性灰无缝背景，柔和均匀棚光，无文字、无水印、无道具。

参考图只用于"匹配姿势"，不复制人脸、服装或风格。上传前要求用户确认拥有使用权；游客不能上传参考图。

### 输出

- 1 张 1024×1024（或所选画幅）PNG，6 格姿势表。
- 结果页展示：大图、所用 brief、复制 prompt、下载 PNG、生成变体。
- 不提供自动抠图、分格导出、放大；这些是后续付费点，不在首发范围。

### 内部 prompt 模板

```text
Create a clean studio pose reference sheet with {count} distinct poses of a neutral,
non-photorealistic artist's mannequin wearing a plain gray form-fitting suit.
Arrange them in a {cols}x{rows} grid with equal cells, generous margins and no overlap.
Pose theme: {brief}.
All figures: {view} view, {framing}, anatomically correct, hands and feet fully visible,
simple seamless neutral gray background, soft even studio light.
Each pose must be clearly different. No props, no text, no watermark, no logos,
no facial likeness, no celebrity resemblance.
```

负面约束（由服务端拼接，用户不可关闭）：`nudity, lingerie, minors, real-person likeness, celebrity, sexual pose, violence, gore, logos, text, watermark`。

### 模型

首发只开一个模型，避免未验证的模型 ID 和双倍 QA 成本：

| 字段 | 值 |
|---|---|
| id | `pose-sheet` |
| upstream | `yir` |
| upstreamModel | `google/nano-banana-pro` |
| kind | `image` |
| credits | 1 |
| maxReferences | 1 |
| allowedParameters | `aspect_ratio` |
| maxCost | `0.30` USD |
| timeoutMinutes | 10 |

`maxCost` 是硬上限，不是预期成本。上线前用真实 key 跑 10 次，记录每次实际计费；如果中位成本 > $0.22，先调价或换更便宜的模型，不直接上线。

## 4. 积分与价格

1 credit = 1 张 6 格姿势表。首发不做按模型倍率、不做按张数计价。

| Product id | 名称 | 价格 | Credits | 单价 |
|---|---|---:|---:|---:|
| `pack_5` | Starter | $4.99 | 5 | $1.00 / sheet |
| `pack_15` | Studio | $11.99 | 15 | $0.80 / sheet |
| `pack_40` | Pro | $28.99 | 40 | $0.72 / sheet |

规则：

- 积分包不过期（`expiresDays: null`）。
- 新账号赠送 1 credit，14 天过期，每 IP 每天最多 2 个赠送账号。
- 游客每天 1 次、每 IP 每天 1 次，全站每日最多 20 次；触发上限即关闭游客生成，只保留图库浏览。
- 首发无订阅、无自动续费、无优惠码。
- 失败、取消、上游超时、内容审核拒绝：自动退回 credit。
- 未使用积分可在购买后 14 天内申请退款；已消耗积分不退。支付争议按模板逻辑扣回对应积分。

## 5. 单位经济模型

Waffo 是登记商户（MoR），实际费率、税费承担和结算币种必须以商店后台显示的 rate card 为准。下表暂按 **5% + $0.30** 做保守预算，仅用于判断价格是否有空间；提交审核前必须用真实费率替换，不能把假设写进对外定价。

| 套餐 | 实收 | 手续费 | 净收入 | 每张净收入 |
|---|---:|---:|---:|---:|
| Starter $4.99 | $4.99 | $0.52 | $4.47 | $0.894 |
| Studio $11.99 | $11.99 | $0.83 | $11.16 | $0.744 |
| Pro $28.99 | $28.99 | $1.58 | $27.41 | $0.685 |

毛利率（扣除上游成本，未计 Cloudflare、税和退款）：

| 上游成本/张 | Starter | Studio | Pro |
|---:|---:|---:|---:|
| $0.15 | 83.2% | 79.8% | 78.1% |
| $0.20 | 77.6% | 73.1% | 70.8% |
| $0.25 | 72.0% | 66.4% | 63.5% |
| $0.30 | 66.4% | 59.7% | 56.2% |

上线门槛：

- 10 次真实生成中至少 8 张可直接使用（6 格完整、姿势不重复、手脚不裁切）。
- 中位上游成本 ≤ $0.22，p95 延迟 ≤ 4 分钟。
- 最大套餐毛利率 ≥ 55%；达不到就提价或换便宜模型。
- 游客成本上限 $6/天（20 次 × $0.30）。

## 6. 支付与账户

首发选 **Waffo Pancake MoR**，只做一次性积分包。Stripe 和 PayPal 不在此站同时开启。

Waffo 接入约定：

- `billing.provider: 'waffo'`。
- 每个商品必须有真实 `refs.waffo`，格式为 `PROD_...`；不能把本地 `pack_5` 当作 Waffo 商品 ID。
- 环境变量：`WAFFO_MERCHANT_ID`、`WAFFO_PRIVATE_KEY`、`WAFFO_ENVIRONMENT=test|prod`、`WAFFO_STORE_ID`。
- Webhook：`https://aiposegallery.com/api/webhooks/waffo`。
- 订阅事件：`order.completed`、`refund.succeeded`、`refund.failed`。
- 本地 `orderId` 作为 `orderMerchantExternalId` 和 `checkoutRef`。Waffo 没有按 checkout session 查询的 REST，订单回跳和 webhook 都按该业务单号回查 payment。
- `@waffo/pancake-ts` 负责 RSA 请求签名和 `x-waffo-signature` webhook 验签；webhook 只是触发器，积分入账以回查后的支付快照为准。
- 退款只读取 `refund.succeeded` 的实际退款金额；`refund.failed` 不扣积分。若 Waffo 后续启用独立争议事件，必须补对账测试后才能上线。

账户准备：

- 先让免费图库在正式域名可访问，再创建 Waffo 商店，填写真实责任人和税务居住地。
- 站点必须展示真实的免费功能；只在生成器、积分到账和退款链路全部测试通过后，才把付费积分包写进 `site.config.ts` 并提交门店审核。
- 不接受“即将上线”、空白定价页、占位支持邮箱或无法完成生成的产品作为审核材料。
- 上线前用 Waffo 测试环境完整走一遍：登录 → 买最便宜套餐 → 生成 → 下载 → 全额退款 → 积分扣回 → 重复 webhook → 回跳同步。

## 7. 登录、邮件与风控

- 登录：Google OAuth + 邮箱验证码；Google One Tap 用于减少跳转。
- 邮件：Cloudflare Email Routing 承接 `support@aiposegallery.com`，`noreply@` 用于验证码。
- reCAPTCHA Enterprise：生成和注册都校验，`minRecaptchaScore: 0.5`。
- 频控：单账号每小时最多 10 次生成、同时最多 2 个进行中任务；游客全站每日 20 次硬上限。
- 内容审核：prompt 黑名单 + 模型自带安全过滤；命中即拒绝并退 credit。提供 `Report this output` 邮件入口。

## 8. 内容与法律边界

- 输出是"艺术家参考人台"，不是真人肖像；prompt 明确禁止名人相似度和真实人脸。
- 禁止未成年人、裸露、性化姿势、暴力血腥。
- 用户上传参考图时确认拥有使用权；参考图只用于姿势匹配。
- 图库里的示例图注明 AI 生成；不声称"无版权"或"可随意商用"。
- 退款政策写清楚：失败自动退，未使用 14 天内可退，已使用不退。

## 9. 埋点与转化

沿用 `src/lib/track.ts` 已有事件，不新增同义事件：

| 事件 | 触发点 |
|---|---|
| `generate_click` | 点生成按钮 |
| `sign_in_open` / `sign_in` | 登录弹窗与成功 |
| `pricing_open` | 余额不足或点价格 |
| `checkout_start` | 跳转 Waffo Checkout |
| `payment_confirmed` | 支付回跳且积分到账 |
| `generate_started` | 任务创建成功 |
| `result_ready` | 任务完成 |
| `result_download` | 下载 PNG |

首月只看三个数：生成器访问 → 首次生成、首次生成 → 购买、购买 → 第二张生成。不要用页面 PV 判断成败。

## 10. 技术落点

需要改的文件：

- `site.models.ts`：加入 `pose-sheet` 模型。
- `site.config.ts`：加入 3 个积分包、赠送 credit、游客额度、真实 `refs.waffo`，`billing.provider: 'waffo'`。
- `src/routes/pose-generator.tsx`：生成器页面，SEO title/description，`pageHead`。
- `src/site/pose-tool.tsx`：从 Tinydesk 示例的 `tool.tsx` 裁剪，保留 `useGeneration`、登录、余额、结果轮询、下载；去掉上传槽位和手机交接。
- `src/routes/index.tsx`：首屏加 `Generate a pose sheet` CTA；姿势详情弹窗加同款 CTA。
- `src/site/styles.css`：生成器表单、结果区、移动端样式。
- `messages/legal/`：填掉隐私、条款、退款、DMCA 的 TODO。
- `packages/core/src/billing/waffo.ts`：Waffo checkout、webhook 验签、GraphQL 回查、退款金额映射。
- `wrangler.jsonc`：补 D1、R2、Email、Workflow 绑定和 Waffo secrets。

当前 `wrangler.jsonc` 只有 Worker 基础配置，缺 D1/R2/Email/Workflow 绑定；生成链路在补齐 Cloudflare 资源前无法真正跑通。

## 11. 实施顺序

1. 账号与基础设施：Yir key、Waffo 商店与测试 API key、Google OAuth、reCAPTCHA、Cloudflare D1/R2/Workflow/Email。
2. 配置：模型、套餐、赠送额度、游客额度。
3. 代码：生成器页面 + 图库 CTA + 法律页面。
4. 真实生成测试：10 次，记录成本、延迟、可用率；不达标先调模型或价格。
5. Waffo 测试环境：购买、到账、生成、退款、重复 webhook、积分对账。
6. 预览环境移动端 QA；`pnpm --filter ./sites/aiposegallery check`。
7. 生产部署并提交 Waffo 门店审核；审核通过后自己买一次 $4.99 套餐并退款，确认 webhook 和积分账本。
8. 提交 sitemap，观察首月三个转化数。

## 12. 需要提前准备的账号

| 账号 | 用途 | 是否阻塞首发 |
|---|---|---|
| Yir | 生成上游，按量付费 | 是（要开生成） |
| Waffo Pancake（真实主体与税务居住地） | 收款、退款、税务、结算 | 是（要收费） |
| Google Cloud | OAuth 登录 + reCAPTCHA | 是（要登录） |
| Cloudflare | 域名、D1、R2、Workflow、Email | 是 |
| 客服邮箱 | 退款、举报、Waffo 审核 | 是 |

如果只想先上线免费图库，以上都不阻塞；但一旦要开生成和支付，Yir、Waffo 测试凭据与真实商品 ID 是最先要办的三项。

## 13. 后续迭代

- 第二模型：便宜的 draft 档（需先验证 Yir 目录和真实质量），2 张/credit 或更低价格。
- 订阅：Studio $9.99/月含 12 credits，前提是月留存和用量数据成立。
- 参考图工作流：草图 → 姿势表，作为 Pro 功能。
- 单格导出、放大、线稿模式：按次收费，不打包进基础套餐。
