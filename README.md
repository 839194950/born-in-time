# 生逢其时

只抽出生年份的人生模拟网页游戏。地点固定为中国、普通家庭，抽到哪一年，就过哪一年的人生。

- 完整规格：`生逢其时-完整规格.md`
- 实现计划：`docs/superpowers/plans/2026-10-21-life-sim.md`
- 史实核对表：`docs/史实核对表.md`
- 上线检查单：`docs/上线检查单.md`

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 单元测试（引擎 + 数据 + 组件渲染）
npm run build      # 类型检查 + 产出 dist/
npm run preview    # 本地预览构建产物
npm run fact-table # 从事件数据重新生成史实核对表
```

## 部署

纯静态站、零后端，构建产物在 `dist/`。

**Vercel**：导入仓库，Framework Preset 选 Vite，Build Command `npm run build`，Output Directory `dist`。

**Cloudflare Pages**：连仓库，Framework preset 选 Vite，Build command `npm run build`，Build output directory `dist`。

存档与前世纪录只用浏览器 localStorage，不依赖任何后端服务。

## 代码结构

```
src/engine/   与框架无关的纯 TS：时间推进、数值结算、窗口判定、账本、命型判定、存档
src/data/     全部内容：人口表、姓名库、事件（时代/阶段/条件/播报）、称号、道具年代表
src/ui/       界面：抽选屏、主循环屏、事件弹窗、结局卡、复盘页、像素渲染
tests/        与 src 同构；引擎可在 Node 里无 UI 跑完一整局
```

- 引擎不碰 DOM，所有随机都走种子随机（`mulberry32`），所以**存档 = 种子 + 事实流水**，恢复时重放得到完全一致的一生。
- 事件全部是配置对象；新增内容只改 `src/data/`，`validateCatalog()` 会拒绝没有出处的条目。

## 加一个事件

在 `src/data/events/{era,stage,conditional}.ts` 里加一条，字段见 `src/engine/types.ts` 的 `EventDef`：

```ts
{
  id: 'era_something_2010',
  layer: 'era',
  trigger: { type: 'year', year: 2010 },
  windowAge: [20, 40],
  title: '标题',
  body: '主干文案',
  variants: { rural: '只换一两句' },
  choices: [{ id: 'a', label: '选项', effects: { ability: 3, wealth: -1 }, outcome: '结果' }],
  ledgerWeight: 3,
  source: '出处（必须有）',
}
```

跑 `npm test` 会自动校验：id 唯一、有出处、有选项、窗口合法、效果幅度合规、2026 年后必须标“推演”。

## 已知取舍

- 角色与场景是 canvas 程序化像素绘制（零素材、调色板统一），不是手绘 PNG。要换手绘，只改 `src/ui/components/SceneStage.tsx` 与 `src/ui/lib/scene.ts`。
- “比同龄人多活十年的人”的判定阈值按本模型实测校准为 `队列预期寿命 + 2.5`（模型上限约 +2.9），称号仍用规格原文。
- 年度重心的效果按 0.4 折算后生效，按钮上显示的是折算后的真实值——否则连年选“拼事业”会把数值推到 0。
- 灵感来源：1in8b.life。本作的主题、机制、文案、数据均为原创，未使用原作素材。
