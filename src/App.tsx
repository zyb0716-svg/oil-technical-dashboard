import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import IndicatorTable from './components/IndicatorTable';
import PriceChart, { ChartLayers, ChartRange } from './components/PriceChart';
import SignalExplanation from './components/SignalExplanation';
import SummaryCards from './components/SummaryCards';
import { BrentData, Metadata, Signals } from './lib/types';

type DashboardData = {
  brent: BrentData;
  signals: Signals;
  metadata: Metadata;
};

const base = import.meta.env.BASE_URL;

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<ChartLayers>({
    ma20: false,
    ma60: false,
    ma120: false,
    bollinger: false,
    channel: false,
  });
  const [chartRange, setChartRange] = useState<ChartRange>('1y');

  useEffect(() => {
    Promise.all([fetchJson<BrentData>('brent.json'), fetchJson<Signals>('signals.json'), fetchJson<Metadata>('metadata.json')])
      .then(([brent, signals, metadata]) => setData({ brent, signals, metadata }))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const indicatorCards = useMemo(
    () => [
      ['MA20 / MA60 / MA120', '均线用于判断趋势。价格在均线上方通常偏强，价格跌破均线通常偏弱。短期均线高于长期均线，说明趋势偏多；短期均线低于长期均线，说明趋势偏空。'],
      ['RSI14', 'RSI用于衡量短期强弱。RSI高于50偏强，低于50偏弱；高于70可能接近超买，低于30可能接近超卖。'],
      ['MACD', 'MACD用于观察趋势动能。前一个数值是MACD快线，后一个数值是MACD慢线；快线高于慢线说明短期动能偏强，快线低于慢线说明短期动能转弱。'],
      ['Bollinger Bands', '布林带用于观察价格波动区间。价格接近上轨通常说明短期偏强，价格接近下轨通常说明短期偏弱。'],
      ['ATR14', 'ATR用于衡量波动率，不直接判断涨跌方向。ATR上升代表波动加大，ATR下降代表波动收敛。'],
      ['支撑位/阻力位', '支撑位是当前价格下方可能获得支撑的关键价位，阻力位是当前价格上方可能遇到压力的关键价位。'],
      ['趋势通道', '趋势通道用于观察价格是否运行在上升、下降或震荡结构中。价格跌破上升通道下轨可能代表趋势转弱，突破下降通道上轨可能代表趋势转强。'],
    ],
    [],
  );

  if (error) {
    return (
      <main className="section-shell py-10">
        <div className="card p-6">
          <AlertTriangle className="h-6 w-6 text-bear" />
          <h1 className="mt-4 text-2xl font-semibold">Brent 原油技术分析看板</h1>
          <p className="mt-2 text-steel">数据文件读取失败：{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return <main className="section-shell py-10 text-steel">Loading Brent 原油技术分析看板...</main>;
  }

  return (
    <div className="min-h-screen bg-[#f0f2ee]">
      <header className="border-b border-line bg-white">
        <div className="section-shell py-6">
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">Brent 原油技术分析看板</h1>
        </div>
      </header>

      <main className="section-shell space-y-8 py-6">
        <SummaryCards brent={data.brent} signals={data.signals} metadata={data.metadata} />
        <DataWarning status={data.metadata.data_status} message={data.brent.message_cn} />

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Brent 技术分析</h2>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
            <div className="space-y-4">
              <div className="card p-4">
                <RangeToggles range={chartRange} setRange={setChartRange} />
                <LayerToggles layers={layers} setLayers={setLayers} />
                <PriceChart asset={data.brent} layers={layers} range={chartRange} />
                <ChartLegend layers={layers} />
              </div>
              <IndicatorTable asset={data.brent} />
            </div>
            <div className="space-y-4">
              <SignalExplanation signal={data.signals.brent} supports={data.brent.levels.supports} resistances={data.brent.levels.resistances} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-ink">指标说明</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {indicatorCards.map(([title, body]) => (
              <div className="card p-4" key={title}>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-steel">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

    </div>
  );
}

function DataWarning({ status, message }: { status: string; message?: string }) {
  const text = dataStatusMessage(status, message);
  if (!text) return null;
  return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber">{text}</div>;
}

function dataStatusMessage(status: string, message?: string): string | null {
  if (status === 'real') return null;
  if (status === 'fallback_previous_static') return '当前使用上一版缓存数据，最新数据源抓取失败，请谨慎参考。';
  if (status === 'fallback_or_sample') return '当前显示的是示例或回退数据，不是真实行情。';
  if (status === 'no_real_data') return message ?? '暂无真实行情数据，请检查 yfinance 或配置 FRED_API_KEY。';
  return '当前数据状态未知，请检查 public/data/metadata.json。';
}

function LayerToggles({ layers, setLayers }: { layers: ChartLayers; setLayers: (layers: ChartLayers) => void }) {
  const options: Array<[keyof ChartLayers, string]> = [
    ['ma20', 'MA20'],
    ['ma60', 'MA60'],
    ['ma120', 'MA120'],
    ['bollinger', '布林带'],
    ['channel', '趋势通道'],
  ];
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <label key={key} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={(event) => setLayers({ ...layers, [key]: event.target.checked })}
            className="h-4 w-4 accent-bull"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function RangeToggles({ range, setRange }: { range: ChartRange; setRange: (range: ChartRange) => void }) {
  const options: Array<[ChartRange, string]> = [
    ['1y', '1年'],
    ['6m', '半年'],
    ['3m', '3个月'],
    ['1m', '1个月'],
    ['1w', '1周'],
  ];
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setRange(key)}
          className={`rounded-md border px-3 py-2 text-sm ${range === key ? 'border-bull bg-emerald-50 text-bull' : 'border-line bg-panel text-ink'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ChartLegend({ layers }: { layers: ChartLayers }) {
  const rows = [
    ['Brent price', 'Brent 原油价格。'],
    ['MA20', `20日均线，代表短期趋势，${layers.ma20 ? '当前显示。' : ''}`],
    ['MA60', `60日均线，代表中期趋势，${layers.ma60 ? '当前显示。' : ''}`],
    ['S1/S2/S3', '当前价格下方支撑位。'],
    ['R1/R2/R3', '当前价格上方阻力位。'],
    ['MA120', `120日均线，代表长期趋势，${layers.ma120 ? '当前显示。' : ''}`],
    ['Bollinger Upper/Middle/Lower', `布林带代表价格常规波动区间，${layers.bollinger ? '当前显示。' : ''} 价格接近上轨代表短期偏强但可能接近超买；跌破中轨代表短期动能转弱；接近下轨代表短期偏弱但可能接近超卖。`],
    ['Channel Upper/Middle/Lower', `最近60日线性回归趋势通道，${layers.channel ? '当前显示。' : ''} 上轨是趋势压力位，中轨是趋势中轴，下轨是趋势支撑位。`],
  ];
  return (
    <div className="mt-4 grid gap-2 text-xs text-steel sm:grid-cols-2">
      {rows.map(([name, explain]) => (
        <div key={name} className="rounded-md bg-panel px-3 py-2">
          <span className="font-semibold text-ink">{name}：</span>
          {explain}
        </div>
      ))}
    </div>
  );
}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${base}data/${file}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${file} HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
