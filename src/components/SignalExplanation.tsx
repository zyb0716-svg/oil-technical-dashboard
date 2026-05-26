import { AssetSignal, Level } from '../lib/types';

type Props = {
  signal: AssetSignal;
  supports: Level[];
  resistances: Level[];
};

export default function SignalExplanation({ signal, supports, resistances }: Props) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base font-semibold text-ink">{signal.momentum_label}</span>
        <span className="text-base font-semibold text-ink">{signal.volatility_label}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink">{signal.summary_cn}</p>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold text-ink">评分来源</p>
        <div className="grid gap-2">
          {signal.score_breakdown.map((item) => (
            <div key={item.name} className="flex items-start gap-3 rounded-md border border-line bg-panel p-3">
              <span className={`min-w-10 rounded-md px-2 py-1 text-center text-sm font-semibold ${item.value > 0 ? 'bg-emerald-50 text-bull' : item.value < 0 ? 'bg-red-50 text-bear' : 'bg-white text-steel'}`}>
                {item.value > 0 ? '+1' : item.value}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-1 text-sm text-steel">{item.explain}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2">
        <LevelList title="关键支撑位" levels={supports} helper="当前价格下方可能获得买盘支撑的关键价位。" />
        <LevelList title="关键阻力位" levels={resistances} helper="当前价格上方可能遇到卖压的关键价位。" />
      </div>
    </div>
  );
}

function LevelList({ title, levels, helper }: { title: string; levels: Level[]; helper: string }) {
  return (
    <div className="flex h-full flex-col rounded-md border border-line bg-panel p-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs text-steel">{helper}</p>
      <div className="mt-2 flex flex-1 flex-wrap content-start gap-2">
        {levels.length ? (
          levels.map((level) => (
            <span key={`${title}-${level.label}`} className="rounded-md bg-white px-2.5 py-1 text-sm text-steel">
              {level.label}: ${level.price.toFixed(2)} - 强度 {level.strength}
            </span>
          ))
        ) : (
          <span className="text-sm text-steel">暂无有效水平位</span>
        )}
      </div>
    </div>
  );
}
