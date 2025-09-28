import React, { useState } from 'react';
import { Calendar, Clock, FileText, Download, Plus, Trash2, Eye, Brain, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { analyzeScreenshotWithAI, generateTasksWithAI } from './src/openai-service';

const EnhancedTimeLogGenerator = () => {
  const [config, setConfig] = useState({
    startDate: '',
    endDate: '',
    excludedDays: [],
    currentProjects: [],
    teamCommunications: [],
    targetHoursPerDay: 8,
    timeFormat: 'minutes',
    excludedDayInput: '',
    excludedDayHours: 0
  });
  
  const [generatedLogs, setGeneratedLogs] = useState([]);
  const [uploadedScreenshots, setUploadedScreenshots] = useState([]);
  const [screenshotAnalyzing, setScreenshotAnalyzing] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generationQuality, setGenerationQuality] = useState(null);
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [useRealAI, setUseRealAI] = useState(true);

  // Fallback analysis by filename
  const analyzeByFilename = async (file) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const fileName = file.name.toLowerCase();
    let analysis = {
      platform: 'Unknown',
      summary: 'Team communication screenshot',
      confidence: 60,
      activityType: 'communication'
    };
    
    if (fileName.includes('teams')) {
      analysis = {
        platform: 'Microsoft Teams',
        summary: fileName.includes('call') 
          ? 'Teams video call discussion about project coordination and development progress'
          : 'Teams chat communication regarding bug fixes and implementation details',
        confidence: 85,
        activityType: fileName.includes('call') ? 'meeting' : 'chat'
      };
    } else if (fileName.includes('slack')) {
      analysis = {
        platform: 'Slack',
        summary: 'Slack channel discussion about code review and deployment strategy',
        confidence: 80,
        activityType: 'chat'
      };
    } else if (fileName.includes('email') || fileName.includes('mail')) {
      analysis = {
        platform: 'Email',
        summary: 'Email communication regarding project requirements and delivery timeline',
        confidence: 75,
        activityType: 'email'
      };
    } else if (fileName.includes('calendar')) {
      analysis = {
        platform: 'Calendar',
        summary: 'Calendar view showing project deadlines and team meeting schedule',
        confidence: 85,
        activityType: 'planning'
      };
    }
    
    return analysis;
  };

  // AI Screenshot Analysis
  const analyzeScreenshot = async (file) => {
    setScreenshotAnalyzing(true);
    setAiError(null);
    
    try {
      let analysis;
      
      if (useRealAI && import.meta.env.VITE_OPENAI_API_KEY) {
        // Use real AI analysis
        try {
          const aiResult = await analyzeScreenshotWithAI(file);
          analysis = {
            platform: aiResult.platform || 'Unknown',
            summary: aiResult.summary || aiResult.description || 'Work activity',
            confidence: 95,
            activityType: aiResult.activityType || 'work',
            topics: aiResult.topics || []
          };
        } catch (aiError) {
          console.error('AI analysis failed:', aiError);
          setAiError('AI analysis failed. Using fallback mode.');
          // Fallback to filename analysis
          analysis = await analyzeByFilename(file);
        }
      } else {
        // Fallback to filename analysis
        analysis = await analyzeByFilename(file);
      }
      
      setPendingAnalysis({
        file: file,
        fileName: file.name,
        analysis: analysis,
        extractedDate: new Date().toISOString().split('T')[0]
      });
      
      setShowAnalysisModal(true);
      
    } catch (error) {
      console.error('Analysis error:', error);
      setAiError('Failed to analyze screenshot');
    } finally {
      setScreenshotAnalyzing(false);
    }
  };

  // Handle screenshot upload
  const handleScreenshotUpload = (event) => {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const newScreenshot = {
          id: Date.now() + Math.random(),
          file: file,
          name: file.name,
          preview: URL.createObjectURL(file)
        };
        
        setUploadedScreenshots(prev => [...prev, newScreenshot]);
        analyzeScreenshot(file);
      }
    });
    
    event.target.value = '';
  };

  // Confirm analysis and add to communications
  const confirmAnalysis = (editedContent, editedDate) => {
    if (pendingAnalysis) {
      setConfig(prev => ({
        ...prev,
        teamCommunications: [...prev.teamCommunications, {
          id: Date.now(),
          date: editedDate,
          content: editedContent,
          type: 'screenshot_analyzed',
          source: 'ai_analysis',
          fileName: pendingAnalysis.fileName,
          confidence: pendingAnalysis.analysis.confidence,
          platform: pendingAnalysis.analysis.platform
        }]
      }));
      
      setPendingAnalysis(null);
      setShowAnalysisModal(false);
    }
  };

  // Generate AI-enhanced tasks
  const generateAITasks = async (context) => {
    // Use real AI if available
    if (useRealAI && import.meta.env.VITE_OPENAI_API_KEY) {
      try {
        return await generateTasksWithAI(context);
      } catch (error) {
        console.error('Real AI generation failed:', error);
        setAiError('AI generation failed. Using fallback mode.');
        // Fall back to simulation
      }
    }
    
    // Fallback simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const taskCategories = ['frontend', 'backend', 'debugging', 'testing', 'review', 'meetings', 'planning'];
    const complexities = ['low', 'medium', 'high'];
    
    const templates = {
      frontend: [
        'Implemented new UI components with responsive design',
        'Updated component styling and animations',
        'Integrated API endpoints with frontend',
        'Optimized React component performance',
        'Fixed layout issues across different screen sizes',
        'Implemented form validation and error handling',
        'Added accessibility features to UI components'
      ],
      backend: [
        'Developed REST API endpoints',
        'Optimized database queries for performance',
        'Implemented authentication middleware',
        'Created data migration scripts',
        'Updated server configuration for deployment',
        'Implemented caching layer for API responses',
        'Fixed security vulnerabilities in API'
      ],
      debugging: [
        'Investigated and fixed production bug',
        'Resolved performance bottlenecks',
        'Debugged cross-browser compatibility issues',
        'Fixed memory leaks in application',
        'Resolved race condition in async operations',
        'Tracked down and fixed edge case errors',
        'Debugged WebSocket connection issues'
      ],
      testing: [
        'Wrote unit tests for new features',
        'Created integration test suite',
        'Performed manual testing of user flows',
        'Updated test coverage for critical paths',
        'Fixed failing CI/CD tests',
        'Implemented E2E tests with Cypress',
        'Reviewed and improved test coverage'
      ],
      review: [
        'Conducted code review for pull requests',
        'Updated technical documentation',
        'Reviewed and refactored legacy code',
        'Created architecture documentation',
        'Analyzed and documented API changes',
        'Reviewed security best practices',
        'Updated deployment documentation'
      ],
      meetings: [
        'Participated in daily standup meeting',
        'Attended sprint planning session',
        'Led technical discussion meeting',
        'Participated in code review session',
        'Attended project status meeting',
        'Conducted knowledge sharing session',
        'Participated in architecture review'
      ],
      planning: [
        'Created technical specifications',
        'Estimated tasks for sprint planning',
        'Researched implementation approaches',
        'Created project roadmap',
        'Analyzed technical requirements',
        'Planned refactoring strategy',
        'Designed system architecture'
      ]
    };
    
    // Analyze context for intelligent task generation
    const dayOfWeek = new Date(context.date).getDay();
    const isMonday = dayOfWeek === 1;
    const isFriday = dayOfWeek === 5;
    
    // Adjust task distribution based on day
    let categoryWeights = {
      frontend: 25,
      backend: 25,
      debugging: 15,
      testing: 10,
      review: 10,
      meetings: 10,
      planning: 5
    };
    
    if (isMonday) {
      categoryWeights.meetings += 10;
      categoryWeights.planning += 5;
    }
    
    if (isFriday) {
      categoryWeights.review += 10;
      categoryWeights.testing += 5;
    }
    
    // Consider communications context
    const recentCommunications = context.communications || [];
    if (recentCommunications.some(comm => comm.content.toLowerCase().includes('bug') || comm.content.toLowerCase().includes('fix'))) {
      categoryWeights.debugging += 15;
    }
    
    if (recentCommunications.some(comm => comm.content.toLowerCase().includes('meeting') || comm.content.toLowerCase().includes('call'))) {
      categoryWeights.meetings += 10;
    }
    
    // Generate tasks with realistic distribution
    const tasks = [];
    const targetHours = context.targetHours;
    
    // Determine task count based on realistic patterns
    let taskCount;
    if (targetHours <= 4) {
      taskCount = 2 + Math.floor(Math.random() * 2); // 2-3 tasks
    } else if (targetHours <= 6) {
      taskCount = 3 + Math.floor(Math.random() * 2); // 3-4 tasks
    } else {
      taskCount = 4 + Math.floor(Math.random() * 3); // 4-6 tasks
    }
    
    // Generate morning standup if it's a working day
    if (targetHours >= 6 && Math.random() > 0.3) {
      tasks.push({
        description: 'Daily standup meeting with development team',
        timeHours: 0.25,
        category: 'meetings',
        complexity: 'low',
        reasoning: 'Regular team synchronization'
      });
    }
    
    // Generate main tasks
    const remainingHours = targetHours - tasks.reduce((sum, task) => sum + task.timeHours, 0);
    const mainTaskCount = taskCount - tasks.length;
    
    for (let i = 0; i < mainTaskCount; i++) {
      // Select category based on weights
      const category = selectWeightedCategory(categoryWeights);
      const complexity = selectComplexity(category, i === 0); // First task often more complex
      const templateTasks = templates[category];
      const baseTask = templateTasks[Math.floor(Math.random() * templateTasks.length)];
      
      let description = baseTask;
      
      // Add project context
      if (context.projects.length > 0 && category !== 'meetings') {
        const projectIndex = i % context.projects.length;
        const project = context.projects[projectIndex];
        description = description.replace(/\b(for|in|on)\b.*?(?=\s|$)/, '');
        description += ` for ${project} project`;
      }
      
      // Add communication context
      if (recentCommunications.length > 0 && Math.random() > 0.6) {
        const comm = recentCommunications[Math.floor(Math.random() * recentCommunications.length)];
        if (comm.platform && Math.random() > 0.5) {
          description += ` (discussed in ${comm.platform})`;
        }
      }
      
      // Calculate realistic time
      const baseTime = complexity === 'high' ? 2.5 : complexity === 'medium' ? 1.5 : 0.75;
      const timeVariation = (Math.random() - 0.5) * 0.5;
      let timeHours = Math.max(0.25, baseTime + timeVariation);
      
      // Ensure we don't exceed remaining hours
      const remainingForThisTask = remainingHours - (mainTaskCount - i - 1) * 0.5;
      timeHours = Math.min(timeHours, remainingForThisTask);
      
      tasks.push({
        description,
        timeHours,
        category,
        complexity,
        reasoning: generateReasoning(category, complexity)
      });
    }
    
    // Fine-tune times to match target
    const currentTotal = tasks.reduce((sum, task) => sum + task.timeHours, 0);
    if (Math.abs(currentTotal - targetHours) > 0.25) {
      const ratio = targetHours / currentTotal;
      tasks.forEach(task => {
        task.timeHours = Math.round(task.timeHours * ratio * 4) / 4; // Round to nearest 15 minutes
      });
    }
    
    // Sort tasks by typical daily flow
    const categoryOrder = ['meetings', 'planning', 'frontend', 'backend', 'debugging', 'testing', 'review'];
    tasks.sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.category);
      const bIndex = categoryOrder.indexOf(b.category);
      return aIndex - bIndex;
    });
    
    return {
      tasks,
      qualityScore: calculateQualityScore(tasks, context),
      totalHours: tasks.reduce((sum, task) => sum + task.timeHours, 0),
      dayTheme: generateDayTheme(tasks)
    };
  };
  
  // Helper functions
  const selectWeightedCategory = (weights) => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * total;
    
    for (const [category, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) return category;
    }
    
    return 'frontend'; // fallback
  };
  
  const selectComplexity = (category, isFirst) => {
    if (category === 'meetings') return 'low';
    if (isFirst && Math.random() > 0.3) return 'high';
    
    const rand = Math.random();
    if (rand < 0.3) return 'low';
    if (rand < 0.7) return 'medium';
    return 'high';
  };
  
  const generateReasoning = (category, complexity) => {
    const reasonings = {
      frontend: ['UI improvements needed', 'User experience enhancement', 'Interface updates required'],
      backend: ['API functionality required', 'System optimization needed', 'Data processing improvements'],
      debugging: ['Critical issue resolution', 'System stability improvement', 'Bug prevention'],
      testing: ['Quality assurance required', 'Test coverage improvement', 'Regression prevention'],
      review: ['Code quality maintenance', 'Knowledge sharing', 'Best practices enforcement'],
      meetings: ['Team coordination', 'Project alignment', 'Communication requirement'],
      planning: ['Strategic planning needed', 'Technical design required', 'Project organization']
    };
    
    const complexityPrefix = complexity === 'high' ? 'Critical' : complexity === 'medium' ? 'Important' : 'Regular';
    return `${complexityPrefix} ${reasonings[category][Math.floor(Math.random() * reasonings[category].length)]}`;
  };
  
  const calculateQualityScore = (tasks, context) => {
    let score = 70;
    
    // Task variety bonus
    const categories = new Set(tasks.map(t => t.category));
    score += Math.min(categories.size * 5, 20);
    
    // Time distribution bonus
    const avgTime = tasks.reduce((sum, t) => sum + t.timeHours, 0) / tasks.length;
    if (avgTime >= 0.75 && avgTime <= 2) score += 10;
    
    // Context integration bonus
    if (context.projects.length > 0) score += 5;
    if (context.communications.length > 0) score += 5;
    
    return Math.min(score, 95);
  };
  
  const generateDayTheme = (tasks) => {
    const categories = tasks.map(t => t.category);
    const primaryCategory = categories.reduce((acc, cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    
    const dominant = Object.entries(primaryCategory).sort((a, b) => b[1] - a[1])[0][0];
    
    const themes = {
      frontend: 'UI/UX Development Focus',
      backend: 'Backend Development Day',
      debugging: 'Bug Fixing and Debugging',
      testing: 'Quality Assurance Focus',
      review: 'Code Review and Documentation',
      meetings: 'Collaboration and Planning',
      planning: 'Strategic Planning Day'
    };
    
    return themes[dominant] || 'Balanced Development Work';
  };

  // Main generation function
  const generateEnhancedTimeLogs = async () => {
    if (!config.startDate || !config.endDate) {
      alert('Please enter start and end dates');
      return;
    }

    setAiGenerating(true);
    
    try {
      const workingDays = generateWorkingDays(config.startDate, config.endDate, config.excludedDays);
      let allLogs = [];
      
      for (const day of workingDays) {
        const dayException = config.excludedDays.find(exc => exc.date === day);
        const targetHours = dayException?.targetHours ?? config.targetHoursPerDay;
        
        // Skip days with 0 hours (excluded days)
        if (dayException && dayException.targetHours === 0) {
          continue;
        }
        
        const context = {
          date: day,
          targetHours,
          projects: config.currentProjects,
          communications: config.teamCommunications.filter(comm => {
            const commDate = new Date(comm.date);
            const dayDate = new Date(day);
            const diffDays = Math.abs((dayDate - commDate) / (1000 * 60 * 60 * 24));
            return diffDays <= 3;
          }),
          isCustomHours: !!dayException
        };
        
        const aiResult = await generateAITasks(context);
        
        const dayLogs = aiResult.tasks.map(task => ({
          day: day,
          time: task.timeHours,
          task: task.description,
          comments: `${task.category} (${task.complexity}) - ${task.reasoning}`,
          aiGenerated: true,
          category: task.category,
          complexity: task.complexity,
          isCustomDay: !!dayException
        }));
        
        allLogs.push(...dayLogs);
      }
      
      allLogs.sort((a, b) => new Date(a.day) - new Date(b.day));
      setGeneratedLogs(allLogs);
      
      // Quality analysis
      const quality = analyzeLogQuality(allLogs);
      setGenerationQuality(quality);
      
    } catch (error) {
      console.error('Generation error:', error);
      alert('Error occurred during generation. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Quality analysis
  const analyzeLogQuality = (logs) => {
    const analysis = {
      totalTasks: logs.length,
      totalHours: logs.reduce((sum, log) => sum + log.time, 0),
      taskVariety: new Set(),
      qualityScore: 75,
      issues: []
    };
    
    logs.forEach(log => {
      analysis.taskVariety.add(log.category || 'general');
    });
    
    if (analysis.taskVariety.size >= 3) analysis.qualityScore += 15;
    if (analysis.totalTasks >= 3 && analysis.totalTasks <= 6) analysis.qualityScore += 10;
    
    analysis.avgTaskLength = analysis.totalHours / analysis.totalTasks;
    
    return analysis;
  };

  // Helper functions
  const generateWorkingDays = (startDate, endDate, excludedDays) => {
    const days = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateString = current.toISOString().split('T')[0];
      
      // Check if it's a weekday (Mon-Fri)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(dateString);
      }
      
      // Also include excluded days with custom hours (they might be weekends with work)
      const excludedDay = excludedDays.find(excluded => excluded.date === dateString);
      if (excludedDay && excludedDay.targetHours > 0 && !days.includes(dateString)) {
        days.push(dateString);
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };
  
  const addExcludedDay = () => {
    if (config.excludedDayInput && config.excludedDayHours >= 0) {
      const newExcludedDay = {
        date: config.excludedDayInput,
        targetHours: config.excludedDayHours
      };
      
      setConfig(prev => ({
        ...prev,
        excludedDays: [...prev.excludedDays.filter(d => d.date !== config.excludedDayInput), newExcludedDay],
        excludedDayInput: '',
        excludedDayHours: 0
      }));
    }
  };
  
  const removeExcludedDay = (date) => {
    setConfig(prev => ({
      ...prev,
      excludedDays: prev.excludedDays.filter(d => d.date !== date)
    }));
  };

  const formatTime = (hours) => {
    if (config.timeFormat === 'minutes') {
      const totalMinutes = Math.round(hours * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h === 0) return `${m}m`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}m`;
    }
    return `${hours.toFixed(2)}h`;
  };

  const exportToCSV = () => {
    const header = 'Day,Time,Task,Comments,AI Generated,Category\n';
    const rows = generatedLogs.map(log => 
      `${log.day},"${formatTime(log.time)}","${log.task.replace(/"/g, '""')}","${log.comments.replace(/"/g, '""')}",${log.aiGenerated ? 'Yes' : 'No'},${log.category || 'General'}`
    ).join('\n');
    
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_time_log_${config.startDate}_${config.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
          <Brain className="w-10 h-10 text-purple-600" />
          AI Time Log Generator
        </h1>
        <p className="text-gray-600 text-lg">AI-powered screenshot analysis & intelligent task generation</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          
          {/* AI Screenshot Analysis */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Eye className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-purple-900">AI Screenshot Analysis</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-2">🤖 Features:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Platform Detection</strong> - Teams, Slack, Email, Calendar</li>
                  <li>• <strong>Content Analysis</strong> - Extracts meeting/chat context</li>
                  <li>• <strong>Smart Task Generation</strong> - Creates relevant work items</li>
                  <li>• <strong>Confidence Scoring</strong> - Shows analysis reliability</li>
                </ul>
                <div className="mt-3 space-y-2">
                  {import.meta.env.VITE_OPENAI_API_KEY ? (
                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-800">
                        <strong>✅ AI Mode Active:</strong> Using OpenAI Vision for real analysis
                      </p>
                    </div>
                  ) : (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>⚠️ Demo Mode:</strong> Add VITE_OPENAI_API_KEY to .env file for real AI
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useRealAI"
                      checked={useRealAI}
                      onChange={(e) => setUseRealAI(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="useRealAI" className="text-xs text-gray-700">
                      Use Real AI (when API key available)
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  className="hidden"
                  id="screenshot-upload"
                />
                <label htmlFor="screenshot-upload" className="cursor-pointer">
                  <Brain className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                  <p className="text-purple-800 font-medium">Upload Screenshots for AI Analysis</p>
                  <p className="text-purple-600 text-sm mt-1">Teams, Slack, Calendar, Email screenshots</p>
                </label>
              </div>
              
              {screenshotAnalyzing && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-3"></div>
                    <span className="text-blue-800 font-medium">
                      {useRealAI && import.meta.env.VITE_OPENAI_API_KEY 
                        ? '🤖 AI analyzing screenshot with OpenAI Vision...' 
                        : 'Analyzing screenshot...'}
                    </span>
                  </div>
                </div>
              )}
              
              {aiError && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-red-800 text-sm">{aiError}</span>
                  </div>
                </div>
              )}
              
              {uploadedScreenshots.length > 0 && (
                <div className="bg-white p-4 rounded-md border">
                  <h5 className="font-medium text-gray-900 mb-2">📋 Screenshots ({uploadedScreenshots.length})</h5>
                  <div className="grid grid-cols-3 gap-3">
                    {uploadedScreenshots.map((screenshot) => (
                      <div key={screenshot.id} className="relative">
                        <img 
                          src={screenshot.preview} 
                          alt={screenshot.name}
                          className="w-full h-16 object-cover rounded border"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b truncate">
                          {screenshot.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border rounded-md"
                    value={config.startDate}
                    onChange={(e) => setConfig(prev => ({...prev, startDate: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border rounded-md"
                    value={config.endDate}
                    onChange={(e) => setConfig(prev => ({...prev, endDate: e.target.value}))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Hours per Day</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="12" 
                    step="0.5"
                    className="w-full p-3 border rounded-md"
                    value={config.targetHoursPerDay}
                    onChange={(e) => setConfig(prev => ({...prev, targetHoursPerDay: parseFloat(e.target.value) || 8}))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Time Format</label>
                  <select 
                    className="w-full p-3 border rounded-md"
                    value={config.timeFormat}
                    onChange={(e) => setConfig(prev => ({...prev, timeFormat: e.target.value}))}
                  >
                    <option value="minutes">Hours & Minutes (2h 30m)</option>
                    <option value="decimal">Decimal (2.50h)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Excluded Days / Custom Hours */}
          <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-orange-900">Excluded Days & Custom Hours</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-md border">
                <p className="text-sm text-gray-700 mb-2">
                  • Set days to <strong>0 hours</strong> to exclude them completely (holidays, sick days)
                </p>
                <p className="text-sm text-gray-700">
                  • Set <strong>custom hours</strong> for partial days or weekend work
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="date" 
                  className="p-3 border rounded-md"
                  value={config.excludedDayInput}
                  onChange={(e) => setConfig(prev => ({...prev, excludedDayInput: e.target.value}))}
                />
                <input 
                  type="number" 
                  min="0" 
                  max="12" 
                  step="0.5"
                  placeholder="Hours (0 to exclude)"
                  className="p-3 border rounded-md"
                  value={config.excludedDayHours}
                  onChange={(e) => setConfig(prev => ({...prev, excludedDayHours: parseFloat(e.target.value) || 0}))}
                />
                <button 
                  onClick={addExcludedDay}
                  disabled={!config.excludedDayInput}
                  className="bg-orange-600 text-white px-4 py-3 rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                >
                  Add Day
                </button>
              </div>
              
              {config.excludedDays.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {config.excludedDays.map((day) => (
                    <div key={day.date} className="flex items-center justify-between bg-white p-2 rounded border">
                      <div>
                        <span className="font-mono text-sm">{day.date}</span>
                        <span className={`ml-3 px-2 py-1 rounded-full text-xs ${
                          day.targetHours === 0 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {day.targetHours === 0 ? 'Excluded' : `${day.targetHours}h`}
                        </span>
                      </div>
                      <button 
                        onClick={() => removeExcludedDay(day.date)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Plus className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-green-900">Projects</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 p-3 border rounded-md"
                  placeholder="e.g., homepage, dashboard, mobile app"
                  value={config.projectInput || ''}
                  onChange={(e) => setConfig(prev => ({...prev, projectInput: e.target.value}))}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && config.projectInput?.trim()) {
                      setConfig(prev => ({
                        ...prev,
                        currentProjects: [...prev.currentProjects, prev.projectInput.trim()],
                        projectInput: ''
                      }));
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (config.projectInput?.trim()) {
                      setConfig(prev => ({
                        ...prev,
                        currentProjects: [...prev.currentProjects, prev.projectInput.trim()],
                        projectInput: ''
                      }));
                    }
                  }}
                  className="bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {config.currentProjects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.currentProjects.map((project, index) => (
                    <div key={index} className="bg-green-100 px-3 py-1 rounded-full text-sm flex items-center">
                      {project}
                      <button 
                        onClick={() => setConfig(prev => ({
                          ...prev, 
                          currentProjects: prev.currentProjects.filter((_, i) => i !== index)
                        }))}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Communications */}
          {config.teamCommunications.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-purple-900">Team Communications</h2>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {config.teamCommunications.map((comm) => (
                  <div key={comm.id} className="bg-white p-3 rounded border-l-4 border-purple-400">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-purple-700 font-medium">{comm.date}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                        {comm.platform || 'AI Analysis'}
                      </span>
                      {comm.confidence && (
                        <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700">
                          {comm.confidence}% conf
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-purple-900">{comm.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          
          {/* Generation */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Zap className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-purple-900">AI Generation</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-2">📊 Current Setup:</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>Period:</strong> {config.startDate && config.endDate ? `${config.startDate} to ${config.endDate}` : 'Not set'}</p>
                  <p><strong>Projects:</strong> {config.currentProjects.length || 'None'}</p>
                  <p><strong>Screenshots:</strong> {uploadedScreenshots.length}</p>
                  <p><strong>Communications:</strong> {config.teamCommunications.length}</p>
                </div>
              </div>
              
              <button 
                onClick={generateEnhancedTimeLogs}
                disabled={!config.startDate || !config.endDate || aiGenerating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-md text-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-400 flex items-center justify-center"
              >
                {aiGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-3"></div>
                    AI Generating...
                  </>
                ) : (
                  <>
                    <Brain className="w-6 h-6 mr-2" />
                    Generate AI Time Logs
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          {generatedLogs.length > 0 && (
            <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-bold text-green-900">Generated Results</h2>
                </div>
                <button 
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
              </div>
              
              {generationQuality && (
                <div className="bg-white p-4 rounded-md border mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">📊 Quality Score</h4>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      generationQuality.qualityScore >= 80 ? 'bg-green-100 text-green-800' :
                      generationQuality.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {generationQuality.qualityScore}/100
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    <p><strong>Tasks:</strong> {generationQuality.totalTasks} | <strong>Hours:</strong> {formatTime(generationQuality.totalHours)} | <strong>Variety:</strong> {generationQuality.taskVariety.size} types</p>
                  </div>
                </div>
              )}
              
              <div className="bg-white p-4 rounded-md border mb-4">
                <p className="text-green-800 font-medium">
                  ✅ <strong>{generatedLogs.length} tasks</strong> for {new Set(generatedLogs.map(log => log.day)).size} days
                </p>
                <p className="text-green-700 text-sm mt-1">
                  🤖 <strong>AI Generated:</strong> {generatedLogs.filter(log => log.aiGenerated).length}/{generatedLogs.length} tasks
                </p>
              </div>
              
              <div className="max-h-96 overflow-y-auto border rounded-md bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-3 border-r">Date</th>
                      <th className="text-left p-3 border-r">Time</th>
                      <th className="text-left p-3">Task</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedLogs.map((log, index) => (
                      <tr key={index} className="border-t hover:bg-gray-50">
                        <td className="p-3 border-r font-mono text-xs">
                          {log.day}
                          {log.isCustomDay && (
                            <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                              custom
                            </span>
                          )}
                        </td>
                        <td className="p-3 border-r font-mono text-sm">{formatTime(log.time)}</td>
                        <td className="p-3 text-sm">
                          <div>{log.task}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs">
                              🤖 AI
                            </span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                              {log.category}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Analysis Modal */}
      {showAnalysisModal && pendingAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🤖 AI Analysis Results</h3>
              
              <div className="space-y-4">
                <div>
                  <img 
                    src={uploadedScreenshots.find(s => s.file.name === pendingAnalysis.fileName)?.preview}
                    alt={pendingAnalysis.fileName}
                    className="w-full max-h-64 object-contain border rounded"
                  />
                  <p className="text-sm text-gray-600 mt-2">📄 {pendingAnalysis.fileName}</p>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    {pendingAnalysis.analysis.confidence >= 90 ? '🤖 AI Analysis Result:' : '🔍 AI Detected:'}
                  </h4>
                  <div className="text-blue-800 text-sm space-y-1">
                    <p><strong>Platform:</strong> {pendingAnalysis.analysis.platform}</p>
                    <p><strong>Activity Type:</strong> {pendingAnalysis.analysis.activityType}</p>
                    <p><strong>Confidence:</strong> {pendingAnalysis.analysis.confidence}%</p>
                    {pendingAnalysis.analysis.topics && pendingAnalysis.analysis.topics.length > 0 && (
                      <p><strong>Topics:</strong> {pendingAnalysis.analysis.topics.join(', ')}</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date:</label>
                  <input 
                    type="date"
                    className="w-full p-3 border rounded-md"
                    defaultValue={pendingAnalysis.extractedDate}
                    id="analysis-date"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">💬 Description:</label>
                  <textarea 
                    className="w-full p-3 border rounded-md"
                    rows="4"
                    defaultValue={pendingAnalysis.analysis.summary}
                    id="analysis-content"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    const content = document.getElementById('analysis-content').value;
                    const date = document.getElementById('analysis-date').value;
                    confirmAnalysis(content, date);
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 font-medium"
                >
                  ✅ Add Communication
                </button>
                <button
                  onClick={() => {
                    setPendingAnalysis(null);
                    setShowAnalysisModal(false);
                  }}
                  className="flex-1 bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 font-medium"
                >
                  ❌ Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTimeLogGenerator;