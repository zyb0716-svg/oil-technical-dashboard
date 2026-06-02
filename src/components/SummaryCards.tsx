import { CalendarDays, Clock, Gauge, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import { BrentData, Metadata, Signals } from '../lib/types';
import { money } from '../lib/format';

type Props = {
  brent: BrentData;
  signals: Signals;
  metadata: Metadata;
};

export default function SummaryCards({ brent, signals, metadata }: Props) {
  const signal = signals.brent;
  const s1 = brent.levels.supports[0];
  const r1 = brent.levels.resistances[0];
  const latestDataDate = metadata.latest_data_date ?? brent.latest_data_date ?? signal.latest_data_date ?? '暂无';
  const cards = [
    { label: 'Brent 首行', value: money(signal.latest_price), sub: dataStatusText(metadata.data_status), icon: TrendingUp },
    { label: '综合信号', value: signal.trend_label, sub: signal.momentum_label, icon: Gauge },
    { label: '趋势评分', value: `${signal.trend_score} / 5`, sub: '五项规则合计，范围 -5 到 +5', icon: Shield },
    { label: '最近支撑位', value: s1 ? money(s1.price) : '暂无', sub: '当前价格下方可能获得支撑', icon: TrendingDown },
    { label: '最近阻力位', value: r1 ? money(r1.price) : '暂无', sub: '当前价格上方可能遇到压力', icon: TrendingUp },
    { label: '数据日期', value: latestDataDate, sub: '结算价取数日期', icon: CalendarDays },
    { label: '更新时间', value: formatUtcMinute(metadata.last_updated), sub: closeModeText(metadata.yahoo_close_mode), icon: Clock },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-steel">{card.label}</p>
              <Icon className="h-4 w-4 text-steel" />
            </div>
            <div className="mt-3 min-h-8 text-xl font-semibold text-ink">
              {card.value}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-steel">{card.sub}</p>
          </div>
        );
      })}
    </div>
  );
}

function formatUtcMinute(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::\d{2})? UTC$/);
  if (match) return `${match[1]} ${match[2]} UTC`;
  return value;
}

function closeModeText(mode?: string | null): string {
  if (mode === 'early_fixed_close') return '早间固定 close 模式';
  if (mode === 'normal_daily_close') return '正常日线模式';
  return '数据模式未记录';
}

function dataStatusText(status: string): string {
  if (status === 'real') return '前一交易日结算价';
  if (status === 'fallback_previous_static') return '上一版缓存数据';
  if (status === 'fallback_or_sample') return '示例或回退数据';
  if (status === 'no_real_data') return '暂无真实数据';
  return '数据状态未知';
}
