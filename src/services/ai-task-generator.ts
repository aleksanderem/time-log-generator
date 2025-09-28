// AI Task Generator with OpenAI Integration
import { WordPressActivity } from './wordpress-analyzer';
import { TimeFormatter } from './time-formatter';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface GeneratedTask {
  date: string;
  time: string; // Decimal format like "3.57"
  task: string;
  comments: string;
  taskType?: 'wordpress' | 'screenshot' | 'custom' | 'generic';
}

export class AITaskGenerator {
  async generateTasks(
    startDate: string,
    endDate: string,
    wordpressActivities: WordPressActivity[],
    screenshots: any[],
    targetHoursPerDay: number = 8,
    excludedDays: any[] = [],
    projects: string[] = [],
    customSystemPrompt?: string,
    customActivities: any[] = []
  ): Promise<GeneratedTask[]> {
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Build context from all sources
    const context = this.buildContext(wordpressActivities, screenshots, projects);
    
    // Generate tasks for date range
    const tasks: GeneratedTask[] = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      
      // Skip weekends unless specified in excluded days
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const exception = excludedDays.find(d => d.date === dateStr);
        if (!exception || exception.targetHours === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      }
      
      // Check for excluded days
      const dayException = excludedDays.find(d => d.date === dateStr);
      if (dayException && dayException.targetHours === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      const targetHours = dayException?.targetHours || targetHoursPerDay;
      
      // Get activities for this day
      const dayActivities = wordpressActivities.filter(a => a.date === dateStr);
      const dayScreenshots = screenshots.filter(s => s.date === dateStr);
      const dayCustomActivities = customActivities.filter(a => a.date === dateStr);
      
      // Log what data we have for this day
      console.log(`Generating tasks for ${dateStr}:`, {
        wordPressActivities: dayActivities.length,
        screenshots: dayScreenshots.length,
        customActivities: dayCustomActivities.length,
        targetHours
      });
      
      // Generate tasks for this day
      const dayTasks = await this.generateDayTasks(
        dateStr,
        targetHours,
        dayActivities,
        dayScreenshots,
        dayCustomActivities,
        context,
        customSystemPrompt
      );
      
      tasks.push(...dayTasks);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return tasks;
  }
  
  private buildContext(
    activities: WordPressActivity[],
    screenshots: any[],
    projects: string[]
  ) {
    return {
      recentActivities: activities.slice(-20), // Last 20 activities
      screenshotSummaries: screenshots.map(s => s.analysis?.summary || ''),
      activeProjects: projects,
      activityTypes: [...new Set(activities.map(a => a.type))],
    };
  }
  
  private async generateDayTasks(
    date: string,
    targetHours: number,
    activities: WordPressActivity[],
    screenshots: any[],
    customActivities: any[],
    context: any,
    customSystemPrompt?: string
  ): Promise<GeneratedTask[]> {
    
    // Generate realistic time distributions with seconds
    const taskCount = Math.max(3, Math.min(6, Math.round(targetHours / 1.5)));
    const timeDistributions = TimeFormatter.distributeHours(targetHours, taskCount);
    
    const prompt = `Generate realistic developer time log entries for ${date}.
    
Target hours: ${targetHours}
WordPress activities for this day: ${JSON.stringify(activities)}
Screenshot analyses: ${JSON.stringify(screenshots)}
Custom activities for this day: ${JSON.stringify(customActivities)}
Time distributions (in decimal): ${JSON.stringify(timeDistributions)}
Number of tasks needed: ${timeDistributions.length}

CRITICAL TASK GENERATION RULES:

PRIORITY 1 - REAL ACTIVITIES (use these FIRST in this order):
1. CUSTOM ACTIVITIES: ${customActivities.length > 0 ? 'User specifically added these - MUST include them!' : 'None'}
   - If custom activity says "Client meeting about homepage redesign" → create task with that exact description
   - Custom activities have duration specified - respect it when allocating time
2. WORDPRESS ACTIVITIES: Use exact page names and modifications
3. SCREENSHOT ACTIVITIES: Use what's visible in screenshots

PRIORITY 2 - EXPAND REAL ACTIVITIES:
- If you have fewer activities than tasks needed, break them down into subtasks
- Example: "Client meeting" → "Client meeting: requirements gathering", "Meeting follow-up: documented decisions", etc.

PRIORITY 3 - GENERIC TASKS (use ONLY when no real activities):
- Use generic development tasks ONLY if there are NO custom, WordPress, or screenshot activities
- Generic tasks should still reference the project names: ${context.activeProjects.join(', ')}

SPECIAL RULES FOR CUSTOM ACTIVITIES:
${customActivities.map(a => `- "${a.description}" (${a.duration}h) - This MUST be included in the tasks!`).join('\n')}

MATCHING RULES:
- Count of tasks MUST equal ${timeDistributions.length}
- Each task MUST use the corresponding time from timeDistributions array IN ORDER
- If custom activities have specific durations, try to match them to appropriate time slots

Return ONLY a JSON array:
[{
  "time": ${timeDistributions[0]},
  "task": "Specific task based on REAL activity (custom, WP, or screenshot)",
  "comments": ""
}]`;

    // Use custom system prompt if provided, otherwise use default
    const systemPrompt = customSystemPrompt || 'You are an expert at creating realistic developer time logs based on actual work patterns. Be very specific and technical.';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API Error:', response.status, errorData);
        
        if (response.status === 500 || response.status === 503) {
          throw new Error('OpenAI service is temporarily unavailable. Please try again in a moment.');
        } else if (response.status === 401) {
          throw new Error('Invalid API key. Please check your .env file.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else {
          throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
        }
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }
      
      try {
        const tasks = JSON.parse(cleanContent);
        
        // Validate and log task generation
        console.log(`AI generated ${tasks.length} tasks for ${date}:`);
        
        const tasksWithTypes = tasks.map((task: any, index: number) => {
          // Check if task references real activities
          const referencesWP = activities.some(a => 
            task.task.toLowerCase().includes(a.project?.toLowerCase() || '') ||
            task.task.toLowerCase().includes(a.description.toLowerCase())
          );
          const referencesScreenshot = screenshots.some(s => 
            s.analysis && task.task.toLowerCase().includes(s.analysis.summary?.toLowerCase() || '')
          );
          const referencesCustom = customActivities.some(a => 
            task.task.toLowerCase().includes(a.description.toLowerCase())
          );
          
          // Determine task type
          let taskType: 'wordpress' | 'screenshot' | 'custom' | 'generic' = 'generic';
          if (referencesCustom) taskType = 'custom';
          else if (referencesWP) taskType = 'wordpress';
          else if (referencesScreenshot) taskType = 'screenshot';
          
          const flags = [];
          if (referencesCustom) flags.push('✓ Custom');
          if (referencesWP) flags.push('✓ WP');
          if (referencesScreenshot) flags.push('✓ Screenshot');
          if (flags.length === 0) flags.push('⚠️ Generic');
          
          console.log(`Task ${index + 1}: ${flags.join(' ')}`);
          
          return {
            date,
            time: task.time,
            task: task.task,
            comments: task.comments || '',
            taskType
          };
        });
        
        return tasksWithTypes;
      } catch (parseError) {
        console.error('Failed to parse AI response:', cleanContent);
        throw new Error('Invalid response format from AI');
      }
      
    } catch (error) {
      console.error('AI generation failed:', error);
      // Fallback to simple generation
      return this.generateFallbackTasks(date, targetHours, activities, context.activeProjects);
    }
  }
  
