'use client';

import { useId, useMemo, useState, type CSSProperties } from 'react';

export type ChartPoint = { label: string } & Record<string, string | number>;
export type ChartSeries = { key: string; label: string; color: string };

export function LineChart({ data, series, valueSuffix = '%' }: { data: ChartPoint[]; series: ChartSeries[]; valueSuffix?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '');
  const width = 760; const height = 270; const left = 34; const right = 14; const top = 20; const bottom = 38;
  const chartWidth = width - left - right; const chartHeight = height - top - bottom;
  const x = (index: number) => left + (data.length < 2 ? chartWidth / 2 : index * chartWidth / (data.length - 1));
  const y = (value: number) => top + chartHeight - Math.max(0, Math.min(100, value)) / 100 * chartHeight;
  const points = (key: string) => data.map((row, index) => `${x(index)},${y(Number(row[key] ?? 0))}`).join(' ');
  const area = data.length ? `${left},${top + chartHeight} ${points(series[0]?.key ?? '')} ${x(data.length - 1)},${top + chartHeight}` : '';
  return <div className="line-chart-wrap">
    <div className="chart-legend">{series.map(item => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div>
    <div className="chart-canvas">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map(item => item.label).join(', ')}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={series[0]?.color} stopOpacity=".22"/><stop offset="1" stopColor={series[0]?.color} stopOpacity="0"/></linearGradient></defs>
        {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} className="chart-grid-line"/><text x={left-8} y={y(value)+4} textAnchor="end" className="chart-axis-label">{value}</text></g>)}
        {area && <polygon points={area} fill={`url(#${gradientId})`} />}
        {series.map(item => <polyline key={item.key} points={points(item.key)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
        {data.map((row, index) => <g key={`${row.label}-${index}`} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
          <rect x={Math.max(left, x(index)-chartWidth/Math.max(data.length,1)/2)} y={top} width={chartWidth/Math.max(data.length,1)} height={chartHeight} fill="transparent" />
          {active === index && <><line x1={x(index)} x2={x(index)} y1={top} y2={top+chartHeight} className="chart-hover-line"/>{series.map(item => <circle key={item.key} cx={x(index)} cy={y(Number(row[item.key] ?? 0))} r="5" fill={item.color} stroke="var(--surface)" strokeWidth="3"/>)}</>}
          {(index === 0 || index === data.length-1 || data.length <= 8 || index % Math.ceil(data.length/7) === 0) && <text x={x(index)} y={height-10} textAnchor="middle" className="chart-axis-label">{row.label}</text>}
        </g>)}
      </svg>
      {active !== null && data[active] && <div className="chart-tooltip" style={{ insetInlineStart: `${Math.min(82, Math.max(12, x(active)/width*100))}%` }}><strong>{data[active].label}</strong>{series.map(item => <span key={item.key}><i style={{ background: item.color }}/>{item.label}<b>{data[active][item.key]}{valueSuffix}</b></span>)}</div>}
    </div>
  </div>;
}

export function DonutChart({ value, total, label, secondaryLabel, primary, secondary, format = String }: { value: number; total: number; label: string; secondaryLabel: string; primary: string; secondary: string; format?: (value: number) => string }) {
  const percent = total > 0 ? Math.round(value / total * 100) : 0;
  const style = { '--donut-value': `${percent * 3.6}deg`, '--donut-primary': primary, '--donut-secondary': secondary } as CSSProperties;
  return <div className="donut-chart"><div className="donut-ring" style={style}><div><strong>{percent}%</strong><small>{label}</small></div></div><div className="donut-legend"><span><i style={{background:primary}}/>{label}<b>{format(value)}</b></span><span><i style={{background:secondary}}/>{secondaryLabel}<b>{format(Math.max(0,total-value))}</b></span></div></div>;
}

export function ActivityHeatmap({ timestamps, locale }: { timestamps: string[]; locale: 'ar' | 'en' }) {
  const hours = Array.from({ length: 14 }, (_, index) => index + 6);
  const days = locale === 'ar' ? ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const values = useMemo(() => {
    const map = new Map<string, number>();
    for (const timestamp of timestamps) { const date = new Date(timestamp); const key = `${date.getDay()}-${date.getHours()}`; map.set(key, (map.get(key) ?? 0) + 1); }
    return map;
  }, [timestamps]);
  const max = Math.max(1, ...values.values());
  return <div className="activity-heatmap"><div className="heatmap-hours"><span/>{hours.map(hour => <span key={hour}>{hour}</span>)}</div>{days.map((day, dayIndex) => <div className="heatmap-row" key={day}><strong>{day}</strong>{hours.map(hour => { const count = values.get(`${dayIndex}-${hour}`) ?? 0; const level = count ? Math.max(1, Math.ceil(count/max*4)) : 0; return <span key={hour} data-level={level} title={`${day} ${hour}:00 — ${count} ${locale === 'ar' ? 'لقطة مرصودة' : 'observed captures'}`} />; })}</div>)}</div>;
}

export function SparkBars({ values, color = 'var(--primary)' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values);
  return <div className="spark-bars" aria-hidden="true">{values.slice(-10).map((value,index) => <i key={index} style={{height:`${Math.max(12,value/max*100)}%`,background:color}}/>)}</div>;
}
