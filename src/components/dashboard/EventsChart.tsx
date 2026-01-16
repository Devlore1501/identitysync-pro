import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { time: "00:00", events: 1200, synced: 1180 },
  { time: "04:00", events: 800, synced: 795 },
  { time: "08:00", events: 2400, synced: 2380 },
  { time: "12:00", events: 4800, synced: 4750 },
  { time: "16:00", events: 5200, synced: 5150 },
  { time: "20:00", events: 3800, synced: 3760 },
  { time: "24:00", events: 2200, synced: 2180 },
];

export const EventsChart = () => {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Events Overview</h3>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Collected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-sm text-muted-foreground">Synced</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(173 80% 45%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(173 80% 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="syncGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(185 85% 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(185 85% 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(215 20% 55%)', fontSize: 12 }}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(222 47% 9%)',
                border: '1px solid hsl(217 33% 15%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: 'hsl(210 40% 98%)' }}
              itemStyle={{ color: 'hsl(210 40% 98%)' }}
            />
            <Area
              type="monotone"
              dataKey="events"
              stroke="hsl(173 80% 45%)"
              strokeWidth={2}
              fill="url(#eventGradient)"
            />
            <Area
              type="monotone"
              dataKey="synced"
              stroke="hsl(185 85% 50%)"
              strokeWidth={2}
              fill="url(#syncGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
