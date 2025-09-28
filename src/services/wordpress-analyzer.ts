// WordPress Activity Analyzer
export interface WordPressActivity {
  date: string;
  type: string;
  description: string;
  project?: string;
  duration?: number;
}

export class WordPressAnalyzer {
  // Extract project names from WordPress output
  extractProjects(output: string): string[] {
    const projects = new Set<string>();
    
    // First check if the output contains JSON objects
    const jsonMatches = output.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (jsonMatches) {
      jsonMatches.forEach(jsonStr => {
        try {
          const item = JSON.parse(jsonStr);
          if ((item.type === 'page_creation' || item.type === 'page_modification') && item.title) {
            projects.add(item.title);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
    }
    
    // If no JSON found or no projects extracted, try full JSON parse
    if (projects.size === 0) {
      try {
        const data = JSON.parse(output);
        
        // Handle both formats: array directly or object with activities property
        let items: any[] = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data.activities && Array.isArray(data.activities)) {
          items = data.activities;
        } else if (data.type && data.title) {
          // Single item
          items = [data];
        }
        
        items.forEach(item => {
          if ((item.type === 'page_creation' || item.type === 'page_modification') && item.title) {
            projects.add(item.title);
          }
        });
      } catch {
        // Fallback to text parsing if not JSON
        const lines = output.split('\n');
        lines.forEach(line => {
          if (line.includes('page_creation') || line.includes('page_modification')) {
            // Extract page/post title after "Page:" or "Post:"
            const titleMatch = line.match(/(?:Page|Post):\s*(.+?)(?:\s*-|$)/);
            if (titleMatch && titleMatch[1]) {
              const title = titleMatch[1].trim();
              if (title) projects.add(title);
            }
          }
        });
      }
    }
    
    return Array.from(projects);
  }
  
  parseWordPressOutput(output: string): WordPressActivity[] {
    const activities: WordPressActivity[] = [];
    
    try {
      // Try to parse as JSON first
      const data = JSON.parse(output);
      
      // Handle both formats: array directly or object with activities property
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.activities && Array.isArray(data.activities)) {
        items = data.activities;
      } else if (data.type && data.title) {
        // Single item
        items = [data];
      }
      
      items.forEach(item => {
        if (item.type && item.title && (item.date || item.day)) {
          activities.push({
            date: (item.date || item.day).split(' ')[0], // Extract just the date part
            type: item.type,
            description: `${item.type.replace(/_/g, ' ')}: ${item.title}`,
            project: item.title,
            duration: item.estimated_time || 0
          });
        }
      });
    } catch {
      // Fallback to text parsing if not JSON
      const lines = output.split('\n');
      
      lines.forEach(line => {
        // Post updates
        if (line.includes('Post updated:') || line.includes('Page updated:')) {
          const match = line.match(/(\d{4}-\d{2}-\d{2}) - (Post|Page) updated: (.+)/);
          if (match) {
            activities.push({
              date: match[1],
              type: 'content_update',
              description: `Updated ${match[2].toLowerCase()}: ${match[3]}`,
            });
          }
        }
        
        // Plugin/theme updates
        if (line.includes('Plugin activated:') || line.includes('Theme activated:')) {
          const match = line.match(/(\d{4}-\d{2}-\d{2}) - (Plugin|Theme) activated: (.+)/);
          if (match) {
            activities.push({
              date: match[1],
              type: 'configuration',
              description: `Activated ${match[2].toLowerCase()}: ${match[3]}`,
            });
          }
        }
        
        // Media uploads
        if (line.includes('Media uploaded:')) {
          const match = line.match(/(\d{4}-\d{2}-\d{2}) - Media uploaded: (.+)/);
          if (match) {
            activities.push({
              date: match[1],
              type: 'media',
              description: `Uploaded media: ${match[2]}`,
            });
          }
        }
      });
    }
    
    return activities;
  }
  
  groupActivitiesByDate(activities: WordPressActivity[]): Map<string, WordPressActivity[]> {
    const grouped = new Map<string, WordPressActivity[]>();
    
    activities.forEach(activity => {
      const existing = grouped.get(activity.date) || [];
      existing.push(activity);
      grouped.set(activity.date, existing);
    });
    
    return grouped;
  }
}