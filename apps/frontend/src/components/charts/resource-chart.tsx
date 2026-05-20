"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ResourceChart({
  data,
  dataKey,
  color = "var(--color-primary)",
  label,
}: {
  data: { time: string; value: number }[];
  dataKey: string;
  color?: string;
  label: string;
}) {
  return (
    <div className="h-36 w-full">
      <p className="mb-2 text-xs font-medium text-muted">{label}</p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" stroke="var(--color-muted)" fontSize={10} />
          <YAxis stroke="var(--color-muted)" fontSize={10} />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              color: "var(--color-foreground)",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#grad-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
