# AI Pose Gallery 本机图片测试 API

仅供本机工作台测试。服务固定监听 `127.0.0.1:6045`，读取本站 `.dev.vars` 的 `YIR_API_KEY`；请勿部署，`NODE_ENV=production` 时无法启动。生成会上传用户输入到 Yir 并可能产生费用。前端必须让用户主动勾选确认拥有图片使用权并同意上传处理，只有勾选后才发送 `consent=yes`。

在仓库根目录启动：

```sh
node sites/aiposegallery/scripts/local-pose-api.mjs
```

测试（所有上游网络均为模拟，不产生生成费用）：

```sh
node --test sites/aiposegallery/scripts/local-pose-api.test.mjs
```

工作台需通过 `http://localhost:6043` 或 `http://127.0.0.1:6043` 访问（`pnpm dev` 经 dev-port 固定使用 6043；也保留 6044 以兼容旧检出）。所有端点均要求精确的 `Origin`；允许的 Host 是 `127.0.0.1:6045` 和 `localhost:6045`。建议前端请求 `http://127.0.0.1:6045`，服务只绑定 IPv4。无 Origin、其他 Origin/Host 均拒绝。支持 CORS 预检，允许 `Content-Type` 与 `Idempotency-Key`。

- `GET /health` → `200 {"available":true}`。只表示本地服务可用，不表示余额或模型可用。
- `POST /generate`：`multipart/form-data`。字段：`photo`、`pose` 为可选图片文件；`prompt` 为可选文字（最多 2000 个 UTF-16 code units）；`consent` 必须是 `yes`。必须提供姿势图或非空 prompt；人物图可选。只能使用 PNG、JPEG 或 WebP，MIME 与文件签名必须一致，每张最多 10 MiB，整个请求最多 20 MiB + 64 KiB。浏览器使用 `FormData` 时让浏览器自行生成带 boundary 的 `Content-Type`。
- `POST /generate` 还必须带 `Idempotency-Key`：每次用户主动生成创建一个随机 UUID，网络重试时沿用相同键和完全相同的输入；不同的主动生成使用不同键。允许 8–128 个英文字母、数字、下划线或连字符。成功返回 `202 {"id":"...","status":"queued"}`；同键同输入在当前进程内返回相同 id，异输入或重启后的重复键返回 409。返回 202 仅表示本地排队，后台报价、上传或生成仍可能失败。
- `GET /jobs/:id` → `{"id":"...","status":"queued|running|succeeded|failed","error":"...","resultUrl":"/result/:id"}`；`error` 与 `resultUrl` 仅在对应状态出现。轮询本地服务，并把相对 resultUrl 拼到 `http://127.0.0.1:6045`。
- `GET /jobs/recover` 使用原 `Idempotency-Key` 请求头查询当前进程内的原任务；没有找到返回 404，进程重启后记录存在但结果不可恢复返回 410。该查询不创建新任务或收费。提交结果不确定时，工作台的“Check previous request”只查询原键；404 不能证明仍在途的请求不会随后到达，410 表示本地记录存在。只有检查上游状态和费用后，才可使用“Start a new request after checking”退出恢复并开始新的请求。
- `GET /result/:id` 在成功后返回图片，`Cache-Control: no-store`；未完成或不存在返回 404。跨域 `<img>` 必须设置 `crossOrigin="anonymous"` 以发送 Origin，也可用 `fetch` 读取为 blob 后展示。错误响应为 `{"error":"..."}`。

人物图与姿势图同时提供时，人物图是第一参考图，姿势图是第二参考图；只有姿势图时明确要求生成新人物；纯文本模式不带参考图。图片引用通过 Yir Files 上传。固定模型 `openai/gpt-image-2.5-sunburst`，`1K`、`3:4`、`medium`、`n=1`。先报价，要求美元报价和可用供应、报价尚未过期、主报价及若有的 expected amount 均不超过 $0.15，随后以 `max_cost=0.30` 提交。报价不是最终费用；无参考图的文本模式由上游报价验证，不受支持时任务显示失败。

结果和本地 job 只保存在进程内，终态保留 30 分钟并在后续请求时清理；同一浏览器标签页刷新可恢复任务或结果，刷新不会保存输入图片，服务重启后不可恢复结果。每次只允许一个任务运行。系统临时目录中 `aiposegallery-local-api-<uid>` 是权限为 0700 的状态目录，文件为 0600，记录本地 ID、输入摘要、幂等键摘要和可获得的上游 job ID，不保存原图、prompt、密钥或签名 URL。提交或上游状态不确定时会保留 `active.lock`，后续任务和重启均被阻止，避免重复收费。先由操作者检查 Yir 上游任务和费用；仅在确认不会造成重复提交后，才手动删除该目录中的 `active.lock`。已使用的幂等键记录仍保留，不能用于重试；不要删除这些记录来绕过保护。上传失败或报价失败也消耗本地幂等键，应由用户明确发起新的生成并使用新键。