  private generateFallbackTasks(
    date: string,
    targetHours: number,
    activities: WordPressActivity[],
    projects: string[] = []
  ): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    const taskCount = Math.max(3, Math.min(6, Math.round(targetHours / 1.5)));
    const timeDistribution = TimeFormatter.distributeHours(targetHours, taskCount);
    
    // If we have WordPress activities, use them
    if (activities.length > 0) {
      activities.forEach((activity, index) => {
        if (index < taskCount) {
          tasks.push({
            date,
            time: TimeFormatter.formatForCSV(timeDistribution[index]),
            task: activity.description,
            comments: '',
            taskType: 'wordpress' as const
          });
        }
      });
    }
    
    // Fill remaining with context-aware tasks
    while (tasks.length < taskCount) {
      const projectName = projects[0] || 'the project';
      const templates = [
        `Continued development on ${projectName} frontend components`,
        `Fixed responsive design issues on ${projectName}`,
        `Implemented API integration for ${projectName}`,
        `Code review and refactoring for ${projectName}`,
        `Updated ${projectName} documentation`,
        `Testing ${projectName} cross-browser compatibility`
      ];
      
      tasks.push({
        date,
        time: TimeFormatter.formatForCSV(timeDistribution[tasks.length]),
        task: templates[tasks.length % templates.length],
        comments: '',
        taskType: 'generic' as const
      });
    }
    
    return tasks;
  }
}