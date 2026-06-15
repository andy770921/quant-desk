import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { NavBar } from '@/components/nav-bar';

export const metadata: Metadata = {
  title: 'QuantDesk — 美股量化策略平台',
  description: '用免費美股資料回測 10 種量化交易策略，比較定期定額與一次性投入的長期績效。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <Providers>
          <NavBar />
          <main>{children}</main>
          <footer className="site">
            <div className="container">
              QuantDesk · 教育用途回測平台 · 資料來源 Yahoo Finance ·
              歷史績效不代表未來報酬，所有內容僅供研究參考，非投資建議。
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
