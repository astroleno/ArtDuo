# ArtDuo stage-fit rollout verification

## 结果

- 已上线提交 `30a3bd4d4c840e7a6240a9e35e9dc2a7d92efe95`，发布版本为 `2026-11-17-open-gap-714`。
- 已构建新发布目录并完成备份后原子切换；`artduo-web.service` 与 `artduo-handwriting.service` 均为 active。
- 回环健康检查和两个公网域名的 `/ArtDuo/api/health` 均返回 HTTP 200，`releaseVersion` 为 `2026-11-17-open-gap-714`。
- 公共媒体新增对象 168 个、45,748,196 bytes；本地 SHA-256 校验通过，正确对象前缀为 `artduo/media-v1/objects/`。
- 未改动 `/etc/artduo/artduo.env`，当前媒体投递模式仍是 local；本次 COS 上传作为已验证的公共对象准备，不改变线上投递模式。

## 抽测

- `安静的月光`：公网交互页进入 preface，selectionVersion 16，5 件作品，degraded 为空。
- `刚拿到offer，想看点开心的`：公网交互页进入 preface，selectionVersion 16，6 件作品，degraded 为空；抽测结果中 Indian miniature 数量为 0。
- 合成 stage-fit 抽测记录了 `stage-choice=748ms`，selectionVersion 16，degraded 为空。
- 已保留桌面端 1440×900 和移动端 390×844 的 0.5s、loading、preface 截图。

## 证据

- [target/validation.json](target/validation.json)
- [target/quota.json](target/quota.json)
- [target/candidate-curation.json](target/candidate-curation.json)
- [target/rollout.json](target/rollout.json)
- [public-checks.json](public-checks.json)
- [cleanup.json](cleanup.json)
- [wait-frames/](wait-frames/)

## 清理与未完成项

腾讯机上的候选服务、候选状态、传输包和激活脚本已清理；旧发布目录与回滚备份保留。COS 中误传的 `artduo/media-v1/objects/objects/` 前缀（168 个对象）和 4 个私有传输包已在控制台删除，正确的 `artduo/media-v1/objects/` 对象保持完整。真实 iOS Safari / Android Chrome 设备回归未在本轮执行。
