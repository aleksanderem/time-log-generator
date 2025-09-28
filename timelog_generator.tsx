import React, { useState } from 'react';
import { Calendar, Clock, FileText, AlertCircle, Download, Plus, Trash2, Code, Copy, CheckCircle } from 'lucide-react';

const TimeLogGenerator = () => {
  const [config, setConfig] = useState({
    startDate: '',
    endDate: '',
    excludedDays: [],
    currentProjects: [],
    teamCommunications: [],
    targetHoursPerDay: 8,
    timeFormat: 'minutes', // 'minutes' or 'decimal'
    wordpressUrl: '',
    apiKey: '',
    useWordPressData: false,
    wordpressJson: ''
  });
  
  const [wpData, setWpData] = useState({
    posts: [],
    pages: [],
    media: [],
    activityData: [],
    isCustomAPI: false,
    loading: false,
    error: null,
    lastFetch: null,
    jsonProcessing: false
  });
  
  const [generatedLogs, setGeneratedLogs] = useState([]);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [excludeDayInput, setExcludeDayInput] = useState('');
  const [excludeReasonInput, setExcludeReasonInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [communicationInput, setCommunicationInput] = useState('');
  const [communicationDateInput, setCommunicationDateInput] = useState('');
  const [uploadedScreenshots, setUploadedScreenshots] = useState([]);
  const [screenshotAnalyzing, setScreenshotAnalyzing] = useState(false);
  const [pendingScreenshotAnalysis, setPendingScreenshotAnalysis] = useState(null);
  const [showAnalysisPreview, setShowAnalysisPreview] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('smart'); // 'smart', 'manual', 'ocr'

  // WordPress Retrospective Analyzer - kompaktowy kod
  const retroAnalyzerCode = `<?php
/**
 * WordPress Retrospective Activity Analyzer
 * Analizuje przeszłą aktywność WordPress dla time logów
 */

if (!defined('ABSPATH')) exit('Bezpośredni dostęp zabroniony');

class WP_Retrospective_Analyzer {
    private $api_key;
    
    public function __construct() {
        $this->api_key = get_option('wp_retro_analyzer_key');
        if (!$this->api_key) {
            $this->api_key = 'wp_retro_' . wp_generate_password(20, false);
            update_option('wp_retro_analyzer_key', $this->api_key);
            update_option('wp_retro_analyzer_installed', current_time('mysql'));
        }
        add_action('init', array($this, 'init'));
    }
    
    public function init() {
        add_action('rest_api_init', array($this, 'register_api'));
        if (is_admin() && current_user_can('manage_options')) {
            add_action('admin_notices', array($this, 'show_api_info'));
        }
    }
    
    public function register_api() {
        register_rest_route('wp-retro/v1', '/analyze', array(
            'methods' => 'GET',
            'callback' => array($this, 'analyze_historical_activity'),
            'permission_callback' => array($this, 'verify_key'),
        ));
    }
    
    public function verify_key($request) {
        $key = $request->get_param('api_key') ?: $request->get_header('X-API-Key');
        return $key === $this->api_key;
    }
    
    public function analyze_historical_activity($request) {
        global $wpdb;
        
        $start_date = $request->get_param('start_date') ?: date('Y-m-d', strtotime('-30 days'));
        $end_date = $request->get_param('end_date') ?: date('Y-m-d');
        $limit = intval($request->get_param('limit')) ?: 500;
        
        $activities = array();
        
        // Analiza modyfikacji stron
        $modified_posts = $wpdb->get_results($wpdb->prepare(
            "SELECT p.*, 
                    (SELECT COUNT(*) FROM {$wpdb->posts} r WHERE r.post_parent = p.ID AND r.post_type = 'revision') as revision_count
             FROM {$wpdb->posts} p 
             WHERE p.post_type IN ('post', 'page') 
             AND p.post_status = 'publish'
             AND DATE(p.post_modified) BETWEEN %s AND %s
             AND p.post_modified != p.post_date
             ORDER BY p.post_modified DESC
             LIMIT %d",
            $start_date, $end_date, $limit
        ));
        
        foreach ($modified_posts as $post) {
            $word_count = str_word_count(strip_tags($post->post_content));
            $change_size = $this->estimate_change_size($word_count, $post->revision_count);
            $estimated_time = $this->estimate_time_spent($change_size, $word_count, $post->revision_count);
            $is_important = $this->is_important_page($post->post_title);
            
            if ($is_important) $estimated_time *= 1.3;
            
            $activities[] = array(
                'type' => 'page_modification',
                'action' => 'updated',
                'title' => $post->post_title,
                'post_type' => $post->post_type,
                'word_count' => $word_count,
                'revision_count' => $post->revision_count,
                'change_size' => $change_size,
                'estimated_time' => round($estimated_time, 2),
                'is_important' => $is_important,
                'date' => $post->post_modified,
                'day' => date('Y-m-d', strtotime($post->post_modified)),
                'analysis_source' => 'post_modification_history'
            );
        }
        
        // Analiza nowych treści
        $new_posts = $wpdb->get_results($wpdb->prepare(
            "SELECT p.* FROM {$wpdb->posts} p 
             WHERE p.post_type IN ('post', 'page') 
             AND p.post_status = 'publish'
             AND DATE(p.post_date) BETWEEN %s AND %s
             ORDER BY p.post_date DESC LIMIT %d",
            $start_date, $end_date, $limit
        ));
        
        foreach ($new_posts as $post) {
            $word_count = str_word_count(strip_tags($post->post_content));
            $estimated_time = $this->estimate_creation_time($word_count);
            
            $activities[] = array(
                'type' => 'page_creation',
                'action' => 'created',
                'title' => $post->post_title,
                'word_count' => $word_count,
                'estimated_time' => round($estimated_time, 2),
                'date' => $post->post_date,
                'day' => date('Y-m-d', strtotime($post->post_date)),
                'analysis_source' => 'post_creation_history'
            );
        }
        
        // Analiza upload'ów mediów
        $media_uploads = $wpdb->get_results($wpdb->prepare(
            "SELECT p.* FROM {$wpdb->posts} p 
             WHERE p.post_type = 'attachment' 
             AND DATE(p.post_date) BETWEEN %s AND %s
             ORDER BY p.post_date DESC LIMIT %d",
            $start_date, $end_date, $limit
        ));
        
        foreach ($media_uploads as $media) {
            $is_image = strpos($media->post_mime_type, 'image/') === 0;
            $estimated_time = $is_image ? 0.7 : 0.4;
            
            $activities[] = array(
                'type' => 'media_upload',
                'action' => 'uploaded',
                'title' => 'Media: ' . $media->post_title,
                'file_type' => $media->post_mime_type,
                'is_image' => $is_image,
                'estimated_time' => round($estimated_time, 2),
                'date' => $media->post_date,
                'day' => date('Y-m-d', strtotime($media->post_date)),
                'analysis_source' => 'media_upload_history'
            );
        }
        
        // Sortowanie i grupowanie
        usort($activities, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        
        $by_day = array();
        foreach ($activities as $activity) {
            $day = $activity['day'];
            if (!isset($by_day[$day])) {
                $by_day[$day] = array('count' => 0, 'activities' => array(), 'total_time' => 0);
            }
            $by_day[$day]['count']++;
            $by_day[$day]['activities'][] = $activity;
            $by_day[$day]['total_time'] += floatval($activity['estimated_time']);
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'analysis_type' => 'retrospective',
            'period' => array('start' => $start_date, 'end' => $end_date),
            'total_activities' => count($activities),
            'activities' => $activities,
            'by_day' => $by_day,
            'summary' => array(
                'analyzed_days' => count($by_day),
                'activity_breakdown' => array(
                    'page_modifications' => count(array_filter($activities, function($a) { return $a['type'] === 'page_modification'; })),
                    'page_creations' => count(array_filter($activities, function($a) { return $a['type'] === 'page_creation'; })),
                    'media_uploads' => count(array_filter($activities, function($a) { return $a['type'] === 'media_upload'; }))
                )
            )
        ), 200);
    }
    
    private function estimate_change_size($word_count, $revision_count) {
        if ($word_count > 1000 && $revision_count > 5) return 'large';
        if ($word_count > 500 && $revision_count > 3) return 'medium';
        if ($word_count > 200 || $revision_count > 1) return 'small';
        return 'tiny';
    }
    
    private function estimate_time_spent($change_size, $word_count, $revision_count) {
        $base_times = array('large' => 2.3, 'medium' => 1.6, 'small' => 1.1, 'tiny' => 0.6);
        $base_time = $base_times[$change_size] ?? 0.8;
        $revision_bonus = min(0.8, $revision_count * 0.15);
        $word_bonus = min(0.6, ($word_count / 1000) * 0.3);
        return $base_time + $revision_bonus + $word_bonus;
    }
    
    private function estimate_creation_time($word_count) {
        $base_time = 1.8;
        if ($word_count > 1000) return $base_time + 1.2;
        if ($word_count > 500) return $base_time + 0.8;
        if ($word_count > 200) return $base_time + 0.4;
        return $base_time;
    }
    
    private function is_important_page($title) {
        $keywords = array('home', 'homepage', 'technology', 'about', 'contact', 'services', 'products');
        $title_lower = strtolower($title);
        foreach ($keywords as $keyword) {
            if (strpos($title_lower, $keyword) !== false) return true;
        }
        return false;
    }
    
    public function show_api_info() {
        $site_url = get_site_url();
        echo '<div class="notice notice-success is-dismissible" style="border-left: 4px solid #00a32a;">';
        echo '<h3>🔍 WordPress Retrospective Activity Analyzer - Gotowy!</h3>';
        echo '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0;">';
        echo '<div>';
        echo '<p><strong>🌐 API URL:</strong><br><code style="background: #f0f0f1; padding: 8px; display: block; margin: 5px 0; border-radius: 3px;">' . $site_url . '/wp-json/wp-retro/v1/analyze</code></p>';
        echo '<p><strong>🔑 API Key:</strong><br><code style="background: #f0f0f1; padding: 8px; display: block; margin: 5px 0; border-radius: 3px; word-break: break-all;">' . $this->api_key . '</code></p>';
        echo '</div>';
        echo '<div>';
        echo '<p><strong>📋 Przykład:</strong><br><code style="background: #f0f0f1; padding: 8px; font-size: 10px; display: block; margin: 5px 0; border-radius: 3px; word-break: break-all;">' . $site_url . '/wp-json/wp-retro/v1/analyze?api_key=' . substr($this->api_key, 0, 12) . '...&start_date=2024-06-01&end_date=2024-08-31</code></p>';
        echo '</div>';
        echo '</div>';
        echo '<div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 15px 0;">';
        echo '<h4 style="margin: 0 0 10px 0; color: #1e40af;">🎯 Co analizuje:</h4>';
        echo '<ul style="margin: 0; padding-left: 20px; color: #1e40af;">';
        echo '<li><strong>📝 Edycje stron:</strong> Kiedy, jak dużo, ile rewizji</li>';
        echo '<li><strong>✨ Nowe treści:</strong> Utworzone w wybranym okresie</li>';
        echo '<li><strong>📁 Upload mediów:</strong> Pliki, obrazy, optymalizacja</li>';
        echo '<li><strong>⏱️ Szacowany czas:</strong> Na podstawie rozmiaru i złożoności</li>';
        echo '</ul>';
        echo '<p style="margin: 10px 0 0 0; font-weight: 600; color: #059669;">Działa dla PRZESZŁYCH okresów!</p>';
        echo '</div>';
        echo '</div>';
    }
}

function wp_retrospective_analyzer_init() {
    new WP_Retrospective_Analyzer();
}
add_action('plugins_loaded', 'wp_retrospective_analyzer_init');

/**
 * INSTRUKCJA:
 * 1. Skopiuj cały kod
 * 2. Wklej na końcu functions.php w WordPress  
 * 3. Sprawdź dashboard - pojawi się API key
 * 4. Użyj w Time Log Generator
 */
?>`;

  // Szablony zadań
  const taskTemplates = {
    frontend: [
      "Applied feedback to {page} template (responsive fixes, layout adjustments)",
      "Initial implementation of {feature} page layout",
      "Continued work on {component} visual structure and logic", 
      "Final layout adjustments for {page} before QA review",
      "Hero section resizing and content structure optimization",
      "Navigation improvements and responsive behavior fixes",
      "CSS animations and micro-interactions for {component}",
      "Cross-browser compatibility testing and fixes"
    ],
    backend: [
      "After {service} migration testing and verification",
      "Database optimization and query performance improvements",
      "API endpoint development for {feature} functionality",
      "Server configuration updates and monitoring setup",
      "Integration testing between services",
      "Performance profiling and bottleneck identification"
    ],
    maintenance: [
      "Update Elementor to alpha version for editor compatibility",
      "WordPress core update with plugin compatibility testing",
      "Plugin security audit and updates",
      "Database cleanup and optimization",
      "Development environment sync and staging refresh",
      "Code review and documentation updates",
      "Backup verification and disaster recovery testing",
      "Performance monitoring and Core Web Vitals optimization",
      "Security audit based on CVE notifications",
      "SSL certificate renewal and HTTPS verification"
    ]
  };

  const copyCodeToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(retroAnalyzerCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 3000);
    } catch (err) {
      console.error('Błąd kopiowania:', err);
    }
  };

  const processWordPressJSON = async (jsonString) => {
    if (!jsonString?.trim()) return;
    
    setWpData(prev => ({ ...prev, jsonProcessing: true, error: null }));
    
    try {
      // Symulacja przetwarzania dla UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const data = JSON.parse(jsonString);
      
      if (data.success && data.activities) {
        setWpData({
          posts: [],
          pages: [],
          media: [],
          activityData: data.activities,
          isCustomAPI: true,
          loading: false,
          error: null,
          lastFetch: new Date().toISOString(),
          jsonProcessing: false
        });
        
        setConfig(prev => ({...prev, useWordPressData: true}));
        
        // Sukces z detalami
        const stats = data.summary;
        alert(`✅ Pomyślnie załadowano!\n\n📊 ${data.activities.length} aktywności\n📅 ${stats.analyzed_days} dni\n📝 ${stats.activity_breakdown.page_modifications} modyfikacji\n✨ ${stats.activity_breakdown.page_creations} nowych treści\n📁 ${stats.activity_breakdown.media_uploads} mediów`);
      } else {
        throw new Error('Nieprawidłowy format JSON z WordPress Analyzer');
      }
    } catch (error) {
      setWpData(prev => ({ ...prev, jsonProcessing: false, error: `Błąd przetwarzania JSON: ${error.message}` }));
    }
  };

  const downloadCode = () => {
    const blob = new Blob([retroAnalyzerCode], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wordpress-retrospective-analyzer.php';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const addExcludedDay = () => {
    if (excludeDayInput && excludeReasonInput) {
      setConfig(prev => ({
        ...prev,
        excludedDays: [...prev.excludedDays, {
          date: excludeDayInput,
          reason: excludeReasonInput,
          targetHours: null // Domyślnie używaj globalnej wartości
        }]
      }));
      setExcludeDayInput('');
      setExcludeReasonInput('');
    }
  };

  const updateDayTargetHours = (dayIndex, hours) => {
    setConfig(prev => ({
      ...prev,
      excludedDays: prev.excludedDays.map((day, index) => 
        index === dayIndex 
          ? { ...day, targetHours: hours === '' ? null : parseFloat(hours) }
          : day
      )
    }));
  };

  const addCurrentProject = () => {
    if (projectInput.trim()) {
      setConfig(prev => ({
        ...prev,
        currentProjects: [...prev.currentProjects, projectInput.trim()]
      }));
      setProjectInput('');
    }
  };

  const addTeamCommunication = () => {
    if (communicationInput.trim()) {
      const today = new Date().toISOString().split('T')[0];
      setConfig(prev => ({
        ...prev,
        teamCommunications: [...prev.teamCommunications, {
          id: Date.now(),
          date: communicationDateInput || today,
          content: communicationInput.trim(),
          type: communicationInput.includes('screenshot') || communicationInput.includes('screen') ? 'screenshot' : 'text',
          source: 'manual'
        }]
      }));
      setCommunicationInput('');
      setCommunicationDateInput('');
    }
  };

  const analyzeScreenshot = async (file) => {
    setScreenshotAnalyzing(true);
    
    if (analysisMode === 'manual') {
      // Tryb z pomocą użytkownika
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPendingScreenshotAnalysis({
        file: file,
        analyzedContent: '',
        extractedDate: new Date(file.lastModified).toISOString().split('T')[0],
        confidence: 0,
        fileName: file.name,
        needsUserInput: true
      });
      
      setScreenshotAnalyzing(false);
      setShowAnalysisPreview(true);
      return;
    }
    
    // Smart Analysis - ulepszona analiza
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const fileName = file.name.toLowerCase();
    const fileDate = new Date(file.lastModified);
    const formattedDate = fileDate.toISOString().split('T')[0];
    const fileSize = file.size;
    const isLargeFile = fileSize > 500000; // > 500KB = prawdopodobnie szczegółowy screenshot
    
    let analyzedContent = '';
    let confidence = 75;
    let detectedContext = [];
    
    // Analiza nazwy pliku
    if (fileName.includes('teams')) {
      detectedContext.push('Microsoft Teams');
      if (fileName.includes('meet') || fileName.includes('call')) {
        analyzedContent = `Teams video call discussion about project coordination and development progress`;
        confidence += 10;
      } else if (fileName.includes('chat') || fileName.includes('message')) {
        analyzedContent = `Teams chat conversation regarding bug fixes and implementation details`;
        confidence += 8;
      } else {
        analyzedContent = `Teams communication about ${config.currentProjects[0] || 'project'} development tasks`;
        confidence += 5;
      }
    } else if (fileName.includes('slack')) {
      detectedContext.push('Slack');
      if (fileName.includes('thread')) {
        analyzedContent = `Slack thread discussion about code review and deployment strategy`;
        confidence += 12;
      } else {
        analyzedContent = `Slack channel communication regarding development coordination`;
        confidence += 8;
      }
    } else if (fileName.includes('calendar') || fileName.includes('cal')) {
      detectedContext.push('Calendar');
      analyzedContent = `Calendar view showing project deadlines and team meeting schedule`;
      confidence += 15;
    } else if (fileName.includes('email') || fileName.includes('mail') || fileName.includes('outlook')) {
      detectedContext.push('Email');
      analyzedContent = `Email communication regarding project requirements and delivery timeline`;
      confidence += 10;
    } else if (fileName.includes('jira') || fileName.includes('ticket')) {
      detectedContext.push('JIRA/Tickets');
      analyzedContent = `Project management discussion about task priorities and sprint planning`;
      confidence += 12;
    } else if (fileName.includes('github') || fileName.includes('git')) {
      detectedContext.push('Git/GitHub');
      analyzedContent = `Code repository discussion about pull requests and development workflow`;
      confidence += 10;
    } else if (fileName.includes('design') || fileName.includes('figma') || fileName.includes('ui')) {
      detectedContext.push('Design Tools');
      analyzedContent = `Design review discussion about UI/UX improvements and visual updates`;
      confidence += 8;
    }
    
    // Analiza czasowa
    const today = new Date();
    const daysDiff = Math.floor((today - fileDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 1) {
      analyzedContent += ` (recent discussion from today/yesterday)`;
      confidence += 5;
    } else if (daysDiff <= 7) {
      analyzedContent += ` (from this week's coordination)`;
      confidence += 3;
    }
    
    // Analiza rozmiaru pliku
    if (isLargeFile) {
      analyzedContent += ` - detailed screenshot with multiple conversation elements`;
      confidence += 3;
    }
    
    // Fallback dla nierozpoznanych plików
    if (!detectedContext.length) {
      detectedContext.push('General Communication');
      analyzedContent = `Team communication screenshot regarding ${config.currentProjects[0] || 'project'} development and coordination`;
      confidence = 60;
    }
    
    // Dodaj kontekst projektów
    if (config.currentProjects.length > 0) {
      const randomProject = config.currentProjects[Math.floor(Math.random() * config.currentProjects.length)];
      analyzedContent = analyzedContent.replace('project', randomProject);
      confidence += 5;
    }
    
    confidence = Math.min(95, confidence); // Max 95% bo nie jesteśmy Vision API
    
    setPendingScreenshotAnalysis({
      file: file,
      analyzedContent: analyzedContent,
      extractedDate: formattedDate,
      confidence: confidence,
      fileName: file.name,
      detectedContext: detectedContext,
      needsUserInput: false
    });
    
    setScreenshotAnalyzing(false);
    setShowAnalysisPreview(true);
  };

  const confirmScreenshotAnalysis = (editedContent, editedDate) => {
    if (pendingScreenshotAnalysis) {
      setConfig(prev => ({
        ...prev,
        teamCommunications: [...prev.teamCommunications, {
          id: Date.now(),
          date: editedDate,
          content: editedContent,
          type: 'screenshot_analyzed',
          source: 'screenshot',
          fileName: pendingScreenshotAnalysis.fileName,
          // Nie dodajemy fake confidence dla user input
          ...(pendingScreenshotAnalysis.confidence > 0 && { confidence: pendingScreenshotAnalysis.confidence })
        }]
      }));
      
      setPendingScreenshotAnalysis(null);
      setShowAnalysisPreview(false);
    }
  };

  const rejectScreenshotAnalysis = () => {
    if (pendingScreenshotAnalysis) {
      // Usuń screenshot z uploadowanych
      setUploadedScreenshots(prev => 
        prev.filter(s => s.file.name !== pendingScreenshotAnalysis.fileName)
      );
    }
    setPendingScreenshotAnalysis(null);
    setShowAnalysisPreview(false);
  };

  const handleScreenshotUpload = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        setUploadedScreenshots(prev => [...prev, {
          id: Date.now() + Math.random(),
          file: file,
          name: file.name,
          preview: URL.createObjectURL(file)
        }]);
        
        // Automatyczna analiza
        analyzeScreenshot(file);
      }
    });
    
    // Reset input
    event.target.value = '';
  };

  const fetchWordPressData = async (url, apiKey = '') => {
    setWpData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const normalizedUrl = url.replace(/\/$/, '');
      const baseUrl = normalizedUrl.startsWith('http') ? normalizedUrl : `https://${normalizedUrl}`;
      
      let customAPISuccess = false;
      let activityData = [];
      
      // Próba połączenia z Retrospective Analyzer
      if (apiKey) {
        try {
          const activityResponse = await fetch(`${baseUrl}/wp-json/wp-retro/v1/analyze?api_key=${apiKey}&limit=500`);
          if (activityResponse.ok) {
            const activityResult = await activityResponse.json();
            if (activityResult.success && activityResult.activities) {
              activityData = activityResult.activities;
              customAPISuccess = true;
            }
          }
        } catch (error) {
          console.log('Retrospective Analyzer niedostępny');
        }
      }
      
      // Standardowe API WordPress
      const [postsResponse, pagesResponse, mediaResponse] = await Promise.all([
        fetch(`${baseUrl}/wp-json/wp/v2/posts?per_page=50`),
        fetch(`${baseUrl}/wp-json/wp/v2/pages?per_page=50`),
        fetch(`${baseUrl}/wp-json/wp/v2/media?per_page=50`)
      ]);

      if (!postsResponse.ok) {
        throw new Error(`WordPress API niedostępne. Sprawdź czy ${baseUrl}/wp-json/wp/v2/ działa.`);
      }

      const [posts, pages, media] = await Promise.all([
        postsResponse.json(),
        pagesResponse.json(),
        mediaResponse.json()
      ]);

      setWpData({
        posts, pages, media, activityData,
        isCustomAPI: customAPISuccess,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString()
      });

      return true;
    } catch (error) {
      setWpData(prev => ({ ...prev, loading: false, error: error.message }));
      return false;
    }
  };

  const analyzeWordPressChanges = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (wpData.isCustomAPI && wpData.activityData.length > 0) {
      const activityInRange = wpData.activityData.filter(activity => {
        const activityDate = new Date(activity.date);
        return activityDate >= start && activityDate <= end;
      });
      
      const groupedActivity = {};
      activityInRange.forEach(activity => {
        const day = activity.day;
        if (!groupedActivity[day]) {
          groupedActivity[day] = {
            page_modifications: [],
            page_creations: [],
            media_uploads: []
          };
        }
        
        switch (activity.type) {
          case 'page_modification':
            groupedActivity[day].page_modifications.push(activity);
            break;
          case 'page_creation':
            groupedActivity[day].page_creations.push(activity);
            break;
          case 'media_upload':
            groupedActivity[day].media_uploads.push(activity);
            break;
        }
      });
      
      return groupedActivity;
    }
    
    // Fallback standardowe API
    const changes = [];
    [...wpData.posts, ...wpData.pages].forEach(item => {
      const modified = new Date(item.modified);
      if (modified >= start && modified <= end) {
        changes.push({
          date: item.modified.split('T')[0],
          type: 'page_modification',
          title: item.title.rendered
        });
      }
    });
    
    wpData.media.forEach(item => {
      const uploaded = new Date(item.date);
      if (uploaded >= start && uploaded <= end) {
        changes.push({
          date: item.date.split('T')[0],
          type: 'media_upload',
          title: item.title.rendered
        });
      }
    });

    const changesByDate = {};
    changes.forEach(change => {
      if (!changesByDate[change.date]) {
        changesByDate[change.date] = { page_modifications: [], media_uploads: [] };
      }
      changesByDate[change.date][change.type + 's'].push(change);
    });

    return changesByDate;
  };

  const generateWordPressBasedTasks = (activityByDate, projects) => {
    const tasks = [];

    Object.entries(activityByDate).forEach(([date, dayActivity]) => {
      if (dayActivity.page_modifications?.length > 0) {
        dayActivity.page_modifications.forEach(activity => {
          let taskDescription = '';
          let timeEstimate = activity.estimated_time || 1.5;
          
          if (wpData.isCustomAPI) {
            const pageTitle = activity.title || 'content page';
            const changeSize = activity.change_size || 'medium';
            const revisionCount = activity.revision_count || 1;
            
            if (changeSize === 'large') {
              taskDescription = `Substantial content development for ${pageTitle} - comprehensive updates`;
              if (revisionCount > 5) taskDescription += ` (${revisionCount} revisions)`;
            } else if (changeSize === 'medium') {
              taskDescription = `Content refinement for ${pageTitle} - improved structure`;
            } else {
              taskDescription = `Applied feedback and improvements to ${pageTitle}`;
            }
            
            if (activity.is_important) taskDescription += ' (high-priority)';
          } else {
            taskDescription = `Applied feedback to ${activity.title || 'content page'} template`;
            timeEstimate = 1.8;
          }

          tasks.push({
            day: date,
            time: timeEstimate,
            task: taskDescription,
            comments: wpData.isCustomAPI ? `${activity.word_count || 'N/A'} words, ${activity.change_size || 'medium'} change` : 'WordPress API data'
          });
        });
      }

      if (dayActivity.page_creations?.length > 0) {
        const activity = dayActivity.page_creations[0];
        const timeEstimate = activity.estimated_time || 2.3;
        tasks.push({
          day: date,
          time: timeEstimate,
          task: `Initial development and content creation for ${activity.title || 'new content'}`,
          comments: `New content: ${activity.word_count || 'N/A'} words`
        });
      }

      if (dayActivity.media_uploads?.length > 0) {
        const uploadCount = dayActivity.media_uploads.length;
        tasks.push({
          day: date,
          time: (uploadCount > 3 ? 1.3 : 0.9),
          task: `Media asset management - processed ${uploadCount} files`,
          comments: `Media uploads: ${uploadCount} files`
        });
      }
    });

    return tasks;
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

  const generateRandomTime = () => {
    const minMinutes = 30;
    const maxMinutes = 178;
    const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    return randomMinutes / 60;
  };

  const generateTargetedTime = (remainingHours, tasksLeft) => {
    if (tasksLeft <= 1) return remainingHours;
    
    const avgTime = remainingHours / tasksLeft;
    const variation = avgTime * 0.3; // 30% variation
    const minTime = Math.max(0.5, avgTime - variation);
    const maxTime = Math.min(2.8, avgTime + variation);
    
    return Math.random() * (maxTime - minTime) + minTime;
  };

  const getRandomTask = (projects, communications, currentDay) => {
    // Sprawdź czy są komunikacje z tego dnia lub oko 2 dni
    const dayDate = new Date(currentDay);
    const relevantComms = communications.filter(comm => {
      const commDate = new Date(comm.date);
      const diffDays = Math.abs((dayDate - commDate) / (1000 * 60 * 60 * 24));
      return diffDays <= 2; // W obrębie 2 dni
    });
    
    // Jeśli są relevantne komunikacje, wygeneruj zadanie oparte na nich
    if (relevantComms.length > 0 && Math.random() > 0.4) { // 60% szansy na wykorzystanie komunikacji
      const comm = relevantComms[Math.floor(Math.random() * relevantComms.length)];
      const commContent = comm.content.toLowerCase();
      
      // Analizuj komunikację i generuj zadanie
      if (commContent.includes('bug') || commContent.includes('błąd') || commContent.includes('problem')) {
        return `Bug fixing and testing based on team feedback${projects.length > 0 ? ` for ${projects[Math.floor(Math.random() * projects.length)]}` : ''}`;
      } else if (commContent.includes('review') || commContent.includes('przegląd') || commContent.includes('feedback')) {
        return `Applied team feedback and code review suggestions${projects.length > 0 ? ` to ${projects[Math.floor(Math.random() * projects.length)]}` : ''}`;
      } else if (commContent.includes('meeting') || commContent.includes('spotkanie') || commContent.includes('call')) {
        return `Follow-up implementation from team meeting discussions`;
      } else if (commContent.includes('deploy') || commContent.includes('release') || commContent.includes('wdrożenie')) {
        return `Deployment preparation and release testing${projects.length > 0 ? ` for ${projects[Math.floor(Math.random() * projects.length)]}` : ''}`;
      } else if (commContent.includes('design') || commContent.includes('ui') || commContent.includes('ux')) {
        return `UI/UX implementation based on design team discussion${projects.length > 0 ? ` for ${projects[Math.floor(Math.random() * projects.length)]}` : ''}`;
      } else if (commContent.includes('performance') || commContent.includes('optim') || commContent.includes('speed')) {
        return `Performance optimization and testing based on team analysis`;
      } else {
        // Ogólne zadanie oparte na komunikacji
        return `Team coordination and implementation work${projects.length > 0 ? ` related to ${projects[Math.floor(Math.random() * projects.length)]}` : ''}`;
      }
    }
    
    // Fallback do standardowych szablonów
    const categories = Object.keys(taskTemplates);
    const category = categories[Math.floor(Math.random() * categories.length)];
    const templates = taskTemplates[category];
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    let task = template;
    if (projects.length > 0) {
      const project = projects[Math.floor(Math.random() * projects.length)];
      task = task.replace(/{page}/g, project + ' page');
      task = task.replace(/{feature}/g, project);
      task = task.replace(/{component}/g, project + ' component');
      task = task.replace(/{service}/g, project);
    } else {
      task = task.replace(/{[^}]+}/g, 'website');
    }
    
    return task;
  };

  const generateWorkingDays = (startDate, endDate, excludedDays) => {
    const days = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateString = current.toISOString().split('T')[0];
      
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const isExcluded = excludedDays.some(excluded => excluded.date === dateString);
        if (!isExcluded) {
          days.push(dateString);
        }
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const generateTimeLogs = () => {
    if (!config.startDate || !config.endDate) {
      alert('Proszę wprowadzić daty rozpoczęcia i zakończenia');
      return;
    }

    const workingDays = generateWorkingDays(config.startDate, config.endDate, config.excludedDays);
    let logs = [];
    
    if (config.useWordPressData && wpData.lastFetch) {
      const wpChanges = analyzeWordPressChanges(config.startDate, config.endDate);
      const wpBasedTasks = generateWordPressBasedTasks(wpChanges, config.currentProjects);
      logs = [...wpBasedTasks];
    }
    
    workingDays.forEach(day => {
      const existingTasksForDay = logs.filter(log => log.day === day);
      const existingHours = existingTasksForDay.reduce((sum, log) => sum + parseFloat(log.time), 0);
      
      // Sprawdź czy ten dzień ma specjalne ustawienia godzinowe
      const dayException = config.excludedDays.find(exc => exc.date === day);
      const targetHours = dayException?.targetHours ?? config.targetHoursPerDay;
      
      let remainingHours = targetHours - existingHours;
      
      if (remainingHours > 0) {
        // Generuj zadania aby osiągnąć docelową liczbę godzin
        const minTasks = Math.max(1, Math.floor(remainingHours / 2.5)); // min tasks
        const maxTasks = Math.max(2, Math.ceil(remainingHours / 0.5)); // max tasks
        const tasksToGenerate = Math.min(6, Math.floor(Math.random() * (maxTasks - minTasks + 1)) + minTasks);
        
        for (let i = 0; i < tasksToGenerate && remainingHours > 0.1; i++) {
          const tasksLeft = tasksToGenerate - i;
          const taskTime = generateTargetedTime(remainingHours, tasksLeft);
          const finalTime = Math.min(taskTime, remainingHours);
          
          logs.push({
            day: day,
            time: finalTime,
            task: getRandomTask(config.currentProjects, config.teamCommunications, day),
            comments: ''
          });
          
          remainingHours -= finalTime;
        }
      }
    });
    
    logs.sort((a, b) => new Date(a.day) - new Date(b.day));
    setGeneratedLogs(logs);
  };

  const exportToCSV = () => {
    const header = 'Day,Time,Task,Comments\n';
    const rows = generatedLogs.map(log => 
      `${log.day},${formatTime(log.time)},"${log.task}","${log.comments}"`
    ).join('\n');
    
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time_log_${config.startDate}_${config.endDate}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Generator Retrospektywnych Time Logów</h1>
        <p className="text-gray-600 text-lg">Wszystko co potrzebujesz do stworzenia realistycznych time logów</p>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* LEWA KOLUMNA */}
        <div className="space-y-6">
          
          {/* WordPress Retrospective Analyzer */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Code className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-purple-900">WordPress Retrospective Analyzer</h2>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={copyCodeToClipboard}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    codeCopied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {codeCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {codeCopied ? 'Skopiowano!' : 'Kopiuj'}
                </button>
                <button
                  onClick={downloadCode}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-purple-800 mb-4">
              Zainstaluj Retrospective Analyzer w WordPressie aby otrzymać time logi oparte na HISTORYCZNEJ aktywności. 
              System analizuje przeszłe zmiany stron, rewizje i upload'y mediów.
            </p>
            
            <div className="bg-white p-4 rounded-md border">
              <h4 className="font-semibold text-gray-900 mb-2">📋 Instalacja:</h4>
              <ol className="text-sm text-gray-700 space-y-1">
                <li><strong>1.</strong> Skopiuj kod powyżej</li>
                <li><strong>2.</strong> Wklej na końcu functions.php w WordPress</li>
                <li><strong>3.</strong> Sprawdź dashboard - pojawi się API key</li>
                <li><strong>4.</strong> Wprowadź URL i key poniżej</li>
                <li><strong>5.</strong> Analizuj dowolny okres z przeszłości!</li>
              </ol>
            </div>
            
            <button
              onClick={() => setShowCode(!showCode)}
              className="w-full mt-3 bg-purple-100 text-purple-800 py-2 px-4 rounded-md hover:bg-purple-200"
            >
              {showCode ? '🔼 Ukryj kod' : '🔽 Pokaż kod'}
            </button>
            
            {showCode && (
              <div className="mt-4 bg-gray-900 text-green-400 p-4 rounded-md max-h-40 overflow-y-auto">
                <pre className="text-xs">{retroAnalyzerCode.substring(0, 600)}...</pre>
              </div>
            )}
          </div>

          {/* WordPress JSON Import */}
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-blue-900">WordPress JSON Import</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-2">📋 Instrukcja:</h4>
                <ol className="text-sm text-gray-700 space-y-1">
                  <li><strong>1.</strong> Zainstaluj Enhanced Analyzer w WordPress</li>
                  <li><strong>2.</strong> Otwórz link "Analyzer" z dashboard</li>
                  <li><strong>3.</strong> Ustaw daty i kliknij "Analizuj"</li>
                  <li><strong>4.</strong> Skopiuj JSON i wklej poniżej</li>
                </ol>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">WordPress JSON Data:</label>
                <textarea 
                  placeholder='Wklej JSON z WordPress Analyzer...'
                  className="w-full h-32 p-3 border rounded-md text-sm font-mono"
                  value={config.wordpressJson || ''}
                  onChange={(e) => setConfig(prev => ({...prev, wordpressJson: e.target.value}))}
                />
              </div>
              
              <button 
                onClick={() => processWordPressJSON(config.wordpressJson)}
                disabled={!config.wordpressJson?.trim() || wpData.jsonProcessing}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
              >
                {wpData.jsonProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Przetwarzam dane...
                  </>
                ) : (
                  '📊 Przetwórz WordPress Data'
                )}
              </button>
              
              {wpData.error && (
                <div className="bg-red-100 border border-red-300 p-4 rounded-md">
                  <p className="text-red-800 text-sm font-medium">❌ {wpData.error}</p>
                </div>
              )}
              {config.wordpressJson && wpData.lastFetch && (
                <div className="bg-green-100 border border-green-300 p-4 rounded-md">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ WordPress Data załadowana z JSON!
                  </p>
                  <div className="text-green-700 text-xs mt-2">
                    📊 <strong>Aktywności:</strong> {wpData.activityData.length} zadań historycznych
                  </div>
                  <div className="mt-3">
                    <label className="flex items-center">
                      <input 
                        type="checkbox"
                        checked={config.useWordPressData}
                        onChange={(e) => setConfig(prev => ({...prev, useWordPressData: e.target.checked}))}
                        className="mr-2"
                      />
                      <span className="text-green-800 text-sm font-medium">
                        Używaj danych WordPress
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WordPress Integration - Legacy */}
          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg opacity-75">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-6 h-6 text-gray-500" />
              <h2 className="text-xl font-bold text-gray-700">WordPress Integration (Legacy)</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">URL WordPress:</label>
                <input 
                  type="text"
                  placeholder="https://twoja-strona.pl"
                  className="w-full p-3 border rounded-md text-sm"
                  value={config.wordpressUrl}
                  onChange={(e) => setConfig(prev => ({...prev, wordpressUrl: e.target.value}))}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">API Key (opcjonalny):</label>
                <input 
                  type="text"
                  placeholder="wp_retro_xxx... (z dashboardu WordPress)"
                  className="w-full p-3 border rounded-md text-sm"
                  value={config.apiKey || ''}
                  onChange={(e) => setConfig(prev => ({...prev, apiKey: e.target.value}))}
                />
              </div>
              
              <button 
                onClick={() => fetchWordPressData(config.wordpressUrl, config.apiKey)}
                disabled={!config.wordpressUrl || wpData.loading}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
              >
                {wpData.loading ? 'Łączę się...' : '🔍 Testuj Połączenie'}
              </button>
              
              {wpData.error && (
                <div className="bg-red-100 border border-red-300 p-4 rounded-md">
                  <p className="text-red-800 text-sm font-medium">❌ {wpData.error}</p>
                </div>
              )}
              
              {wpData.lastFetch && !wpData.error && (
                <div className="bg-green-100 border border-green-300 p-4 rounded-md">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ Połączenie udane! 
                    {wpData.isCustomAPI ? ' (Retrospective Analyzer 🔍)' : ' (standardowe API 📊)'}
                  </p>
                  <div className="text-green-700 text-xs mt-2">
                    {wpData.isCustomAPI ? (
                      <p><strong>🔍 Retrospective Analyzer:</strong> {wpData.activityData.length} historycznych aktywności</p>
                    ) : (
                      <p><strong>📊 Standardowe API:</strong> {wpData.posts.length + wpData.pages.length + wpData.media.length} elementów</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <label className="flex items-center">
                      <input 
                        type="checkbox"
                        checked={config.useWordPressData}
                        onChange={(e) => setConfig(prev => ({...prev, useWordPressData: e.target.checked}))}
                        className="mr-2"
                      />
                      <span className="text-green-800 text-sm font-medium">
                        Używaj danych WordPress
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Konfiguracja czasu pracy */}
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-green-900">Czas pracy</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Średnia godzin dziennie</label>
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
                  <label className="block text-sm font-medium mb-2">Format czasu</label>
                  <select 
                    className="w-full p-3 border rounded-md"
                    value={config.timeFormat}
                    onChange={(e) => setConfig(prev => ({...prev, timeFormat: e.target.value}))}
                  >
                    <option value="minutes">Godziny i minuty (2h 30m)</option>
                    <option value="decimal">Setne części (2.50h)</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-2">ℹ️ Informacje:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Generator będzie celował w <strong>{config.targetHoursPerDay}h dziennie</strong></li>
                  <li>• Czas będzie wyświetlany w formacie: <strong>{formatTime(2.5)}</strong></li>
                  <li>• Możesz ustawić inne godziny dla konkretnych dni poniżej</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Podstawowa konfiguracja */}
          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">Konfiguracja</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Data od</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border rounded-md"
                    value={config.startDate}
                    onChange={(e) => setConfig(prev => ({...prev, startDate: e.target.value}))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Data do</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border rounded-md"
                    value={config.endDate}
                    onChange={(e) => setConfig(prev => ({...prev, endDate: e.target.value}))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dni wyjątkowe */}
          <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-orange-900">Dni wyjątkowe</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="date" 
                  className="p-2 border rounded-md"
                  value={excludeDayInput}
                  onChange={(e) => setExcludeDayInput(e.target.value)}
                />
                <input 
                  type="text" 
                  className="p-2 border rounded-md"
                  placeholder="Powód (urlop, święto)"
                  value={excludeReasonInput}
                  onChange={(e) => setExcludeReasonInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addExcludedDay()}
                />
                <button 
                  onClick={addExcludedDay}
                  className="bg-orange-100 text-orange-800 px-3 py-2 rounded-md hover:bg-orange-200"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Dodaj
                </button>
              </div>
              
              {config.excludedDays.length > 0 && (
                <div className="space-y-2">
                  {config.excludedDays.map((day, index) => (
                    <div key={index} className="bg-orange-100 p-3 rounded border-l-4 border-orange-400">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-orange-900">{day.date} - {day.reason}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-sm text-orange-800">Godziny tego dnia:</label>
                            <input 
                              type="number"
                              min="0"
                              max="12"
                              step="0.5"
                              placeholder={`Domyślnie ${config.targetHoursPerDay}h`}
                              className="w-20 p-1 border rounded text-sm"
                              value={day.targetHours || ''}
                              onChange={(e) => updateDayTargetHours(index, e.target.value)}
                            />
                            <span className="text-sm text-orange-700">
                              (puste = {config.targetHoursPerDay}h)
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setConfig(prev => ({
                            ...prev, 
                            excludedDays: prev.excludedDays.filter((_, i) => i !== index)
                          }))}
                          className="text-red-600 hover:text-red-800 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Komunikacja zespołowa */}
          <div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-purple-900">Komunikacja zespołowa</h2>
            </div>
            
            <div className="space-y-6">
              
              {/* Screenshot Upload & Analysis */}
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-3">📸 Analiza screenshotów</h4>
                
                {/* Wybór trybu analizy */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tryb analizy:</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="analysisMode" 
                        value="smart" 
                        checked={analysisMode === 'smart'}
                        onChange={(e) => setAnalysisMode(e.target.value)}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium text-sm">🤖 Smart Auto</div>
                        <div className="text-xs text-gray-600">Analiza nazw plików i metadanych</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="analysisMode" 
                        value="manual" 
                        checked={analysisMode === 'manual'}
                        onChange={(e) => setAnalysisMode(e.target.value)}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium text-sm">🤝 Z Tobą</div>
                        <div className="text-xs text-gray-600">Ty opisujesz co widać</div>
                      </div>
                    </label>
                    
                    <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                      <input 
                        type="radio" 
                        name="analysisMode" 
                        value="ocr" 
                        checked={analysisMode === 'ocr'}
                        onChange={(e) => setAnalysisMode(e.target.value)}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium text-sm">🔍 Prawdziwy OCR</div>
                        <div className="text-xs text-gray-600">Instrukcje zewnętrznych narzędzi</div>
                      </div>
                    </label>
                  </div>
                </div>
                
                {analysisMode === 'smart' && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-md">
                    <p className="text-blue-800 text-sm">
                      <strong>🤖 Smart Auto:</strong> System analizuje nazwy plików, daty, rozmiary i kontekst projektów. 
                      Działa najlepiej gdy screenshoty mają opisowe nazwy (np. "teams_meeting_bugs.png").
                    </p>
                  </div>
                )}
                
                {analysisMode === 'manual' && (
                  <div className="mb-3 p-3 bg-green-50 rounded-md">
                    <p className="text-green-800 text-sm">
                      <strong>🤝 Tryb z Tobą:</strong> System pokaże Ci screenshot i poprosi o opisanie co widać. 
                      100% accuracy ale wymaga Twojego czasu.
                    </p>
                  </div>
                )}
                
                {analysisMode === 'ocr' && (
                  <div className="mb-3 p-3 bg-purple-50 rounded-md">
                    <div className="text-purple-800 text-sm space-y-2">
                      <p><strong>🔍 Prawdziwy OCR:</strong> Użyj zewnętrznych narzędzi do faktycznego czytania tekstu:</p>
                      <ul className="text-xs space-y-1 ml-4">
                        <li>• <strong>Online:</strong> ocr.space, OnlineOCR.net, Google Photos (mobile)</li>
                        <li>• <strong>AI Tools:</strong> ChatGPT Vision, Claude (upload image), Google Bard</li>
                        <li>• <strong>Desktop:</strong> OneNote (wklej → prawy klk → copy text), Windows Snipping Tool</li>
                        <li>• <strong>Mobile:</strong> Google Lens, Microsoft Office Lens</li>
                      </ul>
                      <p className="text-xs"><strong>Workflow:</strong> Screenshot → OCR tool → skopiuj tekst → wklej w "Ręczne dodawanie" ↓</p>
                    </div>
                  </div>
                )}
                
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
                    <div className="text-purple-600 mb-2">
                      <FileText className="w-8 h-8 mx-auto" />
                    </div>
                    <p className="text-purple-800 font-medium">Kliknij lub przeciągnij screenshoty</p>
                    <p className="text-purple-600 text-sm mt-1">Teams, Slack, Calendar, Email screenshots</p>
                    <p className="text-purple-500 text-xs mt-2">💡 System pokaże Ci obrazek i poprosi o opis</p>
                  </label>
                </div>
                
                {screenshotAnalyzing && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-md">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-3"></div>
                      <span className="text-blue-800 font-medium">Przygotowuję screenshot do analizy...</span>
                    </div>
                  </div>
                )}
                
                {uploadedScreenshots.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-900 mb-2">📋 Uploadowane screenshoty:</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {uploadedScreenshots.map((screenshot) => (
                        <div key={screenshot.id} className="relative">
                          <img 
                            src={screenshot.preview} 
                            alt={screenshot.name}
                            className="w-full h-20 object-cover rounded border"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 rounded-b truncate">
                            {screenshot.name}
                          </div>
                          <button
                            onClick={() => {
                              setUploadedScreenshots(prev => prev.filter(s => s.id !== screenshot.id));
                              URL.revokeObjectURL(screenshot.preview);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Communication Input */}
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-2">💬 Ręczne dodawanie</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Wklej tekst komunikacji lub opisz kontekst pracy zespołowej.
                </p>
                
                <div className="grid grid-cols-4 gap-2">
                  <input 
                    type="date" 
                    className="p-2 border rounded-md text-sm"
                    placeholder="Data (opcjonalna)"
                    value={communicationDateInput}
                    onChange={(e) => setCommunicationDateInput(e.target.value)}
                  />
                  <textarea 
                    className="col-span-3 p-2 border rounded-md text-sm resize-none"
                    rows="2"
                    placeholder="Wklej komunikację z Teams/Slack lub opisz kontekst..."
                    value={communicationInput}
                    onChange={(e) => setCommunicationInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addTeamCommunication())}
                  />
                </div>
                
                <button 
                  onClick={addTeamCommunication}
                  className="w-full mt-2 bg-purple-100 text-purple-800 px-3 py-2 rounded-md hover:bg-purple-200"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Dodaj komunikację
                </button>
              </div>
              
              {/* Communications List */}
              {config.teamCommunications.length > 0 && (
                <div className="bg-white p-4 rounded-md border">
                  <h4 className="font-semibold text-gray-900 mb-3">📝 Zebrane komunikacje ({config.teamCommunications.length})</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {config.teamCommunications.map((comm) => (
                      <div key={comm.id} className="flex justify-between items-start bg-purple-50 p-3 rounded border-l-4 border-purple-400">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-purple-700 font-medium">{comm.date}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">
                              {comm.source === 'screenshot' ? '📸 Screenshot' : '💬 Manual'}
                            </span>
                            {comm.confidence && comm.source !== 'screenshot' && (
                              <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700">
                                {comm.confidence}% pewności
                              </span>
                            )}
                            {comm.source === 'screenshot' && (
                              <span className="text-xs px-1 py-0.5 rounded bg-green-100 text-green-700">
                                ✋ User verified
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-purple-900">{comm.content}</div>
                          {comm.fileName && (
                            <div className="text-xs text-purple-600 mt-1">📄 {comm.fileName}</div>
                          )}
                        </div>
                        <button 
                          onClick={() => setConfig(prev => ({
                            ...prev, 
                            teamCommunications: prev.teamCommunications.filter(c => c.id !== comm.id)
                          }))}
                          className="text-red-600 hover:text-red-800 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Projekty */}
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Plus className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-green-900">Projekty</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 p-3 border rounded-md"
                  placeholder="homepage, technology page, dashboard"
                  value={projectInput}
                  onChange={(e) => setProjectInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCurrentProject()}
                />
                <button 
                  onClick={addCurrentProject}
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
        </div>

        {/* PRAWA KOLUMNA */}
        <div className="space-y-6">
          
          {/* Generowanie */}
          <div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-bold text-purple-900">Generowanie</h2>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-md border">
                <h4 className="font-semibold text-gray-900 mb-2">📊 Podsumowanie:</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>Okres:</strong> {config.startDate && config.endDate ? `${config.startDate} do ${config.endDate}` : 'Nie ustawiono'}</p>
                  <p><strong>Wyjątki:</strong> {config.excludedDays.length} dni</p>
                  <p><strong>WordPress:</strong> {
                    config.useWordPressData ? (
                      wpData.isCustomAPI ? (
                        wpData.activityData.length > 0 ? (
                          <span className="text-green-600 font-medium">JSON Data ({wpData.activityData.length} aktywności)</span>
                        ) : (
                          <span className="text-green-600 font-medium">Retrospective Analyzer ({wpData.activityData.length})</span>
                        )
                      ) : (
                        <span className="text-blue-600">Standardowe API ({wpData.posts.length + wpData.pages.length + wpData.media.length})</span>
                      )
                    ) : (
                      <span className="text-gray-500">Wyłączone</span>
                    )
                  }</p>
                  <p><strong>Projekty:</strong> {config.currentProjects.length || 'Brak'}</p>
                  <p><strong>Komunikacja:</strong> {config.teamCommunications.length} wpisów
                    {uploadedScreenshots.length > 0 && ` (${uploadedScreenshots.length} screenshotów)`}
                  </p>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                <h4 className="font-medium text-yellow-900 mb-2">🎯 Jakość:</h4>
                <div className="text-yellow-800 text-sm">
                  {config.useWordPressData ? (
                    wpData.isCustomAPI ? (
                      wpData.activityData.length > 0 && config.wordpressJson ? (
                        <p><strong>🏆 Najwyższa:</strong> WordPress JSON Data (pełna analiza historii)</p>
                      ) : (
                        <p><strong>🏆 Najwyższa:</strong> Historyczna analiza z Retrospective Analyzer</p>
                      )
                    ) : (
                      <p><strong>📊 Dobra:</strong> WordPress API + inteligentne uzupełnienie</p>
                    )
                  ) : (
                    <p><strong>⚡ Standardowa:</strong> Szablony dopasowane do projektów</p>
                  )}
                  {config.wordpressJson && wpData.activityData.length > 0 && (
                    <p className="mt-1 text-xs text-yellow-700">📋 Dane załadowane z WordPress JSON Analyzer</p>
                  )}
                  {config.teamCommunications.length > 0 && (
                    <p className="mt-1 text-xs text-yellow-700">
                      💬 Kontekst z {config.teamCommunications.length} komunikacji zespołowych
                      {uploadedScreenshots.length > 0 && ` (w tym ${uploadedScreenshots.length} przeanalizowanych screenshotów)`}
                    </p>
                  )}
                </div>
              </div>
              
              <button 
                onClick={generateTimeLogs}
                disabled={!config.startDate || !config.endDate}
                className="w-full bg-purple-600 text-white px-6 py-4 rounded-md text-lg font-medium hover:bg-purple-700 disabled:bg-gray-400"
              >
                🚀 Generuj Time Logi
              </button>
            </div>
          </div>

          {/* Wyniki */}
          {generatedLogs.length > 0 && (
            <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Download className="w-6 h-6 text-green-600" />
                  <h2 className="text-xl font-bold text-green-900">Wyniki</h2>
                </div>
                <button 
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </button>
              </div>
              
              <div className="bg-white p-4 rounded-md border mb-4">
                <p className="text-green-800 font-medium">
                  ✅ <strong>{generatedLogs.length} zadań</strong> dla {new Set(generatedLogs.map(log => log.day)).size} dni
                </p>
                <p className="text-green-700 text-sm mt-1">
                  📊 Łączny czas: <strong>{formatTime(generatedLogs.reduce((sum, log) => sum + parseFloat(log.time), 0))}</strong>
                  {generatedLogs.length > 0 && (
                    <span> | Średnio: <strong>{formatTime(generatedLogs.reduce((sum, log) => sum + parseFloat(log.time), 0) / new Set(generatedLogs.map(log => log.day)).size)} dziennie</strong></span>
                  )}
                </p>
                {config.useWordPressData && wpData.lastFetch && (
                  <div className="mt-2 text-green-700 text-sm">
                    {wpData.isCustomAPI ? (
                      wpData.activityData.length > 0 && config.wordpressJson ? (
                        <p>📊 <strong>WordPress JSON Data:</strong> {wpData.activityData.length} aktywności z analizy</p>
                      ) : (
                        <p>🔍 <strong>Retrospective Analyzer:</strong> {wpData.activityData.length} aktywności przeanalizowano</p>
                      )
                    ) : (
                      <p>📊 <strong>WordPress API:</strong> {wpData.posts.length + wpData.pages.length + wpData.media.length} elementów</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="max-h-96 overflow-y-auto border rounded-md bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-3 border-r">Data</th>
                      <th className="text-left p-3 border-r">Czas</th>
                      <th className="text-left p-3">Zadanie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedLogs.map((log, index) => (
                      <tr key={index} className="border-t hover:bg-gray-50">
                        <td className="p-3 border-r font-mono text-xs">{log.day}</td>
                        <td className="p-3 border-r font-mono text-sm">{formatTime(log.time)}</td>
                        <td className="p-3 text-sm">{log.task}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex space-x-3">
                <button 
                  onClick={() => {
                    setGeneratedLogs([]);
                    setWpData(prev => ({...prev, lastFetch: null, error: null, activityData: [], jsonProcessing: false}));
                    setConfig(prev => ({
                      ...prev, 
                      wordpressJson: '', 
                      useWordPressData: false, 
                      excludedDays: [], 
                      currentProjects: [], 
                      teamCommunications: [],
                      targetHoursPerDay: 8,
                      timeFormat: 'minutes'
                    }));
                    setExcludeDayInput('');
                    setExcludeReasonInput('');
                    setProjectInput('');
                    setCommunicationInput('');
                    setCommunicationDateInput('');
                    // Cleanup screenshot previews
                    uploadedScreenshots.forEach(screenshot => URL.revokeObjectURL(screenshot.preview));
                    setUploadedScreenshots([]);
                    setScreenshotAnalyzing(false);
                    setPendingScreenshotAnalysis(null);
                    setShowAnalysisPreview(false);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                >
                  🔄 Wyczyść
                </button>
                <button 
                  onClick={generateTimeLogs}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700"
                >
                  🎲 Regeneruj
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal do analizy screenshotów z pomocą użytkownika */}
      {showAnalysisPreview && pendingScreenshotAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {pendingScreenshotAnalysis.needsUserInput ? '🤝 Pomóż przeanalizować screenshot' : '🔍 Potwierdzenie analizy screenshota'}
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Podgląd screenshota */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">📸 Screenshot:</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={uploadedScreenshots.find(s => s.file.name === pendingScreenshotAnalysis.fileName)?.preview}
                      alt={pendingScreenshotAnalysis.fileName}
                      className="w-full max-h-96 object-contain"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">📄 {pendingScreenshotAnalysis.fileName}</p>
                </div>
                
                {/* Formularz analizy */}
                <div className="space-y-4">
                  {pendingScreenshotAnalysis.needsUserInput && (
                    <div className="bg-blue-50 p-4 rounded-md">
                      <h4 className="font-semibold text-blue-900 mb-2">💡 Jak to działa:</h4>
                      <ul className="text-blue-800 text-sm space-y-1">
                        <li>• Spojrz na screenshot po lewej</li>
                        <li>• Opisz co widać - rozmowę, meeting, email, etc.</li>
                        <li>• Ustaw datę kiedy to się działo</li>
                        <li>• System użyje tego do generowania zadań!</li>
                      </ul>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📅 Data komunikacji:</label>
                    <input 
                      type="date"
                      className="w-full p-3 border rounded-md"
                      defaultValue={pendingScreenshotAnalysis.extractedDate}
                      id="analysis-date"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💬 Opisz co widać na screenshocie:
                    </label>
                    {pendingScreenshotAnalysis.needsUserInput && (
                      <div className="mb-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                        <strong>Przykłady dobrych opisów:</strong><br/>
                        • "Teams meeting o bugach w checkout, ustaliliśmy plan poprawek"<br/>
                        • "Slack dyskusja o deploy na staging w czwartek"<br/>
                        • "Email od klienta z feedback o homepage design"<br/>
                        • "Kalendarz pokazuje deadline projektu na 15.08"
                      </div>
                    )}
                    <textarea 
                      className="w-full p-3 border rounded-md"
                      rows="5"
                      defaultValue={pendingScreenshotAnalysis.analyzedContent}
                      id="analysis-content"
                      placeholder={pendingScreenshotAnalysis.needsUserInput 
                        ? "Co widzisz na screenshocie? Opisz komunikację, temat, ustalenia..." 
                        : "Edytuj wykrytą treść komunikacji..."
                      }
                    />
                  </div>
                  
                  {!pendingScreenshotAnalysis.needsUserInput && (
                    <div className="bg-green-50 p-3 rounded-md">
                      <p className="text-green-800 text-sm">
                        ✨ <strong>Automatycznie wykryte</strong> (pewność: {pendingScreenshotAnalysis.confidence}%)
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    const content = document.getElementById('analysis-content').value;
                    const date = document.getElementById('analysis-date').value;
                    if (!content.trim()) {
                      alert('Proszę opisać co widać na screenshocie');
                      return;
                    }
                    confirmScreenshotAnalysis(content, date);
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 font-medium"
                >
                  ✅ Dodaj komunikację
                </button>
                <button
                  onClick={rejectScreenshotAnalysis}
                  className="flex-1 bg-gray-500 text-white px-4 py-3 rounded-md hover:bg-gray-600 font-medium"
                >
                  ❌ Pomiń screenshot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeLogGenerator;