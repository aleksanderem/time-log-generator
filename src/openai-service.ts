// OpenAI Service for real AI analysis
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

if (!OPENAI_API_KEY) {
  console.warn('⚠️ No OpenAI API key found. Add VITE_OPENAI_API_KEY to your .env file');
}

// Convert and resize image to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 1024px width
        const canvas = document.createElement('canvas');
        const maxWidth = 1024;
        const scale = maxWidth / img.width;
        
        canvas.width = img.width > maxWidth ? maxWidth : img.width;
        canvas.height = img.width > maxWidth ? img.height * scale : img.height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 with quality compression
        canvas.toBlob((blob) => {
          if (blob) {
            const reader2 = new FileReader();
            reader2.onloadend = () => {
              const base64 = reader2.result as string;
              resolve(base64.split(',')[1]);
            };
            reader2.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.8); // 80% quality
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Analyze screenshot with OpenAI Vision
export async function analyzeScreenshotWithAI(file: File) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Add VITE_OPENAI_API_KEY to your .env file');
  }

  const base64Image = await fileToBase64(file);
  
  const response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing work-related screenshots. 
          Analyze the screenshot and extract:
          1. Platform (Teams, Slack, Email, Calendar, IDE, Browser, WordPress, etc.)
          2. Activity type (meeting, chat, coding, debugging, planning, content editing, etc.)
          3. Date visible in the screenshot (format: YYYY-MM-DD) - IMPORTANT: Look for any date indicators, timestamps, calendar dates
          4. Project names or website names mentioned - IMPORTANT: Look for:
             - Website/domain names (e.g., "buspatrol.com", "mwtsolutions.com")
             - Page titles (e.g., "Home page", "About Us", "Contact")
             - Project names in conversations or code
             - Repository names
             - Any proper nouns that could be project names
          5. Brief summary of the work being done
          6. Key technical details or topics
          
          Return ONLY valid JSON in this exact format:
          {
            "platform": "string",
            "activityType": "string", 
            "date": "YYYY-MM-DD or null if not found",
            "projects": ["array of project/website names found"],
            "summary": "detailed work description",
            "topics": ["array of key topics"]
          }`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this screenshot and tell me what work activity is shown:'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    // First try to parse as plain JSON
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Failed to parse JSON from markdown:', e);
      }
    }
    
    // If not valid JSON, return structured data
    return {
      platform: 'Unknown',
      activityType: 'work',
      summary: content,
      topics: []
    };
  }
}

// Generate realistic tasks with AI
export async function generateTasksWithAI(context: {
  date: string;
  targetHours: number;
  projects: string[];
  communications: any[];
  recentScreenshots?: any[];
}) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  const dayOfWeek = new Date(context.date).toLocaleDateString('en', { weekday: 'long' });
  
  const prompt = `Generate realistic developer time log entries for ${dayOfWeek}, ${context.date}.
  
  Context:
  - Target hours: ${context.targetHours}
  - Active projects: ${context.projects.join(', ') || 'General development'}
  - Recent communications: ${context.communications.map(c => c.content).join('; ') || 'None'}
  
  Generate ${Math.ceil(context.targetHours / 1.5)} detailed, specific tasks that a developer would actually do.
  
  Requirements:
  - Be very specific (e.g., "Implemented user authentication with JWT tokens" not just "Worked on authentication")
  - Include realistic time allocations (0.5-3 hours per task)
  - Mix different types of work (coding, debugging, meetings, code review, etc.)
  - Reference the actual projects when relevant
  - Total time should equal ${context.targetHours} hours
  - Tasks should be believable for a ${dayOfWeek}
  
  Return as JSON array with format:
  [{
    "description": "specific task description",
    "timeHours": 1.5,
    "category": "frontend|backend|debugging|testing|meeting|review|planning",
    "project": "project name if applicable"
  }]`;

  const response = await fetch(`${API_BASE_URL}/api/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating realistic developer time logs. Be specific and technical.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const tasks = JSON.parse(content);
    return {
      tasks: tasks.map((task: any) => ({
        description: task.description,
        timeHours: task.timeHours,
        category: task.category || 'development',
        complexity: task.timeHours > 2 ? 'high' : task.timeHours > 1 ? 'medium' : 'low',
        reasoning: 'AI generated based on context'
      })),
      qualityScore: 95,
      totalHours: tasks.reduce((sum: number, t: any) => sum + t.timeHours, 0),
      dayTheme: 'AI-generated realistic workday'
    };
  } catch (e) {
    console.error('Failed to parse AI response:', e);
    throw new Error('Failed to generate tasks with AI');
  }
}