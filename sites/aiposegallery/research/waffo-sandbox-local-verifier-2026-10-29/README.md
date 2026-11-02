# Waffo 本地沙箱验证：只读证据（2026-10-29）

## 范围及运行

独立脚本仅使用现有 `@waffo/pancake-ts` SDK 和 Node 内建模块，不启动服务器、不部署、不修改 webhook，也不创建商品、checkout、支付或退款。仅调用官方 GraphQL 的两个固定查询：schema 自省，以及既有 `CHECKOUT-ONCE.json` 中的测试订单对应支付。请求由 SDK 使用站点 `.dev.vars` 中的测试凭据签名；脚本要求 `WAFFO_ENVIRONMENT=test`，筛选指定 store、`testMode=true` 和既有 `pose-test-<uuid>` 订单引用。API 通过签名凭据区分模式，配置值本身并不能独立证明密钥实际属于测试环境。传输层限制单一 GraphQL 地址、固定查询、拒绝重定向及 15 秒超时。不能以网络限制代替沙箱隔离验收。

在 `shipwords` 根目录：

```sh
node --test sites/aiposegallery/research/waffo-sandbox-local-verifier-2026-10-29/verify.test.mjs
node sites/aiposegallery/research/waffo-sandbox-local-verifier-2026-10-29/verify.mjs offline
node sites/aiposegallery/research/waffo-sandbox-local-verifier-2026-10-29/verify.mjs read-only
```

运行不打印或保存密钥、请求签名、签名 URL、订单 ID、用户信息、原始 API 数据；只输出字段名、数量和关联布尔值。`read-only` 所需现有文件缺失或任一查询失败时退出非零，错误不打印原文。数据查询对付款最多取 100 条，同时比较 `paymentsCount`；`firstPageComplete=false` 表示不完整，嵌套 refunds 的完整性尚无证明，结果不能用于账务。无记录时关联结果为 `null`，不把空集合当成功。测试不使用真实 Waffo 回调或密钥。

## 本次结果与可复核结论

- 本地 SDK `verifyWebhook`：临时 RSA 密钥构造的有效签名通过，改动原始正文、错误公钥、缺失或畸形 header、超过 45 分钟的旧时间、未来 2 分钟均被拒绝。该验证仅证明本地 SDK 算法及容差，不证明平台公钥、真实回调或项目 handler 的端到端行为。
- `read-only` 使用 test 配置，两个 GraphQL 查询成功，证明此时该凭据与 SDK 的请求签名可被查询端接受；鉴权成功不独立证明支付真实状态或 webhook 签名。
- 实时 schema 显示 `Payment` 具有 `id`、`orderId`、`testMode`、`status`、`orderMerchantExternalId`、`snapshotAmountDetails`、`pspAmountDetails` 和 `refunds`；`PspAmountDetails` 有 `amount`、`currency`、可空结算金额和币种。此发现表明渠道金额有查询字段，但没有真实支付记录，无法证实其真实取值、来源或缺失时行为；不能把价格快照当实收。
- `Refund` 有 `id`、`paymentId`、可空 `ticketId`、`status`、`testMode`、可空业务引用及 `pspAmountDetails`；`RefundFilter` 支持 `paymentId` 和 `ticketId`，也支持 `refundTicketMerchantExternalId`。schema 能表达退款关联，但尚未用实际退款验证关联正确性、退款与支付金额的口径、缺失工单、分页及一致性。
- 该既有测试 checkout 引用在指定 store、`testMode=true` 的 `payments` 查询中返回 **0 条**，`paymentsCount=0`；没有支付或退款可供关联，所有实际关联检查是 `null`。这并不证明其他订单没有交易，也不证明完整支付链路可用。

## 实际阻塞

既有记录指出 test webhook 指向正式域名，当前未重新核实；在完成独立沙箱资源、所有测试订阅和回调隔离的复核之前，不应制造支付或退款事件。用户本次仅授权只读 API，本工具无法提供 Waffo 平台签发的真实事件、支付与退款样本，也无法验收真实回调、公钥、重复/乱序处理、退款完整性和账本；生产启用没有获得授权。详见同级 `waffo-sandbox-isolation-acceptance-2026-10-29.md`。线上沙箱接口的 schema 和状态均可能变化，复核时应重新运行只读命令。
