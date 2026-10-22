import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

const ERROR_KEY = 'sfsq.errors.v1';

interface ErrorState {
  error: Error | null;
}

/**
 * 兜底：一行 throw 不该变成全站白屏。
 * 错误写进 localStorage 环形缓冲（最近 5 条），本地就能拿到现场，不需要第三方 SDK。
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorState> {
  state: ErrorState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      const prev: unknown = JSON.parse(localStorage.getItem(ERROR_KEY) ?? '[]');
      const list = Array.isArray(prev) ? prev : [];
      const next = [
        {
          at: new Date().toISOString(),
          message: error.message,
          stack: (error.stack ?? '').slice(0, 1200),
          componentStack: (info.componentStack ?? '').slice(0, 600),
        },
        ...list,
      ].slice(0, 5);
      localStorage.setItem(ERROR_KEY, JSON.stringify(next));
    } catch {
      // 记不下来也不能再抛
    }
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-screen">
        <h1>这一局出了点问题</h1>
        <p className="crash-line">页面遇到一个错误，已经记录在本地。你可以重新开始。</p>
        <p className="crash-detail">{this.state.error.message}</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          重新开始
        </button>
      </div>
    );
  }
}

/** 非渲染期异常也留一份现场 */
window.addEventListener('error', (event) => {
  try {
    const prev: unknown = JSON.parse(localStorage.getItem(ERROR_KEY) ?? '[]');
    const list = Array.isArray(prev) ? prev : [];
    localStorage.setItem(
      ERROR_KEY,
      JSON.stringify([{ at: new Date().toISOString(), message: String(event.message) }, ...list].slice(0, 5)),
    );
  } catch {
    // 忽略
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
