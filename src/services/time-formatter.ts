// Time Formatter Service
export class TimeFormatter {
  // Convert decimal hours to "Xh Ym Zs" format
  static toHoursMinutesSeconds(decimalHours: number): string {
    const totalSeconds = Math.round(decimalHours * 3600);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (seconds > 0) result += `${seconds}s`;
    
    return result.trim() || '0s';
  }
  
  // Parse time from various formats
  static parseTime(input: string): number {
    // Handle "2h 30m 15s" format
    const hoursMinutesSeconds = input.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/);
    if (hoursMinutesSeconds) {
      const hours = parseInt(hoursMinutesSeconds[1] || '0');
      const minutes = parseInt(hoursMinutesSeconds[2] || '0');
      const seconds = parseInt(hoursMinutesSeconds[3] || '0');
      return hours + (minutes / 60) + (seconds / 3600);
    }
    
    // Handle decimal format
    const decimal = input.match(/(\d+\.?\d*)h?/);
    if (decimal) {
      return parseFloat(decimal[1]);
    }
    
    return 0;
  }
  
  // Format for CSV output - keep decimal for CSV compatibility
  static formatForCSV(hours: number): string {
    return hours.toFixed(2);
  }
  
  // Generate realistic non-rounded time distributions
  static distributeHours(totalHours: number, taskCount: number): number[] {
    const distributions = [];
    let remaining = totalHours;
    
    for (let i = 0; i < taskCount - 1; i++) {
      // Generate realistic task durations with random seconds
      const min = 0.5;
      const max = Math.min(4, remaining - (taskCount - i - 1) * min);
      
      // Add random seconds for realism (0-59 seconds)
      const randomSeconds = Math.random() * 59 / 3600;
      const hours = min + Math.random() * (max - min) + randomSeconds;
      
      distributions.push(hours);
      remaining -= hours;
    }
    
    // Last task gets remaining time
    distributions.push(Math.max(0.25, remaining));
    
    return distributions;
  }
}