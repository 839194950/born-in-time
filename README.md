# 生逢其时

只抽出生年份的人生模拟网页游戏。地点固定为中国、普通家庭，抽到哪一年，就过哪一年的人生。

- 规格：`生逢其时-完整规格.md`
- 实现计划：`docs/superpowers/plans/2026-10-21-life-sim.md`

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 单元测试
npm run build    # 产出 dist/
npm run preview  # 本地预览构建产物
```

## 部署

纯静态站、零后端，构建产物在 `dist/`。

**Vercel**：导入仓库，Framework Preset 选 Vite，Build Command `npm run build`，Output Directory `dist`。

**Cloudflare Pages**：连仓库，Framework preset 选 Vite，Build command `npm run build`，Build output directory `dist`。

存档与前世纪录只用浏览器 localStorage，不依赖任何后端服务。
