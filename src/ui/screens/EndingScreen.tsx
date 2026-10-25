import { useEffect, useRef, useState } from 'react';
import { canvasToImageUrl, copyText, downloadCanvas } from '../lib/clipboard';
import { buildPlainText, renderEndingCard, type CardQr, type EndingCardData } from '../lib/endingCard';
import { eraOfYear } from '../lib/era';
import { shareUrl } from '../lib/share';
import { playCue } from '../audio';
import { track } from '../analytics';

export function EndingScreen({
  data,
  onReview,
  onRestart,
}: {
  data: EndingCardData;
  onReview: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  /** 下载被浏览器拦下时，把图挂到页面上让玩家长按保存 */
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [qr, setQr] = useState<CardQr | null>(null);
  const url = shareUrl(data.seed);

  useEffect(() => {
    playCue('ending.card');
    track('ending', { age: data.ending.aggregate.deathAge });
  }, [data]);

  // 二维码按需加载：不进主包（动态 import 会单独切一个 chunk）
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const mod = await import('qrcode');
        const code = mod.default.create(url, { errorCorrectionLevel: 'M' });
        const size = code.modules.size;
        const bits = code.modules.data;
        if (alive) {
          setQr({ size, isDark: (x, y) => bits[y * size + x] === 1 });
        }
      } catch {
        // 画不出二维码也不影响文字版分享
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    canvas.width = 1080 * dpr;
    canvas.height = 1920 * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      renderEndingCard(ctx, data, dpr, qr);
    } catch {
      // 画不出来也不能白屏：下面的文本版仍然可读
    }
  }, [data, qr]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ok = await downloadCanvas(canvas, `shengfengqishi-${data.birth.year}.png`);
    if (ok) {
      track('save_png');
      return;
    }
    // 下载被拦（iOS Safari 常见）：把图挂出来让玩家长按保存。
    // 以前这里是静默失败——玩家点一下什么都没发生，而页面还在说"不要截屏"。
    setFallbackSrc(canvasToImageUrl(canvas));
    track('save_png_fail');
  };

  const handleCopy = async () => {
    const ok = await copyText(buildPlainText(data));
    setCopied(ok ? 'ok' : 'fail');
    if (ok) track('copy_text');
  };

  return (
    <main className="screen ending-screen" data-era={eraOfYear(data.birth.year).id}>
      <canvas ref={canvasRef} className="ending-canvas" aria-label="结局卡" />

      {/* canvas 对读屏与搜索不可见，这里补一份可读文本 */}
      <div className="sr-only">
        <h1>{data.ending.headline}</h1>
        <p>
          {data.birth.year} 年出生，享年 {data.ending.aggregate.deathAge} 岁。命型：
          {data.ending.title.name}。{data.ending.subtitle}
        </p>
      </div>

      <div className="ending-actions">
        <button type="button" className="btn-primary" onClick={handleSave}>
          保存图片
        </button>
        <button type="button" className="btn" onClick={handleCopy}>
          {copied === 'ok' ? '已复制' : copied === 'fail' ? '复制失败' : '复制文字版'}
        </button>
      </div>
      {/* 给发送者看的提示：截屏会把二维码压成 65px，扫不出来 */}
      <p className="ending-tip">发之前请用「保存图片」，不要直接截屏——截屏后二维码会扫不出来。</p>

      {fallbackSrc && (
        <div className="ending-fallback">
          <p className="ending-tip">浏览器拦下了下载。请长按下面这张图保存到相册。</p>
          <img src={fallbackSrc} alt="这一局的结局卡，长按可保存" />
        </div>
      )}

      <button type="button" className="btn-link" onClick={onReview}>
        看详细复盘 →
      </button>
      <button type="button" className="btn-link" onClick={onRestart}>
        再抽一年
      </button>
    </main>
  );
}
