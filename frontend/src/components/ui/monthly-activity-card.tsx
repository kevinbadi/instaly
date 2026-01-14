"use client";

import { useMemo, useState } from "react";

interface DayActivity {
  date: string;
  count: number;
}

interface MonthlyActivityCardProps {
  data?: DayActivity[];
}

export function MonthlyActivityCard({ data = [] }: MonthlyActivityCardProps) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  // Get current month data
  const { weeks, monthName, year, maxCount, totalThisMonth } = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Build activity map
    const activityMap = new Map<string, number>();
    let total = 0;
    let max = 0;
    
    data.forEach(({ date, count }) => {
      const d = new Date(date + 'T00:00:00');
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        activityMap.set(date, count);
        total += count;
        if (count > max) max = count;
      }
    });
    
    // Get first day of month and days in month
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    // Build weeks array
    const weeksArr: (Date | null)[][] = [];
    let currentWeek: (Date | null)[] = [];
    
    // Pad first week
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    // Fill in days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      currentWeek.push(date);
      
      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Pad last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeksArr.push(currentWeek);
    }
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    
    return { 
      weeks: weeksArr, 
      monthName: months[currentMonth],
      year: currentYear,
      maxCount: max,
      totalThisMonth: total,
      activityMap
    };
  }, [data]);

  // Rebuild activityMap for rendering
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    data.forEach(({ date, count }) => {
      const d = new Date(date + 'T00:00:00');
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        map.set(date, count);
      }
    });
    return map;
  }, [data]);

  const getIntensity = (count: number): number => {
    if (count === 0 || maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  const getColorClass = (intensity: number): string => {
    const colors = [
      "bg-[#161b22] border border-[#21262d]",
      "bg-[#0e4429]",
      "bg-[#006d32]",
      "bg-[#26a641]",
      "bg-[#39d353]",
    ];
    return colors[intensity] || colors[0];
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">{monthName} {year}</h3>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-400">{totalThisMonth}</span>
          <span className="text-xs text-zinc-500 ml-1">msgs</span>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((day, i) => (
          <div key={i} className="text-[10px] text-zinc-600 text-center font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 flex flex-col gap-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1 flex-1">
            {week.map((day, dayIdx) => {
              if (!day) {
                return <div key={`empty-${weekIdx}-${dayIdx}`} className="aspect-square" />;
              }
              
              const dateStr = formatDate(day);
              const count = activityMap.get(dateStr) || 0;
              const intensity = getIntensity(count);
              const isToday = formatDate(new Date()) === dateStr;
              const isFuture = day > new Date();
              
              return (
                <div
                  key={dateStr}
                  className={`aspect-square rounded-sm ${isFuture ? 'bg-transparent' : getColorClass(intensity)} 
                    ${isToday ? 'ring-1 ring-emerald-400' : ''} 
                    cursor-pointer transition-transform hover:scale-110 relative group`}
                  onMouseEnter={(e) => {
                    if (!isFuture) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ date: dateStr, count, x: rect.left + rect.width / 2, y: rect.top });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* Day number */}
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] text-zinc-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-[100] px-2 py-1 bg-[#1c2128] border border-[#30363d] rounded text-xs pointer-events-none"
          style={{ 
            left: tooltip.x,
            top: tooltip.y - 35,
            transform: 'translateX(-50%)'
          }}
        >
          <span className="font-semibold text-zinc-100">{tooltip.count}</span>
          <span className="text-zinc-400"> on {new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      )}
    </div>
  );
}



