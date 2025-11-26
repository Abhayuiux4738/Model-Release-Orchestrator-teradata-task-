import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MetricPoint } from '../types';
import { COLORS } from '../constants';

interface ChartProps {
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color: string;
  label: string;
  unit: string;
  baselineValue?: number;
  maxValue?: number;
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-lg shadow-xl animate-fade-in ring-1 ring-slate-900/5 transform transition-all duration-200">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-slate-900 font-bold font-mono text-lg" style={{ color: payload[0].stroke || payload[0].fill }}>
            {payload[0].value}
          </span>
          <span className="text-slate-500 text-xs font-medium">{unit}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const LiveChart: React.FC<ChartProps> = ({ data, dataKey, color, label, unit, baselineValue, maxValue }) => {
  const currentValue = data.length > 0 ? data[data.length - 1][dataKey] : 0;
  
  // Format display value based on unit
  const displayValue = unit === '%' 
    ? `${(Number(currentValue) * 100).toFixed(1)}%` 
    : Math.round(Number(currentValue));

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-64 flex flex-col relative overflow-hidden group hover:border-slate-300 transition-colors">
      {/* Subtle background glow effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50/50 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
      
      <div className="flex justify-between items-end mb-4 z-10">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
          {label}
        </span>
        <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight tabular-nums">
          {displayValue}
          <span className="text-sm text-slate-500 font-normal ml-1">{unit}</span>
        </span>
      </div>
      
      <div className="flex-grow w-full min-h-0 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} strokeOpacity={0.8} />
            <XAxis 
              dataKey="timeLabel" 
              tick={{ fontSize: 10, fill: '#64748b' }} 
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
              dy={5}
            />
            <YAxis 
              domain={[0, maxValue || 'auto']} 
              tick={{ fontSize: 10, fill: '#64748b' }} 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              content={<CustomTooltip unit={unit} />}
              cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
              animationDuration={300}
            />
            {baselineValue && (
               <ReferenceLine y={baselineValue} stroke={COLORS.muted} strokeDasharray="3 3" strokeOpacity={0.5} />
            )}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};