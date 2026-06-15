export function Loading({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="center-state">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : '發生未知錯誤';
  return (
    <div className="center-state">
      <span className="neg">⚠ 載入失敗</span>
      <span className="faint">{message}</span>
      <span className="faint">請確認後端服務 (http://localhost:3000) 是否啟動。</span>
    </div>
  );
}
