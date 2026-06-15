import type { Metadata } from 'next';
import {
  DRAWDOWN_BANDS,
  RETURN_BANDS,
  RISK_VOL_BANDS,
  SHARPE_BANDS,
  VOLATILITY_BANDS,
  type RatingBand,
} from '@repo/shared';

export const metadata: Metadata = { title: '指標說明 — QuantDesk' };

interface Row {
  range: string;
  label: string;
  tone: string;
}

function ranges(bands: { max: number; label: string; tone: string }[], unit: string): Row[] {
  return bands.map((b, i) => {
    const lo = i === 0 ? null : bands[i - 1].max;
    const hi = b.max === Infinity ? null : b.max;
    let range: string;
    if (lo === null) range = `< ${hi}${unit}`;
    else if (hi === null) range = `≥ ${lo}${unit}`;
    else range = `${lo}${unit} – ${hi}${unit}`;
    return { range, label: b.label, tone: b.tone };
  });
}

function BandTable({
  title,
  desc,
  bands,
  unit,
  firstCol = '數值範圍',
}: {
  title: string;
  desc: string;
  bands: RatingBand[];
  unit: string;
  firstCol?: string;
}) {
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>{title}</h2>
      <p className="faint" style={{ marginTop: 0, marginBottom: 12 }}>
        {desc}
      </p>
      <table className="doc-table">
        <thead>
          <tr>
            <th>{firstCol}</th>
            <th>評級</th>
          </tr>
        </thead>
        <tbody>
          {ranges(bands, unit).map((r) => (
            <tr key={r.label}>
              <td>{r.range}</td>
              <td>
                <span className={`rate ${r.tone}`}>{r.label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GLOSSARY: { term: string; def: string }[] = [
  {
    term: '最終價值 (Final Value)',
    def: '回測結束時，投資組合（持倉市值 + 未投入現金）的總金額。',
  },
  {
    term: '已投入本金 (Contributed)',
    def: '整段期間實際投入的現金總額。定期定額為每月投入金額累加；一次性投入為起始那筆。',
  },
  {
    term: '總報酬 (Total Return)',
    def: '最終價值 ÷ 已投入本金 − 1。反映「投入的錢」總共成長了多少（未年化）。',
  },
  {
    term: '年化報酬 — XIRR / CAGR',
    def: '定期定額採用資金加權報酬率 (XIRR)，會考慮每筆現金投入的時間；一次性投入採用複合年均成長率 (CAGR)。兩者都把報酬換算成「每年平均」。',
  },
  {
    term: '最大回撤 (Max Drawdown)',
    def: '資金曲線從歷史高點到之後最低點的最大跌幅（以正的百分比表示）。衡量最痛的一段下跌。',
  },
  {
    term: '年化波動度 (Volatility)',
    def: '每日報酬標準差年化後的數值，衡量資金曲線的起伏程度。本平台也用它來決定「風險等級」。',
  },
  {
    term: '夏普值 (Sharpe Ratio)',
    def: '(策略報酬 − 無風險利率) ÷ 波動度，年化。衡量「每承受一單位風險換到多少超額報酬」，越高越好。',
  },
  {
    term: '最高槓桿 (Peak Leverage)',
    def: '回測期間實際達到的最高市場曝險倍數（例如持有 TQQQ 100% = 3 倍）。由回測動態計算，非寫死。',
  },
  {
    term: '交易次數 (Trades)',
    def: '策略主動調整部位的次數（不含每月投入新資金）。每曆月上限 3 次。',
  },
  {
    term: '資料起始 / 暖身期 (Warm-up)',
    def: '每個策略需要足夠的歷史資料，指標才會有效（例：200 日均線需 200 天、20 日均線需 20 天、12 個月動能需約 252 天）。「資料起始」= 該策略所用資料中最晚問世者的起始日 + 暖身天數；在此之前不進行回測或訊號評估。這是策略邏輯的結構性需求，非顯示用途。',
  },
];

export default function GuidePage() {
  return (
    <div className="container">
      <div className="section-head" style={{ marginTop: 36, marginBottom: 8 }}>
        <div>
          <h2>指標說明</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            平台上的「風險等級」與評級都由回測數據動態推導，下列為各指標的定義與分級門檻（與程式邏輯共用同一份設定，不會不一致）。
          </p>
        </div>
      </div>

      <BandTable
        title="風險等級 (Risk Level)"
        desc="風險等級不是寫死的，而是依該策略歷史回測的「年化波動度」自動分級（波動度已反映槓桿效果）。"
        bands={RISK_VOL_BANDS}
        unit="%"
        firstCol="年化波動度"
      />
      <BandTable
        title="夏普值評級"
        desc="衡量風險調整後報酬的品質。"
        bands={SHARPE_BANDS}
        unit=""
      />
      <BandTable title="最大回撤評級" desc="跌幅越小越好。" bands={DRAWDOWN_BANDS} unit="%" />
      <BandTable
        title="年化波動度評級"
        desc="起伏越小代表資金曲線越平穩。"
        bands={VOLATILITY_BANDS}
        unit="%"
      />
      <BandTable
        title="年化報酬評級"
        desc="僅供參考，報酬須與風險一併評估。"
        bands={RETURN_BANDS}
        unit="%"
      />

      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>指標定義</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{g.term}</div>
              <div className="muted" style={{ fontSize: 14 }}>
                {g.def}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>運作模型與說明</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="note">
            風險等級與最高槓桿為「動態推導」：以該策略 1990
            年起的一次性回測，量測波動度與實際最高曝險後分級，不在程式中寫死。
          </div>
          <div className="note">
            類別 (動能 / 趨勢…)、調整頻率 (每日 / 每月)、再平衡、暖身期
            屬於策略本身的結構性設定，無法用數字統計，因此維持人工定義。
          </div>
          <div className="note">
            資料起始 = 該策略核心資產最晚問世日 +
            暖身天數（策略最長回看期），確保計算訊號時已有足夠歷史資料。
          </div>
          <div className="note">
            不使用融資借貸：要放大曝險時改買對應的槓桿 ETF（TQQQ 3x 那斯達克、UPRO 3x 標普、SSO 2x
            標普），ETF 每日重設、扣除約 0.9%/年費用模擬。
          </div>
          <div className="note">
            每月現金：定期定額會在每月 1
            日撥入現金，僅在策略訊號為進場時才買入；策略在場外時，現金會留著等待進場。
          </div>
          <div className="note">
            交易上限：為避免過度頻繁買賣，每曆月最多 3 次主動調整部位（投入新資金不計入）。
          </div>
          <div className="note">
            比較基準：每月 / 一次買入 QQQ（那斯達克100）與
            VOO（標普500）；上市前以對應指數含息回推。
          </div>
          <div className="note">
            資料來源 Yahoo Finance。歷史績效不代表未來，所有內容僅供教育與研究參考，非投資建議。
          </div>
        </div>
      </div>
    </div>
  );
}
