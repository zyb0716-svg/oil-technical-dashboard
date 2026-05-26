import { directionCn, money, number, pct } from '../lib/format';
import { BrentData } from '../lib/types';

export default function IndicatorTable({ asset }: { asset: BrentData }) {
  if (asset.data.length === 0) {
    return <div className="rounded-lg border border-line p-4 text-sm text-steel">暂无指标数据。</div>;
  }

  const latest = asset.data[asset.data.length - 1];
  const rows = [
    ['MA20', money(latest.ma20), latest.close > (latest.ma20 ?? Infinity) ? '价格在20日均线上方，短线偏强。' : '价格在20日均线下方，短线偏弱。'],
    ['MA60', money(latest.ma60), latest.close > (latest.ma60 ?? Infinity) ? '价格在60日均线上方，中期偏强。' : '价格在60日均线下方，中期承压。'],
    ['MA120', money(latest.ma120), latest.close > (latest.ma120 ?? Infinity) ? '价格在120日均线上方，长期结构偏强。' : '价格在120日均线下方，长期结构偏弱。'],
    ['RSI14', number(latest.rsi14), rsiExplain(latest.rsi14)],
    [
      'MACD快线 / 慢线',
      `${number(latest.macd)} / ${number(latest.macd_signal)}`,
      (latest.macd ?? 0) > (latest.macd_signal ?? 0)
        ? 'MACD快线高于慢线，说明短期动能强于前期趋势，趋势动能偏强。'
        : 'MACD快线低于慢线，说明短期动能弱于前期趋势，趋势动能偏弱。',
    ],
    ['布林带', `${money(latest.bb_lower)} - ${money(latest.bb_upper)}`, bollExplain(latest.close, latest.bb_upper, latest.bb_lower)],
    ['ATR14', money(latest.atr14), latest.atr14 ? 'ATR衡量波动率，不判断涨跌方向；当前可用于观察波动大小。' : '只有close数据时不计算ATR。'],
    ['涨跌幅', `20日 ${pct(latest.pct_20d)} · 60日 ${pct(latest.pct_60d)} · 120日 ${pct(latest.pct_120d)}`, '用于观察不同周期的价格强弱变化。'],
    ['趋势通道', `${directionCn(asset.channel.direction)} · slope ${number(asset.channel.slope, 4)}`, channelExplain(asset.channel.direction)],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {rows.map(([name, value, explain]) => (
            <tr key={name} className="border-b border-line last:border-0">
              <th className="w-24 bg-panel px-3 py-3 font-semibold text-ink sm:w-32">{name}</th>
              <td className="px-3 py-3 font-medium text-ink">{value}</td>
              <td className="hidden px-3 py-3 text-steel md:table-cell">{explain}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rsiExplain(value?: number | null): string {
  if (value == null) return '暂无RSI。';
  if (value >= 70) return 'RSI高于70，短期偏强，但可能接近超买。';
  if (value > 50) return 'RSI高于50，短期强弱偏多。';
  if (value <= 30) return 'RSI低于30，短期偏弱，但可能接近超卖。';
  if (value < 50) return 'RSI低于50，短期强弱偏空。';
  return 'RSI接近50，动能中性。';
}

function bollExplain(close: number, upper?: number | null, lower?: number | null): string {
  if (upper == null || lower == null) return '暂无布林带。';
  if (close >= upper) return '价格接近或突破上轨，短期偏强，但也可能接近超买。';
  if (close <= lower) return '价格接近或跌破下轨，短期偏弱，但也可能接近超卖。';
  return '价格位于布林带区间内，波动处于常规范围。';
}

function channelExplain(direction: string): string {
  if (direction === 'uptrend') return '价格处于上升通道结构，趋势偏多；跌破下轨可能转弱。';
  if (direction === 'downtrend') return '价格处于下降通道结构，趋势偏空；突破上轨可能转强。';
  return '趋势通道接近水平，价格偏震荡。';
}
