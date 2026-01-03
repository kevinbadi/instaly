"use client";

import { useMemo, useState } from "react";

interface DayActivity {
  date: string;
  count: number;
}

interface ActivityHeatmapProps {
  data?: DayActivity[];
}

export function ActivityHeatmap({ data = [] }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  // Process data into a map and calculate stats
  const { activityData, maxCount, totalMessages } = useMemo(() => {
    const dataMap = new Map<string, number>();
    let max = 0;
    let total = 0;
    
    data.forEach(({ date, count }) => {
      dataMap.set(date, count);
      if (count > max) max = count;
      total += count;
    });
    
    return { activityData: dataMap, maxCount: max, totalMessages: total };
  }, [data]);

  // Generate 52 weeks (364 days) ending on the current day
  const { weeks, monthPositions } = useMemo(() => {
    const today = new Date();
    const weeksArr: (Date | null)[][] = [];
    const monthPos: { name: string; col: number }[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Calculate start date (52 weeks ago, aligned to Sunday)
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    // Adjust to previous Sunday
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);
    
    let currentDate = new Date(startDate);
    let lastMonth = -1;
    
    // Generate 53 weeks to ensure we cover full year
    for (let week = 0; week < 53; week++) {
      const weekDays: (Date | null)[] = [];
      
      for (let day = 0; day < 7; day++) {
        const cellDate = new Date(currentDate);
        
        // Track month changes for labels
        if (day === 0 && cellDate.getMonth() !== lastMonth) {
          monthPos.push({ name: months[cellDate.getMonth()], col: week });
          lastMonth = cellDate.getMonth();
        }
        
        // Only include dates up to today
        if (cellDate <= today) {
          weekDays.push(cellDate);
        } else {
          weekDays.push(null);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeksArr.push(weekDays);
    }
    
    return { weeks: weeksArr, monthPositions: monthPos };
  }, []);

  // Get intensity level (0-4) based on count
  const getIntensity = (count: number): number => {
    if (count === 0 || maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  };

  // Get color classes based on intensity
  const getColorClass = (intensity: number): string => {
    const colors = [
      "bg-[#161b22] border border-[#21262d]", // 0 - empty
      "bg-[#0e4429]", // 1 - low
      "bg-[#006d32]", // 2 - medium-low  
      "bg-[#26a641]", // 3 - medium-high
      "bg-[#39d353]", // 4 - high
    ];
    return colors[intensity] || colors[0];
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleMouseEnter = (e: React.MouseEvent, date: Date, count: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      date: formatDate(date),
      count,
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  return (
    <div className="relative">
      {/* Month labels row */}
      <div className="flex ml-9 mb-2 pr-1">
        <div className="flex-1 flex">
          {weeks.map((week, weekIdx) => {
            // Find if this week starts a new month
            const monthLabelIdx = monthPositions.findIndex(m => m.col === weekIdx);
            const monthLabel = monthLabelIdx >= 0 ? monthPositions[monthLabelIdx] : null;
            
            // Skip if too close to previous label (less than 4 weeks apart)
            const prevMonth = monthLabelIdx > 0 ? monthPositions[monthLabelIdx - 1] : null;
            const showLabel = monthLabel && (!prevMonth || (monthLabel.col - prevMonth.col) >= 4);
            
            return (
              <div key={weekIdx} className="flex-1 min-w-0">
                {showLabel && (
                  <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap">
                    {monthLabel.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex">
        {/* Day labels */}
        <div className="flex flex-col text-[10px] text-zinc-500 pr-2 w-7 shrink-0">
          <span className="h-[12px]"></span>
          <span className="h-[12px] leading-[12px]">Mon</span>
          <span className="h-[12px]"></span>
          <span className="h-[12px] leading-[12px]">Wed</span>
          <span className="h-[12px]"></span>
          <span className="h-[12px] leading-[12px]">Fri</span>
          <span className="h-[12px]"></span>
        </div>

        {/* Grid container - fills available width */}
        <div className="flex-1 flex justify-between">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-[2px]">
              {week.map((day, dayIdx) => {
                if (!day) {
                  return (
                    <div 
                      key={`empty-${weekIdx}-${dayIdx}`} 
                      className="w-[12px] h-[12px] rounded-sm bg-transparent"
                    />
                  );
                }
                
                const dateStr = formatDate(day);
                const count = activityData.get(dateStr) || 0;
                const intensity = getIntensity(count);
                
                return (
                  <div
                    key={dateStr}
                    className={`w-[12px] h-[12px] rounded-sm ${getColorClass(intensity)} cursor-pointer transition-all hover:scale-125 hover:z-10`}
                    onMouseEnter={(e) => handleMouseEnter(e, day, count)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div 
          className="fixed z-[100] px-3 py-2 bg-[#1c2128] border border-[#30363d] rounded-md shadow-xl text-xs pointer-events-none"
          style={{ 
            left: tooltip.x,
            top: tooltip.y - 50,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-semibold text-zinc-100">
            {tooltip.count} {tooltip.count === 1 ? 'message' : 'messages'}
          </div>
          <div className="text-zinc-400">
            {formatDisplayDate(tooltip.date)}
          </div>
        </div>
      )}

      {/* Footer with stats and legend */}
      <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-500">
        <span>
          <span className="text-emerald-400 font-semibold">{totalMessages.toLocaleString()}</span>
          {' '}messages in the last year
        </span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <div className="flex gap-[2px]">
            {[0, 1, 2, 3, 4].map((level) => (
              <div 
                key={level} 
                className={`w-[10px] h-[10px] rounded-sm ${getColorClass(level)}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
