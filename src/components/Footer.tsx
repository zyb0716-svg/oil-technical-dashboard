import { Metadata } from '../lib/types';

export default function Footer({ metadata }: { metadata: Metadata }) {
  return (
    <footer className="border-t border-line bg-white">
      <div className="section-shell py-6 text-sm leading-6 text-steel">
        <p>数据日期：{metadata.latest_data_date ?? '暂无'}</p>
        <p>更新时间：{metadata.last_updated}</p>
        <p>数据频率：日度收盘</p>
        <p>免责声明：本页面仅用于研究和信息展示，不构成投资建议。技术指标基于历史价格计算，不保证未来走势。</p>
      </div>
    </footer>
  );
}
