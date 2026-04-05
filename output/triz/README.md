# TRIZ 参赛材料包

这套材料围绕同一个申报口径生成，面向 `1 周内交校赛/省赛选拔` 的软件类作品准备。

## 已生成内容

- `00-unified-info.md`：统一信息表，所有材料先按这里的名称和创新点口径对齐。
- `01-work-proposal.md`：作品方案正文，已经按 TRIZ 理论赛语言改写。
- `02-novelty-brief.md`：查新交底书模板，可直接发给图书馆查新站或科技查新机构。
- `03-ip-proof-template.md`：自主知识产权证明材料说明模板，配合受理凭证或证书一起提交。
- `04-submission-checklist.md`：附件命名、补件顺序和对外联络话术。
- `assets/system-flow.svg`：完整业务流程图。
- `assets/system-architecture.svg`：技术架构图。
- `assets/*.png`：系统截图素材。
- `output/pdf/*.pdf`：以上核心文档对应的 PDF 版本。
- `submission/`：已经按比赛命名规则整理好的提交包。
- `scripts/generate_triz_materials.py`：修改 Markdown 后可重新生成 PDF 的脚本。

## 你需要手工补的字段

- 团队成员姓名、学院、专业、学号。
- 指导教师姓名和职称。
- 学校和院系名称。
- 查新委托单位、联系人、手机号、邮箱。
- 软件著作权申请号、受理号，或专利申请号、受理通知号。
- 演示视频链接、网盘链接或部署地址。

## 统一口径要求

- 竞赛申报名称统一用：`Anion 智能求职模拟与复盘系统`。
- 仓库名统一写：`anion`。
- 内部旧代号 `Mobius / 莫比乌斯计划` 只作为研发历史说明，不再作为参赛主标题。
- 三个核心创新点、三个查新点、知识产权名称，必须与 `00-unified-info.md` 完全一致。

## 建议交付顺序

1. 先补 `00-unified-info.md` 中的队伍和教师信息。
2. 用 `01-work-proposal.md` 出作品方案 PDF。
3. 用 `02-novelty-brief.md` 发起查新委托。
4. 用 `03-ip-proof-template.md` 配合软著受理凭证或专利受理通知整理知识产权附件。
5. 按 `04-submission-checklist.md` 统一命名和装订。

## 重新生成 PDF

如你后面补完团队成员、指导教师或申请号，只需在仓库根目录运行：

- `python scripts/generate_triz_materials.py`

然后再把最新 PDF 复制到 `output/triz/submission/` 对应文件名即可。
