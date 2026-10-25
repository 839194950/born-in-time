/**
 * 分享链路的两件小事：复制文字、保存图片。
 *
 * 保存图片曾经用 `canvas.toDataURL('image/png')`：1080×1920 的 PNG 转成
 * base64 字符串有 4–6MB，iOS Safari 上经常静默失败——玩家点了"保存图片"
 * 什么都不发生，而页面上的提示还在说"不要截屏，截屏二维码会扫不出来"，
 * 于是他被卡在一个死胡同里。
 *
 * 现在走 `toBlob` + object URL：内存占用低一个量级，兼容性也更好；
 * 失败时把 canvas 转成 <img> 交给页面显示，玩家长按就能存。
 */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续尝试旧路径
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * 保存 canvas 为 PNG。
 * 返回 true 表示浏览器接受了下载；false 时调用方应该把图交到页面上让玩家手动保存。
 */
export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  const blob = await toBlob(canvas);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // 立刻 revoke 会让部分浏览器的下载中断，给一个宽限
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
}

/** 降级路径：把 canvas 转成可直接长按保存的 <img> */
export function canvasToImageUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
