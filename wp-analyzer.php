<?php
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

// API Key generation
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
});