import React, { useState, useEffect } from 'react';
import { Calendar, Upload, Download, Brain, FileText, AlertCircle, CheckCircle, Settings, Save, RefreshCw, Plus, Maximize2, X, Edit2, FileUp, FileDown, CalendarDays, Table, Shuffle } from 'lucide-react';
import { WordPressAnalyzer } from './services/wordpress-analyzer';
import { AITaskGenerator, GeneratedTask } from './services/ai-task-generator';
import { analyzeScreenshotWithAI } from './openai-service';
import { TimeFormatter } from './services/time-formatter';
import { generateSimpleTimeLogs } from './simple-generator';
import { parseDocumentFile, type DocActivity } from './services/doc-parser';

const TimeLogGenerator = () => {
  // State management
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetHoursPerDay, setTargetHoursPerDay] = useState(8);
  const [projects, setProjects] = useState<string[]>([]);
  const [projectInput, setProjectInput] = useState('');
  
  // WordPress data
  const [wordpressOutput, setWordpressOutput] = useState('');
  const [parsedActivities, setParsedActivities] = useState<any[]>([]);
  
  // Screenshots
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Document (.docx/.xlsx) activities and chronology toggle
  const [docActivities, setDocActivities] = useState<DocActivity[]>([]);
  const [docSheets, setDocSheets] = useState<string[]>([]);
  const [sheetDates, setSheetDates] = useState<Record<string, string>>({});
  const [useDocumentChronology, setUseDocumentChronology] = useState(false);
  const [documentInfo, setDocumentInfo] = useState('');
  
  // Excluded days
  const [excludedDays, setExcludedDays] = useState<any[]>([]);
  const [excludedDayInput, setExcludedDayInput] = useState('');
  const [excludedDayHours, setExcludedDayHours] = useState(0);
  
  // Custom activities
  const [customActivities, setCustomActivities] = useState<any[]>([]);
  const [customActivityDate, setCustomActivityDate] = useState('');
  const [customActivityDescription, setCustomActivityDescription] = useState('');
  const [customActivityDuration, setCustomActivityDuration] = useState(1);
  
  // Results
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  
  // System prompt
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [savedPrompts, setSavedPrompts] = useState<{name: string, prompt: string}[]>([]);
  const [promptSaved, setPromptSaved] = useState(false);
  
  // Task extension
  const [extendingTask, setExtendingTask] = useState<number | null>(null);
  const [extendLevel, setExtendLevel] = useState<'brief' | 'detailed' | 'comprehensive'>('detailed');
  const [extendingInProgress, setExtendingInProgress] = useState(false);
  
  // Task editing
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editedTaskText, setEditedTaskText] = useState('');
  const [editingTime, setEditingTime] = useState<number | null>(null);
  const [editedTimeValue, setEditedTimeValue] = useState('');
  
  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [showWordPressCode, setShowWordPressCode] = useState(false);
  
  // Bulk selection
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [bulkExtending, setBulkExtending] = useState(false);
  const [showBulkExtendDialog, setShowBulkExtendDialog] = useState(false);
  const [bulkExtendLevel, setBulkExtendLevel] = useState<'brief' | 'detailed' | 'comprehensive'>('detailed');
  const [bulkExtendProgress, setBulkExtendProgress] = useState({ current: 0, total: 0 });
  
  // Services
  const wpAnalyzer = new WordPressAnalyzer();
  const taskGenerator = new AITaskGenerator();
  
  // WordPress Analyzer Code with Elementor Support
  const wordpressAnalyzerCode = `<?php
/**
 * WordPress Activity Analyzer with Elementor Support
 * Version: 1.0
 * Description: Analizuje aktywności WordPress włącznie z Elementorem
 */

// Test indicator
add_action('wp_footer', function() {
    if (isset($_GET['test_analyzer'])) {
        echo '<div style="position:fixed;top:10px;right:10px;background:red;color:white;padding:10px;z-index:9999;">ANALYZER DZIAŁA!</div>';
    }
});

// Główny analyzer
add_action('template_redirect', function() {
    if (isset($_GET['wp_analyzer'])) {
        $start_date = $_GET['start'] ?? date('Y-m-d', strtotime('-30 days'));
        $end_date = $_GET['end'] ?? date('Y-m-d');
        
        global $wpdb;
        
        // Pobierz modyfikacje (włącznie z Elementorem)
        $modified = $wpdb->get_results($wpdb->prepare(
            "SELECT post_title, post_modified, post_type,
                    (SELECT COUNT(*) FROM {$wpdb->posts} r WHERE r.post_parent = p.ID AND r.post_type = 'revision') as revisions
             FROM {$wpdb->posts} p 
             WHERE post_type IN ('post', 'page', 'elementor_library', 'e-landing-page') 
             AND post_status = 'publish'
             AND DATE(post_modified) BETWEEN %s AND %s
             AND post_modified != post_date
             ORDER BY post_modified DESC",
            $start_date, $end_date
        ));
        
        // Pobierz zmiany Elementora
        $elementor_changes = $wpdb->get_results($wpdb->prepare(
            "SELECT p.post_title, p.post_modified, p.post_type,
                    pm.meta_value as elementor_data,
                    (SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_elementor_history' AND post_id = p.ID) as elementor_revisions
             FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE pm.meta_key = '_elementor_data'
             AND p.post_modified BETWEEN %s AND %s
             AND p.post_type IN ('post', 'page', 'elementor_library')
             ORDER BY p.post_modified DESC",
            $start_date, $end_date
        ));
        
        // Pobierz szablony Elementora (Global widgets, headers, footers)
        $elementor_templates = $wpdb->get_results($wpdb->prepare(
            "SELECT post_title, post_modified, post_name
             FROM {$wpdb->posts}
             WHERE post_type = 'elementor_library'
             AND post_status = 'publish'
             AND DATE(post_modified) BETWEEN %s AND %s",
            $start_date, $end_date
        ));
        
        // Pobierz nowe posty/strony
        $new_posts = $wpdb->get_results($wpdb->prepare(
            "SELECT post_title, post_date, post_type, post_content
             FROM {$wpdb->posts} 
             WHERE post_type IN ('post', 'page', 'elementor_library', 'e-landing-page') 
             AND post_status = 'publish'
             AND DATE(post_date) BETWEEN %s AND %s
             ORDER BY post_date DESC",
            $start_date, $end_date
        ));
        
        // Pobierz media
        $media = $wpdb->get_results($wpdb->prepare(
            "SELECT post_title, post_date, post_mime_type
             FROM {$wpdb->posts} 
             WHERE post_type = 'attachment' 
             AND DATE(post_date) BETWEEN %s AND %s
             ORDER BY post_date DESC",
            $start_date, $end_date
        ));
        
        // Buduj dane
        $activities = array();
        
        // Przetwarzaj modyfikacje
        foreach ($modified as $item) {
            $word_count = str_word_count(strip_tags($item->post_content ?? ''));
            $time = 1.5 + ($item->revisions * 0.2);
            if ($time > 2.8) $time = 2.8;
            
            $type = ($item->post_type === 'elementor_library') ? 'elementor_template_modification' : 'page_modification';
            
            $activities[] = array(
                'type' => $type,
                'title' => $item->post_title,
                'estimated_time' => round($time, 2),
                'day' => date('Y-m-d', strtotime($item->post_modified)),
                'date' => $item->post_modified,
                'revisions' => $item->revisions,
                'post_type' => $item->post_type
            );
        }
        
        // Przetwarzaj zmiany Elementora
        foreach ($elementor_changes as $item) {
            // Sprawdź czy nie została już dodana jako modyfikacja
            $already_added = false;
            foreach ($activities as $activity) {
                if ($activity['title'] === $item->post_title && 
                    date('Y-m-d', strtotime($activity['date'])) === date('Y-m-d', strtotime($item->post_modified))) {
                    $already_added = true;
                    break;
                }
            }
            
            if (!$already_added) {
                $time = 2.0 + ($item->elementor_revisions * 0.3);
                if ($time > 3.5) $time = 3.5;
                
                $activities[] = array(
                    'type' => 'elementor_modification',
                    'title' => $item->post_title . ' (Elementor)',
                    'estimated_time' => round($time, 2),
                    'day' => date('Y-m-d', strtotime($item->post_modified)),
                    'date' => $item->post_modified,
                    'elementor_revisions' => $item->elementor_revisions,
                    'post_type' => $item->post_type
                );
            }
        }
        
        // Przetwarzaj szablony Elementora
        foreach ($elementor_templates as $template) {
            $activities[] = array(
                'type' => 'elementor_template',
                'title' => 'Szablon: ' . $template->post_title,
                'estimated_time' => 2.5,
                'day' => date('Y-m-d', strtotime($template->post_modified)),
                'date' => $template->post_modified,
                'template_type' => $template->post_name
            );
        }
        
        // Przetwarzaj nowe posty
        foreach ($new_posts as $item) {
            $word_count = str_word_count(strip_tags($item->post_content ?? ''));
            $time = 2.0 + ($word_count > 500 ? 0.8 : 0);
            if ($time > 2.8) $time = 2.8;
            
            $type = ($item->post_type === 'elementor_library') ? 'elementor_template_creation' : 'page_creation';
            
            $activities[] = array(
                'type' => $type,
                'title' => $item->post_title,
                'estimated_time' => round($time, 2),
                'day' => date('Y-m-d', strtotime($item->post_date)),
                'date' => $item->post_date,
                'word_count' => $word_count,
                'post_type' => $item->post_type
            );
        }
        
        // Przetwarzaj media
        foreach ($media as $item) {
            $activities[] = array(
                'type' => 'media_upload',
                'title' => 'Media: ' . $item->post_title,
                'estimated_time' => 0.7,
                'day' => date('Y-m-d', strtotime($item->post_date)),
                'date' => $item->post_date,
                'file_type' => $item->post_mime_type
            );
        }
        
        // Sortuj
        usort($activities, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        
        // Grupuj po dniach
        $by_day = array();
        foreach ($activities as $activity) {
            $day = $activity['day'];
            if (!isset($by_day[$day])) {
                $by_day[$day] = array('activities' => array(), 'total_time' => 0);
            }
            $by_day[$day]['activities'][] = $activity;
            $by_day[$day]['total_time'] += $activity['estimated_time'];
        }
        
        $result = array(
            'success' => true,
            'total_activities' => count($activities),
            'activities' => $activities,
            'by_day' => $by_day,
            'period' => array('start' => $start_date, 'end' => $end_date),
            'summary' => array(
                'analyzed_days' => count($by_day),
                'activity_breakdown' => array(
                    'page_modifications' => count(array_filter($activities, function($a) { return $a['type'] === 'page_modification'; })),
                    'page_creations' => count(array_filter($activities, function($a) { return $a['type'] === 'page_creation'; })),
                    'media_uploads' => count(array_filter($activities, function($a) { return $a['type'] === 'media_upload'; })),
                    'elementor_modifications' => count(array_filter($activities, function($a) { return strpos($a['type'], 'elementor') !== false; })),
                    'elementor_templates' => count(array_filter($activities, function($a) { return $a['type'] === 'elementor_template'; }))
                )
            )
        );
        
        // Output
        if (isset($_GET['format']) && $_GET['format'] === 'json') {
            header('Content-Type: application/json');
            echo json_encode($result, JSON_PRETTY_PRINT);
            exit;
        }
        
        // HTML
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <title>WordPress Analyzer + Elementor</title>
            <style>
                body { font-family: system-ui; margin: 20px; background: #f5f5f5; }
                .container { max-width: 1000px; margin: 0 auto; }
                .header { background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px; }
                .controls { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                .controls input, .controls button { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 5px; }
                .controls button { background: #667eea; color: white; border: none; cursor: pointer; }
                .json-section { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
                .json-output { background: #2d3748; color: #68d391; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; max-height: 300px; overflow: auto; }
                .activity { background: white; margin: 10px 0; padding: 15px; border-left: 4px solid #667eea; border-radius: 0 5px 5px 0; }
                .activity.elementor { border-left-color: #e91e63; }
                .day-header { background: #667eea; color: white; padding: 10px; margin: 20px 0 10px 0; border-radius: 5px; }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
                .stat { background: white; padding: 15px; border-radius: 10px; text-align: center; }
                .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
                .stat.elementor .stat-number { color: #e91e63; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔍 WordPress + Elementor Activity Analyzer</h1>
                    <p>Okres: <?php echo $start_date; ?> - <?php echo $end_date; ?></p>
                </div>
                
                <div class="controls">
                    <form method="GET">
                        <input type="hidden" name="wp_analyzer" value="1">
                        <input type="date" name="start" value="<?php echo $start_date; ?>">
                        <input type="date" name="end" value="<?php echo $end_date; ?>">
                        <button type="submit">🔄 Analizuj</button>
                        <button type="submit" name="format" value="json">📥 JSON</button>
                    </form>
                </div>
                
                <div class="stats">
                    <div class="stat">
                        <div class="stat-number"><?php echo count($activities); ?></div>
                        <div>Aktywności</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number"><?php echo count($by_day); ?></div>
                        <div>Dni</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number"><?php echo $result['summary']['activity_breakdown']['page_modifications']; ?></div>
                        <div>Modyfikacje</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number"><?php echo $result['summary']['activity_breakdown']['page_creations']; ?></div>
                        <div>Nowe treści</div>
                    </div>
                    <div class="stat elementor">
                        <div class="stat-number"><?php echo $result['summary']['activity_breakdown']['elementor_modifications']; ?></div>
                        <div>Elementor</div>
                    </div>
                </div>
                
                <div class="json-section">
                    <h3>📋 JSON dla Time Log Generator</h3>
                    <button onclick="copyJSON()" style="background: #48bb78; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">📋 Kopiuj JSON</button>
                    <div class="json-output" id="jsonOutput"><?php echo json_encode($result, JSON_PRETTY_PRINT); ?></div>
                </div>
                
                <?php foreach ($by_day as $day => $day_data): ?>
                    <div class="day-header">
                        <?php echo date('l, j F Y', strtotime($day)); ?> 
                        (<?php echo count($day_data['activities']); ?> aktywności, ~<?php echo round($day_data['total_time'], 1); ?>h)
                    </div>
                    <?php foreach ($day_data['activities'] as $activity): ?>
                        <div class="activity <?php echo strpos($activity['type'], 'elementor') !== false ? 'elementor' : ''; ?>">
                            <strong><?php echo esc_html($activity['title']); ?></strong>
                            <br><small><?php echo $activity['type']; ?> • <?php echo $activity['estimated_time']; ?>h</small>
                        </div>
                    <?php endforeach; ?>
                <?php endforeach; ?>
            </div>
            
            <script>
                function copyJSON() {
                    const text = document.getElementById('jsonOutput').textContent;
                    navigator.clipboard.writeText(text).then(() => alert('JSON skopiowany!'));
                }
            </script>
        </body>
        </html>
        <?php
        exit;
    }
});

// API Key генерация
if (!get_option('wp_retro_key')) {
    update_option('wp_retro_key', 'wp_retro_' . wp_generate_password(15, false));
}

// Admin notice
add_action('admin_notices', function() {
    if (current_user_can('manage_options')) {
        $site_url = get_site_url();
        $analyzer_url = $site_url . '?wp_analyzer=1';
        $test_url = $site_url . '?test_analyzer=1';
        
        echo '<div class="notice notice-success is-dismissible">';
        echo '<h3>🔍 WordPress + Elementor Analyzer - Gotowy!</h3>';
        echo '<p><strong>Analyzer:</strong> <a href="' . $analyzer_url . '" target="_blank">🔗 Otwórz Analyzer</a></p>';
        echo '<p><strong>Test:</strong> <a href="' . $test_url . '" target="_blank">🧪 Test</a></p>';
        echo '<p><strong>API Key:</strong> <code>' . get_option('wp_retro_key') . '</code></p>';
        echo '<p style="color: #e91e63;"><strong>✅ Obsługa Elementora:</strong> Szablony, global widgets, historie zmian</p>';
        echo '</div>';
    }
});`;
  
  // Default system prompt
  const defaultSystemPrompt = `You are an expert in generating realistic and detailed developer time logs that mimic actual work patterns in web development. Your output must be precise, technically grounded, and directly reflect the workflow of a highly skilled developer working on real-world websites.

CRITICAL PRIORITY ORDER:
1. FIRST: Use real WordPress activities and screenshot data to create tasks
2. SECOND: If you have 1 activity but need 5 tasks, break that activity into detailed subtasks
3. LAST: Only create generic tasks if there are NO real activities for that day

Follow these principles:

⸻

🔧 Task Descriptions
    • Use believable and detailed task descriptions with technical specificity.
    • Reference concrete actions (e.g. "rebuilt 'Case Studies' page hero using Elementor Flexbox containers" instead of "worked on case studies").
    • Mention technologies and tools (e.g. WordPress, Figma, Elementor, ACF, JavaScript, CSS, PHP, etc.) and name specific components, selectors, or views (e.g. section#press-hero, acf_field_group('technology')).
    • ALWAYS use exact page/project names from the WordPress data when available.

🔁 Task Variety
    • Mix task types: layout implementation, accessibility (WCAG) testing, performance optimization, plugin configuration, content structuring, mobile responsiveness, component migration, integration with CMS, client feedback fixes, testing, code refactoring, QA, etc.
    • Include both creative work (e.g. megamenu architecture design) and technical tasks (e.g. 3D model iframe embedding testing).

🕒 Time Allocation
    • Allocate realistic times for each task:
    • UI tweaks, bugfixes: 0.25–1h
    • Page builds, layout development: 1–2.5h
    • Architecture tasks, accessibility testing, complex debugging: 2–3h max per entry
    • Assume 6–8h per day max. Don't make it artificial — reflect real pacing, breaks, mental load.

🧩 Specificity
    • Mention which page the task refers to (e.g. "Homepage", "Press Page", "Stop-Arm Overview", "Technology Page", etc.).
    • If working across multiple pages, split time into meaningful subchunks (e.g. 1.5h press page hero fixes, 1h Stop-Arm icons spacing, 1h homepage responsiveness).
    • If applicable, mention "based on Figma" or "per feedback from XYZ day".

🧠 Contextual Awareness
    • Consider realistic flow across days:
    • Monday: more planning, structural work
    • Mid-week (Tue–Thu): heavy dev tasks
    • Friday: fixes, feedback, WCAG checks, final testing
    • Spread recurring work (e.g. mobile optimizations or global component tweaks) across days if needed.

Remember: ALWAYS prioritize real activities from WordPress/screenshots over invented tasks!`;

  // Preset prompt templates
  const promptTemplates = {
    'Frontend Developer': `You are a frontend developer creating realistic time logs. Focus on:
- React/Vue/Angular component development
- CSS styling and responsive design
- UI/UX implementation
- Cross-browser testing
- Performance optimization
- Accessibility improvements
Always reference specific components, pages, or features.`,
    
    'Backend Developer': `You are a backend developer creating realistic time logs. Focus on:
- API endpoint development
- Database queries and optimization
- Authentication and security
- Server configuration
- Performance monitoring
- Integration with third-party services
Include specific endpoints, models, or services worked on.`,
    
    'Full Stack Developer': `You are a full stack developer creating realistic time logs. Balance between:
- Frontend component development
- Backend API implementation
- Database design and queries
- DevOps and deployment tasks
- Code reviews and pair programming
- Technical documentation
Mix frontend and backend tasks realistically.`,
    
    'WordPress Developer': `You are an expert WordPress developer creating realistic and detailed time logs based on ACTUAL WordPress activities.

PRIORITY RULES:
1. ALWAYS use real page modifications from WordPress data (e.g., "Community Advocates" page)
2. Break down single page updates into multiple tasks if needed
3. Only use generic WordPress tasks if NO real activities exist

🔧 Task Descriptions
    • Use specific WordPress terminology: Elementor, ACF, Gutenberg blocks, custom post types, etc.
    • Reference concrete actions (e.g. "rebuilt 'About Us' page hero using Elementor Flexbox containers")
    • Mention specific plugins, themes, and page builders used

🔁 WordPress-Specific Tasks
    • Mix: Elementor layouts, ACF field configuration, plugin updates, theme customization, performance optimization, security hardening, content migration, responsive testing, WCAG compliance
    • Include both visual builders work and PHP/CSS customization

🧩 Specificity
    • ALWAYS reference actual page names from WordPress data
    • Mention specific sections (e.g. "hero section", "testimonials carousel", "contact form")
    • Include technical details (e.g. "fixed z-index conflict in megamenu", "optimized ACF repeater queries")

Remember: Use ONLY page names from the actual WordPress data provided!`,
    
    'Mobile Developer': `You are a mobile app developer creating realistic time logs. Focus on:
- Native iOS/Android development
- React Native/Flutter implementation
- API integration
- UI/UX implementation
- App store deployment preparation
- Performance profiling and optimization
Include specific screens, features, or modules.`
  };

  // Initialize custom prompt with default on mount
  useEffect(() => {
    const savedPrompt = localStorage.getItem('timeLogSystemPrompt');
    if (savedPrompt) {
      setCustomSystemPrompt(savedPrompt);
    } else {
      setCustomSystemPrompt(defaultSystemPrompt);
    }
    
    // Load saved prompts
    const saved = localStorage.getItem('savedPrompts');
    if (saved) {
      setSavedPrompts(JSON.parse(saved));
    }
  }, []);
  
  // Save prompt to localStorage
  const savePrompt = () => {
    localStorage.setItem('timeLogSystemPrompt', customSystemPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };
  
  // Save prompt as template
  const savePromptTemplate = (name: string) => {
    const newTemplate = { name, prompt: customSystemPrompt };
    const updated = [...savedPrompts, newTemplate];
    setSavedPrompts(updated);
    localStorage.setItem('savedPrompts', JSON.stringify(updated));
  };
  
  // Load prompt template
  const loadPromptTemplate = (prompt: string) => {
    setCustomSystemPrompt(prompt);
  };
  
  // Reset to default prompt
  const resetToDefault = () => {
    setCustomSystemPrompt(defaultSystemPrompt);
  };
  
  // Handle WordPress output parsing
  const handleWordPressOutput = (output: string) => {
    setWordpressOutput(output);
    const activities = wpAnalyzer.parseWordPressOutput(output);
    setParsedActivities(activities);
    
    // Extract and add projects
    const extractedProjects = wpAnalyzer.extractProjects(output);
    console.log('Extracted projects from WordPress:', extractedProjects);
    if (extractedProjects.length > 0) {
      const newProjects = extractedProjects.filter(p => !projects.includes(p));
      if (newProjects.length > 0) {
        setProjects(prev => [...prev, ...newProjects]);
      }
    }
  };
  
  // Handle screenshot upload
  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      await processScreenshotFiles(files);
      // Reset the input so the same file can be selected again
      event.target.value = '';
    }
  };

  // Process screenshot files (shared by upload and drag/drop)
  const processScreenshotFiles = async (files: File[]) => {
    setAnalyzingScreenshot(true);
    setError(null);
    
    try {
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          console.warn(`Skipping non-image file: ${file.name}`);
          continue;
        }
        
        let analysis;
        
        // Try AI analysis if API key exists
        if (import.meta.env.VITE_OPENAI_API_KEY) {
          try {
            analysis = await analyzeScreenshotWithAI(file);
          } catch (err) {
            console.log('AI analysis unavailable, using filename-based detection');
            analysis = analyzeScreenshotFallback(file);
          }
        } else {
          // Fallback analysis based on filename
          analysis = analyzeScreenshotFallback(file);
        }
        
        // Extract date from analysis or use today
        const extractedDate = analysis.date || new Date().toISOString().split('T')[0];
        
        // Extract projects from analysis
        console.log('Screenshot analysis:', analysis);
        if (analysis.projects && analysis.projects.length > 0) {
          const newProjects = analysis.projects.filter(p => !projects.includes(p));
          if (newProjects.length > 0) {
            console.log('Adding projects from screenshot:', newProjects);
            setProjects(prev => [...prev, ...newProjects]);
          }
        }
        
        const screenshot = {
          id: Date.now() + Math.random(),
          file,
          fileName: file.name,
          date: extractedDate,
          analysis
        };
        setScreenshots(prev => [...prev, screenshot]);
      }
    } catch (err) {
      setError('Failed to analyze screenshots.');
      console.error(err);
    } finally {
      setAnalyzingScreenshot(false);
      setIsDragging(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processScreenshotFiles(files);
    }
    
    setIsDragging(false);
  };
  
  // Fallback screenshot analysis
  const analyzeScreenshotFallback = (file: File) => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.includes('teams')) {
      return {
        platform: 'Microsoft Teams',
        summary: 'Teams meeting or chat discussion',
        activityType: 'communication'
      };
    } else if (fileName.includes('slack')) {
      return {
        platform: 'Slack',
        summary: 'Slack channel discussion',
        activityType: 'communication'
      };
    } else if (fileName.includes('ide') || fileName.includes('code')) {
      return {
        platform: 'IDE',
        summary: 'Code development work',
        activityType: 'coding'
      };
    }
    
    return {
      platform: 'Unknown',
      summary: 'Work activity screenshot',
      activityType: 'work'
    };
  };
  
  // Add excluded day
  const addExcludedDay = () => {
    if (excludedDayInput) {
      setExcludedDays(prev => [...prev, {
        date: excludedDayInput,
        targetHours: excludedDayHours
      }]);
      setExcludedDayInput('');
      setExcludedDayHours(0);
    }
  };
  
  // Add custom activity
  const addCustomActivity = () => {
    if (customActivityDate && customActivityDescription) {
      setCustomActivities(prev => [...prev, {
        id: Date.now(),
        date: customActivityDate,
        description: customActivityDescription,
        duration: customActivityDuration,
        type: 'custom'
      }]);
      setCustomActivityDate('');
      setCustomActivityDescription('');
      setCustomActivityDuration(1);
    }
  };
  
  // Remove custom activity
  const removeCustomActivity = (id: number) => {
    setCustomActivities(prev => prev.filter(activity => activity.id !== id));
  };
  
  // Clean task description
  const cleanTaskDescription = (description: string): string => {
    // Remove common prefixes
    const prefixes = [
      /^generic:\s*/i,
      /^generic\s*\([^)]*\):\s*/i,
      /^generic\s*-\s*/i,
      /^generic\s+/i,
      /^\[generic\]\s*/i,
      /^task:\s*/i,
      /^development:\s*/i,
      /^dev:\s*/i,
      /^developer:\s*/i,
      /^coding:\s*/i,
      /^programming:\s*/i,
      /^work:\s*/i,
      /^project:\s*/i
    ];
    
    let cleaned = description;
    for (const prefix of prefixes) {
      cleaned = cleaned.replace(prefix, '');
    }
    
    // Also clean up if the description starts with lowercase after cleaning
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned.trim();
  };
  
  // Upload and parse .docx/.xlsx document
  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const res = await parseDocumentFile(file);
      setDocActivities(res.activities);
      const sheets = (res.meta?.sheets || []).filter(Boolean) as string[];
      setDocSheets(sheets);
      // initialize sheet dates empty
      const datesInit: Record<string, string> = {};
      sheets.forEach(s => { datesInit[s] = ''; });
      setSheetDates(datesInit);
      const days = new Set(res.activities.map(a => a.date).filter(Boolean));
      setDocumentInfo(`${res.source.toUpperCase()} • ${res.activities.length} changes • ${days.size} days`);
      setUseDocumentChronology(true);
      setError('');
    } catch (err) {
      console.error('Document parse failed:', err);
      setError('Failed to parse document. Please check file format (.docx/.xlsx).');
    } finally {
      // reset so the same file can be re-selected
      if (event.target) (event.target as any).value = '';
    }
  };

  // Deterministic generation from document chronology (no AI)
  const generateFromDocumentChronology = () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    if (docActivities.length === 0) {
      setError('No document activities loaded');
      return;
    }

    const tasks: GeneratedTask[] = [];
    // Assign dates to activities without explicit date via sheetDates mapping
    const effectiveActivities = docActivities.map(a => {
      if ((!a.date || a.date === '') && a.sheet && sheetDates[a.sheet]) {
        return { ...a, date: sheetDates[a.sheet] };
      }
      return a;
    });
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      // Skip weekends unless specifically overridden
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const exception = excludedDays.find(d => d.date === dateStr);
        if (!exception || exception.targetHours === 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      }

      const dayException = excludedDays.find(d => d.date === dateStr);
      const dayTarget = dayException?.targetHours || targetHoursPerDay;

      const dayActs = effectiveActivities
        .filter(a => a.date === dateStr)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

      if (dayActs.length > 0) {
        const times = distributeWithCaps(dayTarget, dayActs.length, 2.97, 0.25);
        dayActs.forEach((act, idx) => {
          const descParts = [act.description];
          if (act.status) descParts.push(`status: ${act.status}`);
          const loc = [act.sheet, act.cell].filter(Boolean).join(' • ');
          const meta = [loc, act.author].filter(Boolean).join(', ');
          const taskText = [descParts.join(' '), meta ? `(${meta})` : ''].filter(Boolean).join(' ');
          tasks.push({
            date: dateStr,
            time: TimeFormatter.formatForCSV(times[idx]),
            task: taskText,
            comments: '',
            taskType: 'custom'
          });
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setGeneratedTasks(tasks);
    setError('');
  };

  function distributeWithCaps(total: number, count: number, maxEach: number, minEach: number): number[] {
    const feasibleTotal = Math.max(count * minEach, Math.min(total, count * maxEach));
    const arr = new Array(count).fill(feasibleTotal / count);
    // clamp + redistribute
    let changed = true;
    while (changed) {
      changed = false;
      let surplus = 0;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > maxEach) { surplus += (arr[i] - maxEach); arr[i] = maxEach; changed = true; }
        if (arr[i] < minEach) { surplus -= (minEach - arr[i]); arr[i] = minEach; changed = true; }
      }
      if (Math.abs(surplus) < 1e-6) break;
      const adjustable = arr.map((v, i) => i).filter(i => (surplus > 0 ? arr[i] < maxEach - 1e-6 : arr[i] > minEach + 1e-6));
      if (adjustable.length === 0) break;
      const delta = surplus / adjustable.length;
      for (const i of adjustable) arr[i] += delta;
    }
    // round to 0.25h and scale back to feasibleTotal
    const rounded = arr.map(h => Math.max(minEach, Math.min(maxEach, Math.round(h * 4) / 4)));
    const sum = rounded.reduce((s, x) => s + x, 0) || 1;
    const scale = feasibleTotal / sum;
    return rounded.map(h => Math.max(minEach, Math.min(maxEach, Math.round(h * scale * 4) / 4)));
  }
  
  // Generate time logs
  const generateTimeLogs = async () => {
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    
    if (useDocumentChronology && docActivities.length > 0) {
      generateFromDocumentChronology();
      return;
    }
    
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      setError('⚠️ No OpenAI API key found! Add VITE_OPENAI_API_KEY to .env file');
      return;
    }
    
    if (projects.length === 0) {
      setError('Please add at least one project name');
      return;
    }
    
    setGenerating(true);
    setError(null);
    
    try {
      // Try AI generation first if API key exists
      let tasks;
      
      if (import.meta.env.VITE_OPENAI_API_KEY) {
        try {
          tasks = await taskGenerator.generateTasks(
            startDate,
            endDate,
            parsedActivities,
            screenshots,
            targetHoursPerDay,
            excludedDays,
            projects,
            customSystemPrompt,
            customActivities
          );
        } catch (aiError) {
          console.error('AI generation failed, using simple generator:', aiError);
          // Fallback to simple generator
          tasks = generateSimpleTimeLogs(startDate, endDate, projects, targetHoursPerDay);
        }
      } else {
        // No API key - use simple generator
        tasks = generateSimpleTimeLogs(startDate, endDate, projects, targetHoursPerDay);
      }
      
      // Clean task descriptions
      const cleanedTasks = tasks.map(task => ({
        ...task,
        task: cleanTaskDescription(task.task)
      }));
      
      setGeneratedTasks(cleanedTasks);
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('401')) {
        setError('❌ OpenAI API Error: Invalid API key. Please check your .env file');
      } else if (errorMessage.includes('429')) {
        setError('❌ OpenAI API Error: Rate limit exceeded. Please wait a moment');
      } else if (errorMessage.includes('500') || errorMessage.includes('503')) {
        setError('❌ OpenAI API Error: Service temporarily unavailable');
      } else {
        setError(`❌ Error: ${errorMessage}`);
      }
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };
  
  // Extend task description
  const extendTaskDescription = async (taskIndex: number) => {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      setError('OpenAI API key required for task extension');
      return;
    }
    
    setExtendingInProgress(true);
    const task = generatedTasks[taskIndex];
    
    try {
      const extendPrompt = {
        brief: 'Add 1-2 more technical details to this task description, keeping it concise',
        detailed: 'Expand this task with 3-4 specific technical details, mentioning tools, methods, or components',
        comprehensive: 'Create a comprehensive task description with 5-6 technical details, including specific files, functions, technologies used, and outcomes'
      };
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a technical writer expanding developer task descriptions. Keep the same core task but add realistic technical details.'
            },
            {
              role: 'user',
              content: `${extendPrompt[extendLevel]}: "${task.task}"`
            }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      });
      
      if (!response.ok) throw new Error('Failed to extend task');
      
      const data = await response.json();
      const extendedDescription = data.choices[0].message.content;
      
      // Update the task
      const updatedTasks = [...generatedTasks];
      updatedTasks[taskIndex] = {
        ...task,
        task: cleanTaskDescription(extendedDescription)
      };
      setGeneratedTasks(updatedTasks);
      setExtendingTask(null);
      
    } catch (err) {
      console.error('Failed to extend task:', err);
      setError('Failed to extend task description');
    } finally {
      setExtendingInProgress(false);
    }
  };
  
  // Export to CSV
  const exportToCSV = () => {
    const projectName = projects[0] || 'TimeLog';
    const header = `"${projectName} - Time Log"\n"Period: ${startDate} - ${endDate}"\nDay,Time,Task,Comments\n`;
    
    const rows = generatedTasks.map(task => 
      `${task.date},${TimeFormatter.toHoursMinutesSeconds(parseFloat(task.time))},"${task.task.replace(/"/g, '""')}","${task.comments}"`
    ).join('\n');
    
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Import CSV
  const importCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const importedTasks: GeneratedTask[] = [];
        
        // Skip header lines and process data
        for (let i = 3; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parse CSV line
          const match = line.match(/^([^,]+),([^,]+),"([^"]*(?:""[^"]*)*)","([^"]*)"$/);
          if (match) {
            const [_, date, time, task, comments] = match;
            importedTasks.push({
              date,
              time,
              task: cleanTaskDescription(task.replace(/""/g, '"')),
              comments: comments || '',
              taskType: 'generic'
            });
          }
        }
        
        if (importedTasks.length > 0) {
          setGeneratedTasks(importedTasks);
          // Extract dates from imported tasks
          const dates = importedTasks.map(t => t.date);
          setStartDate(dates[0]);
          setEndDate(dates[dates.length - 1]);
          setError(''); // Clear any existing errors
          
          // Show success message
          const successMsg = `✅ Successfully imported ${importedTasks.length} tasks from CSV`;
          setError(successMsg);
          setTimeout(() => {
            if (error === successMsg) setError('');
          }, 3000);
        }
      } catch (err) {
        console.error('Failed to import CSV:', err);
        setError('Failed to import CSV file');
      }
    };
    reader.readAsText(file);
  };
  
  // Export configuration
  const exportConfiguration = () => {
    const config = {
      startDate,
      endDate,
      targetHoursPerDay,
      projects,
      excludedDays,
      customActivities,
      customSystemPrompt,
      savedPrompts,
      wordpressOutput,
      screenshots: screenshots.map(s => ({
        fileName: s.fileName,
        date: s.date,
        analysis: s.analysis
      }))
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-log-config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Import configuration
  const importConfiguration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        
        // Import all settings
        if (config.startDate) setStartDate(config.startDate);
        if (config.endDate) setEndDate(config.endDate);
        if (config.targetHoursPerDay) setTargetHoursPerDay(config.targetHoursPerDay);
        if (config.projects) setProjects(config.projects);
        if (config.excludedDays) setExcludedDays(config.excludedDays);
        if (config.customActivities) setCustomActivities(config.customActivities);
        if (config.customSystemPrompt) setCustomSystemPrompt(config.customSystemPrompt);
        if (config.savedPrompts) setSavedPrompts(config.savedPrompts);
        if (config.wordpressOutput) {
          setWordpressOutput(config.wordpressOutput);
          handleWordPressOutput(config.wordpressOutput);
        }
        if (config.screenshots) setScreenshots(config.screenshots);
        
        setError('');
      } catch (err) {
        console.error('Failed to import configuration:', err);
        setError('Failed to import configuration file');
      }
    };
    reader.readAsText(file);
  };
  
  // Save edited task
  const saveEditedTask = (index: number) => {
    const updatedTasks = [...generatedTasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      task: editedTaskText
    };
    setGeneratedTasks(updatedTasks);
    setEditingTask(null);
  };
  
  // Save edited time
  const saveEditedTime = (index: number) => {
    const timeValue = parseFloat(editedTimeValue);
    if (isNaN(timeValue) || timeValue <= 0) {
      setError('Please enter a valid time value greater than 0');
      return;
    }
    
    const updatedTasks = [...generatedTasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      time: timeValue.toFixed(2)
    };
    setGeneratedTasks(updatedTasks);
    setEditingTime(null);
  };
  
  // Generate calendar data
  const generateCalendarData = () => {
    if (!startDate || !endDate || generatedTasks.length === 0) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const calendar: { [key: string]: { date: Date; hours: number; tasks: GeneratedTask[] } } = {};
    
    // Initialize all days in range
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      calendar[dateStr] = {
        date: new Date(current),
        hours: 0,
        tasks: []
      };
      current.setDate(current.getDate() + 1);
    }
    
    // Populate with task data
    generatedTasks.forEach(task => {
      if (calendar[task.date]) {
        calendar[task.date].hours += parseFloat(task.time);
        calendar[task.date].tasks.push(task);
      }
    });
    
    return calendar;
  };
  
  // Get calendar weeks
  const getCalendarWeeks = () => {
    const calendarData = generateCalendarData();
    if (!calendarData) return [];
    
    const dates = Object.values(calendarData).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (dates.length === 0) return [];
    
    const weeks: typeof dates[] = [];
    let currentWeek: typeof dates = [];
    
    // Add empty days at the beginning of the first week
    const firstDay = dates[0].date.getDay();
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null as any);
    }
    
    dates.forEach(dateInfo => {
      currentWeek.push(dateInfo);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Fill the last week
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null as any);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };
  
  // Toggle task selection
  const toggleTaskSelection = (index: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTasks(newSelected);
  };
  
  // Select/deselect all tasks
  const toggleSelectAll = () => {
    if (selectedTasks.size === generatedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      const allIndices = new Set(generatedTasks.map((_, index) => index));
      setSelectedTasks(allIndices);
    }
  };
  
  // Bulk extend tasks
  const bulkExtendTasks = async () => {
    if (selectedTasks.size === 0) return;
    
    setBulkExtending(true);
    setBulkExtendProgress({ current: 0, total: selectedTasks.size });
    setError('');
    
    try {
      const extendPrompt = {
        brief: 'Add 1-2 more technical details to this task description, keeping it concise',
        detailed: 'Expand this task with 3-4 specific technical details, mentioning tools, methods, or components',
        comprehensive: 'Create a comprehensive task description with 5-6 technical details, including specific files, functions, technologies used, and outcomes'
      };
      
      const updatedTasks = [...generatedTasks];
      let successCount = 0;
      
      // Process in batches of 3 for better performance
      const BATCH_SIZE = 3;
      const taskIndices = Array.from(selectedTasks);
      
      for (let i = 0; i < taskIndices.length; i += BATCH_SIZE) {
        const batch = taskIndices.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (index) => {
          try {
            const task = generatedTasks[index];
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a technical writer expanding developer task descriptions. Keep the same core task but add realistic technical details.'
                  },
                  {
                    role: 'user',
                    content: `${extendPrompt[bulkExtendLevel]}: "${task.task}"`
                  }
                ],
                temperature: 0.7,
                max_tokens: 200
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              const extendedDescription = data.choices[0].message.content;
              updatedTasks[index] = {
                ...task,
                task: cleanTaskDescription(extendedDescription)
              };
              return true;
            }
            return false;
          } catch (err) {
            console.error(`Failed to extend task ${index}:`, err);
            return false;
          }
        });
        
        // Wait for batch to complete
        const results = await Promise.all(batchPromises);
        successCount += results.filter(r => r).length;
        
        // Update progress
        setBulkExtendProgress({ 
          current: Math.min(i + BATCH_SIZE, taskIndices.length), 
          total: taskIndices.length 
        });
        
        // Update tasks after each batch for immediate feedback
        setGeneratedTasks([...updatedTasks]);
      }
      
      setSelectedTasks(new Set());
      
      if (successCount > 0) {
        setError(`✅ Successfully extended ${successCount} tasks`);
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Bulk extend failed:', err);
      setError('Failed to extend tasks');
    } finally {
      setBulkExtending(false);
      setBulkExtendProgress({ current: 0, total: 0 });
    }
  };
  
  // Copy WordPress code to clipboard
  const copyWordPressCode = async () => {
    try {
      await navigator.clipboard.writeText(wordpressAnalyzerCode);
      setError('✅ WordPress Analyzer code copied to clipboard!');
      setTimeout(() => setError(''), 3000);
    } catch (err) {
      setError('Failed to copy code. Please try selecting and copying manually.');
    }
  };
  
  // Randomize time entries
  const randomizeTimes = () => {
    // Group tasks by date
    const tasksByDate: { [date: string]: GeneratedTask[] } = {};
    generatedTasks.forEach(task => {
      if (!tasksByDate[task.date]) {
        tasksByDate[task.date] = [];
      }
      tasksByDate[task.date].push(task);
    });
    
    const updatedTasks: GeneratedTask[] = [];
    
    // Process each day's tasks
    Object.entries(tasksByDate).forEach(([date, dayTasks]) => {
      // Calculate current total for the day
      const currentDayTotal = dayTasks.reduce((sum, task) => sum + parseFloat(task.time), 0);
      
      // Generate a random daily variation between -30 to +30 minutes
      const dailyVariationMin = -0.5; // -30 minutes
      const dailyVariationMax = 0.5;  // +30 minutes
      const dailyVariation = Math.random() * (dailyVariationMax - dailyVariationMin) + dailyVariationMin;
      
      // New target for the day
      const newDayTarget = currentDayTotal + dailyVariation;
      
      // Randomize individual tasks within the day
      let randomizedTasks = dayTasks.map(task => {
        const currentTime = parseFloat(task.time);
        
        // Individual task variation between -10 to +10 minutes
        const taskVariationMin = -0.17; // -10 minutes
        const taskVariationMax = 0.17;  // +10 minutes
        const taskVariation = Math.random() * (taskVariationMax - taskVariationMin) + taskVariationMin;
        
        let newTime = currentTime + taskVariation;
        // Ensure minimum 15 minutes (0.25 hours)
        newTime = Math.max(0.25, newTime);
        
        return {
          ...task,
          time: newTime.toFixed(2)
        };
      });
      
      // Calculate new total after individual randomization
      const randomizedTotal = randomizedTasks.reduce((sum, task) => sum + parseFloat(task.time), 0);
      
      // Adjust proportionally to match the new day target
      const adjustment = newDayTarget / randomizedTotal;
      randomizedTasks = randomizedTasks.map(task => {
        const adjustedTime = parseFloat(task.time) * adjustment;
        // Ensure minimum 15 minutes
        const finalTime = Math.max(0.25, adjustedTime);
        return {
          ...task,
          time: finalTime.toFixed(2)
        };
      });
      
      updatedTasks.push(...randomizedTasks);
    });
    
    // Sort by date to maintain order
    updatedTasks.sort((a, b) => a.date.localeCompare(b.date));
    
    setGeneratedTasks(updatedTasks);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl shadow-lg p-6 mb-0">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Brain className="w-10 h-10" />
                AI Time Log Generator
              </h1>
              <p className="text-blue-100 mt-2">Generate realistic developer time logs with AI assistance</p>
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".json"
                onChange={importConfiguration}
                className="hidden"
                id="config-import"
              />
              <label
                htmlFor="config-import"
                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 cursor-pointer flex items-center gap-2 text-sm"
              >
                <FileUp className="w-4 h-4" />
                Import Config
              </label>
              <button
                onClick={exportConfiguration}
                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 flex items-center gap-2 text-sm"
              >
                <FileDown className="w-4 h-4" />
                Export Config
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="bg-white rounded-b-xl shadow-lg">
          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800">{error}</span>
            </div>
          )}
          
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Column 1 - Essential Settings */}
              <div className="space-y-4">
                {/* Date Range & Settings */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      Configuration
                    </h2>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hours per Day</label>
                      <input
                        type="number"
                        value={targetHoursPerDay}
                        onChange={(e) => setTargetHoursPerDay(Number(e.target.value))}
                        min="1"
                        max="12"
                        step="0.5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
            
                {/* Projects */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Projects</h2>
                  </div>
                  <div className="p-4">
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={projectInput}
                        onChange={(e) => setProjectInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && projectInput) {
                            setProjects([...projects, projectInput]);
                            setProjectInput('');
                          }
                        }}
                        placeholder="Add project name..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          if (projectInput) {
                            setProjects([...projects, projectInput]);
                            setProjectInput('');
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {projects.map((project, index) => (
                        <span key={index} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {project}
                          <button
                            onClick={() => setProjects(projects.filter((_, i) => i !== index))}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Column 2 - Data Inputs */}
              <div className="space-y-4">
                {/* WordPress Output */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-600" />
                      WordPress Data
                    </h2>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={wordpressOutput}
                      onChange={(e) => handleWordPressOutput(e.target.value)}
                      placeholder="Paste WordPress plugin output here..."
                      className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {parsedActivities.length > 0 && (
                      <p className="mt-2 text-sm text-green-600">
                        ✓ Parsed {parsedActivities.length} activities
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => setShowWordPressCode(!showWordPressCode)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        {showWordPressCode ? 'Hide' : 'Show'} WordPress Analyzer Code
                      </button>
                    </div>
                  </div>
                </div>

                {/* Document Upload (.docx/.xlsx) */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileUp className="w-5 h-5 text-gray-600" />
                      Document Data (.docx / .xlsx)
                    </h2>
                    <label htmlFor="doc-upload" className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer">
                      Upload
                    </label>
                    <input id="doc-upload" type="file" accept=".docx,.xlsx" onChange={handleDocumentUpload} className="hidden" />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="text-sm text-gray-600">
                      {docActivities.length > 0 ? (
                        <span>Loaded: {documentInfo}</span>
                      ) : (
                        <span>No document loaded</span>
                      )}
                    </div>
                    {docSheets.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs text-gray-500">Optional: assign dates to sheets (used when activity has no date).</div>
                        <div className="grid grid-cols-1 gap-2">
                          {docSheets.map((s) => (
                            <div key={s} className="flex items-center gap-2">
                              <span className="w-40 text-sm text-gray-700 truncate">{s}</span>
                              <input
                                type="date"
                                value={sheetDates[s] || ''}
                                onChange={(e) => setSheetDates({ ...sheetDates, [s]: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        id="use-doc-chronology"
                        type="checkbox"
                        checked={useDocumentChronology}
                        onChange={(e) => setUseDocumentChronology(e.target.checked)}
                      />
                      <label htmlFor="use-doc-chronology" className="text-sm text-gray-700">
                        Generate strictly from document chronology (ignore AI)
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* WordPress Analyzer Code */}
                {showWordPressCode && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-sm font-semibold">WordPress Analyzer Plugin Code</h3>
                      <button
                        onClick={copyWordPressCode}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Copy Code
                      </button>
                    </div>
                    <div className="p-4">
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre-wrap">{wordpressAnalyzerCode}</pre>
                      </div>
                      <div className="mt-3 text-xs text-gray-600 space-y-1">
                        <p>📋 <strong>How to use:</strong></p>
                        <ol className="list-decimal list-inside space-y-1 ml-4">
                          <li>Copy this code and add it to your WordPress theme's functions.php file</li>
                          <li>Visit your site with <code className="bg-gray-100 px-1 rounded">?wp_analyzer=1</code> to see the analyzer</li>
                          <li>Use <code className="bg-gray-100 px-1 rounded">?test_analyzer=1</code> to test if it's working</li>
                          <li>Copy the JSON output and paste it in the WordPress Data field above</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Screenshots */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Upload className="w-5 h-5 text-gray-600" />
                      Screenshots
                    </h2>
                  </div>
                  <div className="p-4">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleScreenshotUpload}
                      className="hidden"
                      id="screenshot-upload"
                    />
                    <label
                      htmlFor="screenshot-upload"
                      className={`block w-full p-3 border-2 border-dashed rounded-md text-center cursor-pointer transition-colors ${
                        isDragging 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                      }`}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      {analyzingScreenshot ? (
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                          <span>Analyzing...</span>
                        </div>
                      ) : isDragging ? (
                        <span className="text-sm text-blue-600 font-medium">Drop screenshots here</span>
                      ) : (
                        <span className="text-sm text-gray-600">Drop screenshots or click to upload</span>
                      )}
                    </label>
                    {screenshots.length > 0 && (
                      <div className="mt-3">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {screenshots.map(s => (
                            <div key={s.id} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="flex items-center justify-between">
                                <span className="truncate flex-1 font-medium">{s.fileName}</span>
                                {s.date && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded ml-2">
                                    {s.date}
                                  </span>
                                )}
                              </div>
                              {s.analysis && (
                                <div className="mt-1 text-xs text-gray-600">
                                  <span className="font-medium">{s.analysis.platform}</span>
                                  {s.analysis.summary && (
                                    <span className="ml-1">- {s.analysis.summary}</span>
                                  )}
                                  {s.analysis.projects && s.analysis.projects.length > 0 && (
                                    <div className="mt-1">
                                      Projects: {s.analysis.projects.join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 text-center">
                          {screenshots.filter(s => s.analysis && s.analysis.platform !== 'Unknown').length} of {screenshots.length} screenshots analyzed
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Column 3 - Additional Settings */}
              <div className="space-y-4">
                {/* Excluded Days */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold">Excluded Days</h2>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <input
                        type="date"
                        value={excludedDayInput}
                        onChange={(e) => setExcludedDayInput(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={excludedDayHours}
                          onChange={(e) => setExcludedDayHours(Number(e.target.value))}
                          placeholder="Hours"
                          min="0"
                          max="12"
                          step="0.5"
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <button
                          onClick={addExcludedDay}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {excludedDays.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {excludedDays.map((day, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                            <span>{day.date}</span>
                            <span className={day.targetHours === 0 ? 'text-red-600' : 'text-blue-600'}>
                              {day.targetHours === 0 ? 'Excluded' : `${day.targetHours}h`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
            
                {/* Custom Activities */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-gray-600" />
                      Custom Activities
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2 mb-3">
                      <input
                        type="date"
                        value={customActivityDate}
                        onChange={(e) => setCustomActivityDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <textarea
                        value={customActivityDescription}
                        onChange={(e) => setCustomActivityDescription(e.target.value)}
                        placeholder="Activity description..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-16 resize-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={customActivityDuration}
                          onChange={(e) => setCustomActivityDuration(Number(e.target.value))}
                          placeholder="Hours"
                          min="0.25"
                          max="8"
                          step="0.25"
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <button
                          onClick={addCustomActivity}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Add Activity
                        </button>
                      </div>
                    </div>
                    {customActivities.length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {customActivities.map((activity) => (
                          <div key={activity.id} className="p-2 bg-gray-50 rounded text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium">{activity.date}</span>
                                <span className="mx-2 text-gray-500">•</span>
                                <span className="text-blue-600">{activity.duration}h</span>
                              </div>
                              <button
                                onClick={() => removeCustomActivity(activity.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ×
                              </button>
                            </div>
                            <div className="text-gray-600 text-xs mt-1">{activity.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="mt-6">
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setShowPromptEditor(!showPromptEditor)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  {showPromptEditor ? 'Hide Prompt Editor' : 'Customize AI Prompt'}
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={generateTimeLogs}
                  disabled={generating || !startDate || !endDate || projects.length === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Generating Time Logs...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      Generate Time Logs
                    </>
                  )}
                </button>
                
                <span className="text-gray-500 font-medium">OR</span>
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={importCSV}
                  className="hidden"
                  id="csv-import-main"
                />
                <label
                  htmlFor="csv-import-main"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 cursor-pointer flex items-center gap-2 transition-colors"
                >
                  <FileUp className="w-5 h-5" />
                  Import CSV
                </label>
              </div>
            </div>
            
            {/* API Status */}
            {!import.meta.env.VITE_OPENAI_API_KEY && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  ⚠️ No OpenAI API key detected. Add VITE_OPENAI_API_KEY to your .env file to enable AI generation.
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* System Prompt Editor Panel */}
        {showPromptEditor && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6 text-gray-600" />
              System Prompt Editor
            </h2>
            
            <div className="space-y-4">
              {/* Preset Templates */}
              <div>
                <label className="block text-sm font-medium mb-2">Preset Templates:</label>
                <select 
                  onChange={(e) => {
                    const templateKey = e.target.value as keyof typeof promptTemplates;
                    if (templateKey && promptTemplates[templateKey]) {
                      setCustomSystemPrompt(promptTemplates[templateKey]);
                    }
                  }}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Select a preset...</option>
                  {Object.keys(promptTemplates).map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              
              {/* Saved Templates */}
              {savedPrompts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Saved Templates:</label>
                  <select 
                    onChange={(e) => {
                      const template = savedPrompts.find(p => p.name === e.target.value);
                      if (template) loadPromptTemplate(template.prompt);
                    }}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select a saved template...</option>
                    {savedPrompts.map((template, idx) => (
                      <option key={idx} value={template.name}>{template.name}</option>
                    ))}
                  </select>
                  {savedPrompts.length > 0 && (
                    <button
                      onClick={() => {
                        const toDelete = prompt('Enter template name to delete:');
                        if (toDelete) {
                          const updated = savedPrompts.filter(p => p.name !== toDelete);
                          setSavedPrompts(updated);
                          localStorage.setItem('savedPrompts', JSON.stringify(updated));
                        }
                      }}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Delete saved template
                    </button>
                  )}
                </div>
              )}
              
              {/* Prompt Editor */}
              <div>
                <label className="block text-sm font-medium mb-2">System Prompt (Full Editor):</label>
                <textarea
                  value={customSystemPrompt}
                  onChange={(e) => setCustomSystemPrompt(e.target.value)}
                  className="w-full h-96 p-4 border-2 border-gray-300 rounded-md font-mono text-sm leading-relaxed resize-y"
                  placeholder="Enter your custom system prompt here..."
                  style={{ minHeight: '400px' }}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">
                    Tip: You can resize this editor by dragging the bottom-right corner. The full prompt is editable.
                  </p>
                  <p className="text-xs text-gray-500">
                    {customSystemPrompt.length} characters
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={savePrompt}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {promptSaved ? '✓ Saved!' : 'Save Prompt'}
                </button>
                
                <button
                  onClick={resetToDefault}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset to Default
                </button>
                
                <button
                  onClick={() => {
                    const name = prompt('Enter template name:');
                    if (name) savePromptTemplate(name);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save as Template
                </button>
              </div>
              
              {/* Prompt Guidelines */}
              <div className="mt-4 p-4 bg-blue-100 rounded-md">
                <h3 className="font-semibold text-sm mb-2">Prompt Structure:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Priority Rules</strong>: Define how AI should use real vs generic data</li>
                  <li>• <strong>Task Descriptions</strong>: Specify technical detail level and terminology</li>
                  <li>• <strong>Task Variety</strong>: List types of tasks to include</li>
                  <li>• <strong>Time Allocation</strong>: Set realistic time ranges for different task types</li>
                  <li>• <strong>Specificity</strong>: Instructions for referencing pages and components</li>
                  <li>• <strong>Context</strong>: Day-of-week patterns and workflow considerations</li>
                </ul>
                <p className="text-xs text-gray-600 mt-2">
                  The prompt should always prioritize using real WordPress activities and screenshots over generic tasks.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Results */}
        {generatedTasks.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-green-50 px-6 py-4 border-b border-green-100">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    Generated Time Logs
                    <span className="text-sm font-normal text-gray-600">({generatedTasks.length} entries)</span>
                  </h2>
                  <div className="flex bg-white rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-3 py-1 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
                        viewMode === 'table' 
                          ? 'bg-green-600 text-white' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <Table className="w-4 h-4" />
                      Table
                    </button>
                    <button
                      onClick={() => setViewMode('calendar')}
                      className={`px-3 py-1 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
                        viewMode === 'calendar' 
                          ? 'bg-green-600 text-white' 
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <CalendarDays className="w-4 h-4" />
                      Calendar
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Total Hours:</span>
                    <span className="ml-2 font-bold text-green-700">
                      {generatedTasks.reduce((sum, task) => sum + parseFloat(task.time), 0).toFixed(2)}h
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={importCSV}
                    className="hidden"
                    id="csv-import"
                  />
                  <label
                    htmlFor="csv-import"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <FileUp className="w-4 h-4" />
                    Import CSV
                  </label>
                  <button
                    onClick={randomizeTimes}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium transition-colors"
                    title="Randomize time values to make them more realistic"
                  >
                    <Shuffle className="w-4 h-4" />
                    Randomize
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6">
              {viewMode === 'table' ? (
                <>
                  {selectedTasks.size > 0 && (
                    <div className="mb-4 flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={() => setShowBulkExtendDialog(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        <Maximize2 className="w-4 h-4" />
                        <span>Bulk Extend</span>
                      </button>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTasks.size === generatedTasks.length && generatedTasks.length > 0}
                          indeterminate={selectedTasks.size > 0 && selectedTasks.size < generatedTasks.length}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(showAllEntries ? generatedTasks : generatedTasks.slice(0, 10)).map((task, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedTasks.has(index)}
                            onChange={() => toggleTaskSelection(index)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{task.date}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 whitespace-nowrap">
                          {editingTime === index ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={editedTimeValue}
                                onChange={(e) => setEditedTimeValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditedTime(index);
                                  if (e.key === 'Escape') setEditingTime(null);
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                step="0.01"
                                min="0.01"
                                autoFocus
                              />
                              <button
                                onClick={() => saveEditedTime(index)}
                                className="text-green-600 hover:text-green-800"
                                title="Save"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingTime(null)}
                                className="text-red-600 hover:text-red-800"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingTime(index);
                                setEditedTimeValue(task.time);
                              }}
                              className="hover:bg-gray-100 px-2 py-1 rounded transition-colors cursor-pointer"
                              title="Click to edit"
                            >
                              {TimeFormatter.toHoursMinutesSeconds(parseFloat(task.time))}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {editingTask === index ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editedTaskText}
                                onChange={(e) => setEditedTaskText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditedTask(index);
                                  if (e.key === 'Escape') setEditingTask(null);
                                }}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => saveEditedTask(index)}
                                className="text-green-600 hover:text-green-800"
                                title="Save"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingTask(null)}
                                className="text-red-600 hover:text-red-800"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            task.task
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {task.taskType === 'custom' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Custom
                            </span>
                          )}
                          {task.taskType === 'wordpress' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              WordPress
                            </span>
                          )}
                          {task.taskType === 'screenshot' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Screenshot
                            </span>
                          )}
                          {(task.taskType === 'generic' || !task.taskType) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Generic
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTask(index);
                                setEditedTaskText(task.task);
                              }}
                              className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                              title="Edit task"
                            >
                              <Edit2 className="w-4 h-4" />
                              <span className="text-xs">Edit</span>
                            </button>
                            <button
                              onClick={() => setExtendingTask(index)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              title="Extend description"
                            >
                              <Maximize2 className="w-4 h-4" />
                              <span className="text-xs">Extend</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                    </table>
                  </div>
                  {generatedTasks.length > 10 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAllEntries(!showAllEntries)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {showAllEntries ? 'Show less' : `Show all ${generatedTasks.length} entries`}
                      </button>
                    </div>
                  )}
                  
                  {/* Task Type Summary */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Task Types:</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-purple-700">
                          Custom: {generatedTasks.filter(t => t.taskType === 'custom').length}
                        </span>
                        <span className="text-blue-700">
                          WordPress: {generatedTasks.filter(t => t.taskType === 'wordpress').length}
                        </span>
                        <span className="text-green-700">
                          Screenshot: {generatedTasks.filter(t => t.taskType === 'screenshot').length}
                        </span>
                        <span className="text-gray-600">
                          Generic: {generatedTasks.filter(t => t.taskType === 'generic' || !t.taskType).length}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Calendar View */
                <div>
                  <div className="grid grid-cols-7 gap-px bg-gray-200">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-700">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-gray-200 mt-px">
                    {getCalendarWeeks().map((week, weekIndex) => (
                      week.map((day, dayIndex) => (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`bg-white min-h-[100px] p-2 ${
                            day ? 'hover:bg-gray-50' : ''
                          }`}
                        >
                          {day && (
                            <>
                              <div className="text-sm font-medium text-gray-900">
                                {day.date.getDate()}
                              </div>
                              {day.hours > 0 && (
                                <>
                                  <div className="mt-1 text-lg font-bold text-green-600">
                                    {day.hours.toFixed(2)}h
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {day.tasks.length} {day.tasks.length === 1 ? 'task' : 'tasks'}
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {day.tasks.slice(0, 2).map((task, idx) => (
                                      <div
                                        key={idx}
                                        className="text-xs text-gray-600 truncate"
                                        title={task.task}
                                      >
                                        • {task.task}
                                      </div>
                                    ))}
                                    {day.tasks.length > 2 && (
                                      <div className="text-xs text-gray-400">
                                        +{day.tasks.length - 2} more
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                              {day.hours === 0 && (
                                <div className="mt-1 text-sm text-gray-400">
                                  No tasks
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))
                    ))}
                  </div>
                  
                  {/* Calendar Summary */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Working Days:</span>
                        <span className="ml-2 font-medium">
                          {Object.values(generateCalendarData() || {}).filter(d => d.hours > 0).length}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Average Hours/Day:</span>
                        <span className="ml-2 font-medium">
                          {(generatedTasks.reduce((sum, task) => sum + parseFloat(task.time), 0) / 
                            Object.values(generateCalendarData() || {}).filter(d => d.hours > 0).length).toFixed(2)}h
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Date Range:</span>
                        <span className="ml-2 font-medium">
                          {startDate} - {endDate}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Extend Task Dialog */}
        {extendingTask !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-semibold">Extend Task</h3>
                <button
                  onClick={() => setExtendingTask(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-1">Current task:</p>
                <p className="text-xs bg-gray-50 p-2 rounded truncate">{generatedTasks[extendingTask]?.task}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-xs font-medium mb-2">Extension level:</p>
                <div className="space-y-1">
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="brief"
                      checked={extendLevel === 'brief'}
                      onChange={(e) => setExtendLevel(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium text-xs">Brief</p>
                      <p className="text-xs text-gray-500">+1-2 details</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="detailed"
                      checked={extendLevel === 'detailed'}
                      onChange={(e) => setExtendLevel(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium text-xs">Detailed</p>
                      <p className="text-xs text-gray-500">+3-4 details</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="comprehensive"
                      checked={extendLevel === 'comprehensive'}
                      onChange={(e) => setExtendLevel(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium text-xs">Comprehensive</p>
                      <p className="text-xs text-gray-500">+5-6 details</p>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setExtendingTask(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={extendingInProgress}
                >
                  Cancel
                </button>
                <button
                  onClick={() => extendTaskDescription(extendingTask)}
                  disabled={extendingInProgress}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {extendingInProgress ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Extending...</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span>Extend Task</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Bulk Extend Progress Overlay */}
        {bulkExtending && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
              <div className="text-center">
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Extending Tasks</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Processing {bulkExtendProgress.current} of {bulkExtendProgress.total} tasks
                  </p>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${bulkExtendProgress.total > 0 
                        ? (bulkExtendProgress.current / bulkExtendProgress.total) * 100 
                        : 0}%` 
                    }}
                  />
                </div>
                
                <p className="text-xs text-gray-500">
                  This may take a few moments. Tasks are being processed in batches for better performance.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Bulk Extend Dialog */}
        {showBulkExtendDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-semibold">Bulk Extend Tasks</h3>
                <button
                  onClick={() => setShowBulkExtendDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-3">
                <p className="text-sm text-gray-600">
                  Extending {selectedTasks.size} selected task{selectedTasks.size > 1 ? 's' : ''}
                </p>
              </div>
              
              <div className="mb-4">
                <p className="text-xs font-medium mb-2">Extension level:</p>
                <div className="space-y-1">
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="brief"
                      checked={bulkExtendLevel === 'brief'}
                      onChange={(e) => setBulkExtendLevel(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium text-xs">Brief</p>
                      <p className="text-xs text-gray-500">+1-2 details per task</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="detailed"
                      checked={bulkExtendLevel === 'detailed'}
                      onChange={(e) => setBulkExtendLevel(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium text-xs">Detailed</p>
                      <p className="text-xs text-gray-500">+3-4 details per task</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-2 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      value="comprehensive"
                      checked={bulkExtendLevel === 'comprehensive'}
                      onChange={(e) => setBulkExtendLevel(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <p className="font-medium text-xs">Comprehensive</p>
                      <p className="text-xs text-gray-500">+5-6 details per task</p>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkExtendDialog(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm"
                  disabled={bulkExtending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowBulkExtendDialog(false);
                    bulkExtendTasks();
                  }}
                  disabled={bulkExtending}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm"
                >
                  {bulkExtending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Extending...</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span>Extend All</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeLogGenerator;
