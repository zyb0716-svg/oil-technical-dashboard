import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { BrentData, PricePoint } from '../lib/types';

export type ChartLayers = {
  ma20: boolean;
  ma60: boolean;
  ma120: boolean;
  bollinger: boolean;
  channel: boolean;
};

export type ChartRange = '1y' | '6m' | '3m' | '1m' | '1w';

type Props = {
  asset: BrentData;
  layers: ChartLayers;
  range: ChartRange;
  height?: number;
};

const colors = {
  up: '#127c59',
  down: '#b9383f',
  price: '#172026',
  ma20: '#0f6f9f',
  ma60: '#8b5b00',
  ma120: '#5b5f66',
  bollinger: '#8a6fb0',
  channel: '#7c8791',
  support: '#127c59',
  resistance: '#b9383f',
};

export default function PriceChart({ asset, layers, range, height = 380 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || asset.data.length === 0) return;
    ref.current.innerHTML = '';
    const visibleData = filterByRange(asset.data, range);
    const visibleChannel = {
      upper: filterChannelByRange(asset.channel.upper, visibleData),
      middle: filterChannelByRange(asset.channel.middle, visibleData),
      lower: filterChannelByRange(asset.channel.lower, visibleData),
    };

    const chart = createChart(ref.current, {
      height,
      layout: { background: { color: '#ffffff' }, textColor: '#314047' },
      grid: { vertLines: { color: '#edf0ec' }, horzLines: { color: '#edf0ec' } },
      crosshair: { mode: CrosshairMode.Normal },
      leftPriceScale: { borderColor: '#d9ded7', visible: true, scaleMargins: { top: 0.08, bottom: 0.08 } },
      rightPriceScale: { borderColor: '#d9ded7', scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: '#d9ded7', timeVisible: false },
    });

    const resize = () => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    };
    resize();
    window.addEventListener('resize', resize);

    const hasOhlc =
      visibleData.length > 0 &&
      visibleData.every((d) => d.open != null && d.high != null && d.low != null && d.close != null);
    const main: any = hasOhlc
      ? chart.addCandlestickSeries({
          upColor: colors.up,
          downColor: colors.down,
          borderUpColor: colors.up,
          borderDownColor: colors.down,
          wickUpColor: colors.up,
          wickDownColor: colors.down,
          title: 'Brent price',
        })
      : chart.addLineSeries({ color: colors.price, lineWidth: 2, title: 'Brent close' });

    if (hasOhlc) {
      main.setData(
        visibleData.map((d) => ({ time: d.date, open: d.open!, high: d.high!, low: d.low!, close: d.close })),
      );
    } else {
      main.setData(visibleData.map((d) => ({ time: d.date, value: d.close })));
    }

    const levelScale = chart.addLineSeries({
      priceScaleId: 'left',
      color: 'rgba(0, 0, 0, 0)',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    levelScale.setData(visibleData.map((d) => ({ time: d.date, value: d.close })));
    addInvisibleScaleAnchor(chart, visibleData);

    if (layers.ma20) addLine(chart, visibleData, 'ma20', colors.ma20, 'MA20', 2);
    if (layers.ma60) addLine(chart, visibleData, 'ma60', colors.ma60, 'MA60', 2);
    if (layers.ma120) addLine(chart, visibleData, 'ma120', colors.ma120, 'MA120', 1);

    if (layers.bollinger) {
      addLine(chart, visibleData, 'bb_upper', colors.bollinger, 'Bollinger Upper', 1, LineStyle.Dashed, 'left');
      addLine(chart, visibleData, 'bb_middle', colors.bollinger, 'Bollinger Middle', 1, LineStyle.Dotted, 'left');
      addLine(chart, visibleData, 'bb_lower', colors.bollinger, 'Bollinger Lower', 1, LineStyle.Dashed, 'left');
    }

    if (layers.channel) {
      addChannel(chart, visibleChannel.upper, '#9aa5ad', 'Channel Upper', 'left');
      addChannel(chart, visibleChannel.middle, colors.channel, 'Channel Middle', 'left');
      addChannel(chart, visibleChannel.lower, '#9aa5ad', 'Channel Lower', 'left');
    }

    asset.levels.supports.forEach((level) =>
      levelScale.createPriceLine({
        price: level.price,
        color: colors.support,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${level.label} ${level.price}`,
      }),
    );
    asset.levels.resistances.forEach((level) =>
      levelScale.createPriceLine({
        price: level.price,
        color: colors.resistance,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${level.label} ${level.price}`,
      }),
    );

    chart.timeScale().fitContent();
    return () => {
      window.removeEventListener('resize', resize);
      chart.remove();
    };
  }, [asset, height, layers, range]);

  if (asset.data.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-md border border-line text-sm text-steel"
        style={{ height }}
      >
        暂无真实行情数据，请检查 yfinance 或配置 FRED_API_KEY。
      </div>
    );
  }

  return <div ref={ref} className="w-full overflow-hidden rounded-md border border-line" style={{ height }} />;
}

function filterByRange(data: PricePoint[], range: ChartRange): PricePoint[] {
  if (data.length === 0) return data;
  const latest = new Date(`${data[data.length - 1].date}T00:00:00Z`);
  const cutoff = new Date(latest);
  if (range === '1w') cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  if (range === '1m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
  if (range === '3m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  if (range === '6m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  if (range === '1y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return data.filter((item) => Date.parse(`${item.date}T00:00:00Z`) >= cutoff.getTime());
}

function filterChannelByRange(data: { date: string; value: number }[], visibleData: PricePoint[]) {
  if (visibleData.length === 0) return [];
  const firstDate = visibleData[0].date;
  return data.filter((item) => item.date >= firstDate);
}

function addInvisibleScaleAnchor(chart: any, data: PricePoint[]) {
  const seriesOptions = {
    priceScaleId: 'left',
    color: 'rgba(0, 0, 0, 0)',
    lineWidth: 1 as const,
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
  };
  const highAnchor = chart.addLineSeries(seriesOptions);
  const lowAnchor = chart.addLineSeries(seriesOptions);
  highAnchor.setData(
    data
      .filter((d) => d.high != null)
      .map((d) => ({ time: d.date, value: d.high as number })),
  );
  lowAnchor.setData(
    data
      .filter((d) => d.low != null)
      .map((d) => ({ time: d.date, value: d.low as number })),
  );
}

function addLine(
  chart: any,
  data: PricePoint[],
  key: keyof PricePoint,
  color: string,
  title: string,
  lineWidth: 1 | 2,
  lineStyle: LineStyle = LineStyle.Solid,
  priceScaleId?: 'left' | 'right',
) {
  const series = chart.addLineSeries({ color, lineWidth, lineStyle, title, priceScaleId });
  series.setData(data.filter((d) => d[key] != null).map((d) => ({ time: d.date, value: d[key] as number })));
}

function addChannel(
  chart: any,
  data: { date: string; value: number }[],
  color: string,
  title: string,
  priceScaleId?: 'left' | 'right',
) {
  const series = chart.addLineSeries({ color, lineWidth: 1, lineStyle: LineStyle.Dashed, title, priceScaleId });
  series.setData(data.map((d) => ({ time: d.date, value: d.value })));
}
