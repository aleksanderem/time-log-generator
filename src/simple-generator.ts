// Simple Time Log Generator - NO EXTERNAL API
export function generateSimpleTimeLogs(
  startDate: string,
  endDate: string,
  projects: string[],
  targetHours: number = 8
) {
  const tasks = [
    // Frontend tasks
    "Implemented responsive navigation menu with mobile-first approach",
    "Fixed cross-browser compatibility issues in CSS Grid layout",
    "Optimized React component performance using useMemo and useCallback",
    "Created reusable UI components library with proper TypeScript types",
    "Integrated API endpoints with error handling and loading states",
    "Applied accessibility improvements following WCAG 2.1 guidelines",
    "Refactored legacy jQuery code to modern React components",
    "Implemented lazy loading for images and code splitting",
    "Fixed responsive design issues on tablet breakpoints",
    "Updated component styling to match new design system",
    
    // Backend tasks
    "Developed REST API endpoints for user authentication",
    "Optimized database queries reducing load time by 40%",
    "Implemented caching layer using Redis for frequently accessed data",
    "Created data migration scripts for database schema updates",
    "Fixed memory leak in Node.js application",
    "Added input validation and sanitization to prevent SQL injection",
    "Configured CI/CD pipeline for automated deployments",
    "Implemented rate limiting to prevent API abuse",
    
    // General tasks
    "Participated in daily standup meeting to discuss sprint progress",
    "Conducted code review focusing on security best practices",
    "Updated technical documentation for API endpoints",
    "Debugged production issue causing 500 errors",
    "Participated in sprint planning and task estimation",
    "Mentored junior developer on React best practices",
    "Analyzed and fixed performance bottlenecks",
    "Wrote unit tests achieving 85% code coverage"
  ];
  
  const results = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    
    const dateStr = current.toISOString().split('T')[0];
    const isMonday = dayOfWeek === 1;
    const isFriday = dayOfWeek === 5;
    
    // Generate 3-6 tasks per day
    const taskCount = Math.floor(Math.random() * 4) + 3;
    const timeDistribution = distributeHours(targetHours, taskCount);
    
    for (let i = 0; i < taskCount; i++) {
      let taskDescription = tasks[Math.floor(Math.random() * tasks.length)];
      
      // Add project name to task
      if (projects.length > 0) {
        const project = projects[Math.floor(Math.random() * projects.length)];
        taskDescription = taskDescription.replace(/\.$/, '') + ` for ${project} project.`;
      }
      
      // Add meeting on Monday
      if (isMonday && i === 0) {
        taskDescription = "Participated in weekly team meeting to discuss project status and upcoming tasks";
      }
      
      // Add documentation/review on Friday
      if (isFriday && i === taskCount - 1) {
        taskDescription = "Updated project documentation and prepared weekly progress report";
      }
      
      results.push({
        date: dateStr,
        time: timeDistribution[i].toFixed(2),
        task: taskDescription,
        comments: ""
      });
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return results;
}

function distributeHours(total: number, count: number): number[] {
  const hours = [];
  let remaining = total;
  
  for (let i = 0; i < count - 1; i++) {
    const min = 0.25;
    const max = Math.min(3.5, remaining - (count - i - 1) * min);
    const time = min + Math.random() * (max - min);
    const rounded = Math.round(time * 4) / 4; // Round to 0.25
    
    hours.push(rounded);
    remaining -= rounded;
  }
  
  hours.push(Math.max(0.25, remaining));
  
  return hours;
}