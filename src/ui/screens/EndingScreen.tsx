import { useEffect, useRef, useState } from 'react';
import { copyText, downloadCanvas } from '../lib/clipboard';
import { buildPlainText, renderEndingCard, type EndingCardData } from '../lib/endingCard';

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    canvas.width = 1080 * dpr;
    canvas.height = 1920 * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      renderEndingCard(ctx, data, dpr);
    } catch {
      // 画不出来也不能白屏：下面的文本版仍然可读
    }
  }, [data]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) downloadCanvas(canvas, `shengfengqishi-${data.birth.year}.png`);
  };

  const handleCopy = async () => {
    const ok = await copyText(buildPlainText(data));
    setCopied(ok ? 'ok' : 'fail');
  };

  return (
    <main className="screen ending-screen">
      <canvas ref={canvasRef} className="ending-canvas" aria-label="结局卡" />

      <div className="ending-actions">
        <button type="button" className="btn-primary" onClick={handleSave}>
          保存图片
        </button>
        <button type="button" className="btn" onClick={handleCopy}>
          {copied === 'ok' ? '已复制' : copied === 'fail' ? '复制失败' : '复制文字版'}
        </button>
      </div>

      <button type="button" className="btn-link" onClick={onReview}>
        看详细复盘 →
      </button>
      <button type="button" className="btn-link" onClick={onRestart}>
        再抽一年
      </button>
    </main>
  );
}
