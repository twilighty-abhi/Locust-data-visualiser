let chartInstances = {};
let reportData = null;

// Manual data extraction for cases where templateArgs pattern doesn't match
function extractDataManually(htmlContent) {
    console.log('Performing manual extraction...');
    
    const data = {};
    
    // Extract requests_statistics
    const requestsMatch = htmlContent.match(/"requests_statistics":\s*(\[[\s\S]*?\])/);
    if (requestsMatch) {
        try {
            data.requests_statistics = JSON.parse(requestsMatch[1]);
            console.log('Found requests_statistics:', data.requests_statistics.length, 'items');
        } catch (e) {
            console.error('Failed to parse requests_statistics:', e);
        }
    }
    
    // Extract failures_statistics
    const failuresMatch = htmlContent.match(/"failures_statistics":\s*(\[[\s\S]*?\])/);
    if (failuresMatch) {
        try {
            data.failures_statistics = JSON.parse(failuresMatch[1]);
            console.log('Found failures_statistics:', data.failures_statistics.length, 'items');
        } catch (e) {
            console.error('Failed to parse failures_statistics:', e);
        }
    }
    
    // Extract response_time_statistics
    const responseTimeMatch = htmlContent.match(/"response_time_statistics":\s*(\[[\s\S]*?\])/);
    if (responseTimeMatch) {
        try {
            data.response_time_statistics = JSON.parse(responseTimeMatch[1]);
            console.log('Found response_time_statistics:', data.response_time_statistics.length, 'items');
        } catch (e) {
            console.error('Failed to parse response_time_statistics:', e);
        }
    }
    
    // Extract duration
    const durationMatch = htmlContent.match(/"duration":\s*"([^"]*)"/);
    if (durationMatch) {
        data.duration = durationMatch[1];
        console.log('Found duration:', data.duration);
    }
    
    // Extract exceptions_statistics
    const exceptionsMatch = htmlContent.match(/"exceptions_statistics":\s*(\[[\s\S]*?\])/);
    if (exceptionsMatch) {
        try {
            data.exceptions_statistics = JSON.parse(exceptionsMatch[1]);
            console.log('Found exceptions_statistics:', data.exceptions_statistics.length, 'items');
        } catch (e) {
            console.error('Failed to parse exceptions_statistics:', e);
        }
    }
    
    // Check if we have enough data
    if (data.requests_statistics && data.requests_statistics.length > 0) {
        console.log('Manual extraction successful!');
        return data;
    }
    
    console.log('Manual extraction failed - not enough data found');
    return null;
}

// File upload handler
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            extractDataFromReport(e.target.result);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing the file. Please ensure it\'s a valid Locust HTML report.');
        }
    };
    reader.readAsText(file);
}

// Extract data from Locust HTML report
function extractDataFromReport(htmlContent) {
    console.log('File size:', htmlContent.length);
    
    // Try multiple patterns to find templateArgs
    let templateArgsMatch = null;
    let jsonStr = null;
    
    // Pattern 1: Standard format
    templateArgsMatch = htmlContent.match(/window\.templateArgs\s*=\s*({[\s\S]*?});/);
    
    // Pattern 2: Without semicolon
    if (!templateArgsMatch) {
        templateArgsMatch = htmlContent.match(/window\.templateArgs\s*=\s*({[\s\S]*?})\s*(?:window\.|<\/script>|$)/);
    }
    
    // Pattern 3: Look for templateArgs anywhere
    if (!templateArgsMatch) {
        templateArgsMatch = htmlContent.match(/templateArgs\s*[=:]\s*({[\s\S]*?})(?:\s*[;,]|\s*$)/);
    }
    
    // Pattern 4: Search for the specific data structure we need
    if (!templateArgsMatch) {
        const requestsMatch = htmlContent.match(/"requests_statistics":\s*\[[\s\S]*?\]/);
        const durationMatch = htmlContent.match(/"duration":\s*"[^"]*"/);
        if (requestsMatch && durationMatch) {
            // Try to extract a larger JSON block containing these
            const startIdx = Math.min(
                htmlContent.indexOf('"requests_statistics"'),
                htmlContent.indexOf('"duration"')
            ) - 200;
            const endIdx = Math.max(
                htmlContent.lastIndexOf(']'),
                htmlContent.lastIndexOf('}')
            ) + 10;
            
            const potentialJson = htmlContent.substring(Math.max(0, startIdx), Math.min(htmlContent.length, endIdx));
            const jsonMatch = potentialJson.match(/(\{[^{}]*"requests_statistics"[\s\S]*\})/);
            if (jsonMatch) {
                templateArgsMatch = [null, jsonMatch[1]];
            }
        }
    }
    
    // Pattern 5: Manual construction from found data
    if (!templateArgsMatch) {
        console.log('Attempting manual data extraction...');
        try {
            const manualData = extractDataManually(htmlContent);
            if (manualData) {
                reportData = manualData;
                setTimeout(() => {
                    processReportData();
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('content').style.display = 'block';
                }, 1000);
                return;
            }
        } catch (e) {
            console.error('Manual extraction failed:', e);
        }
    }
    
    if (!templateArgsMatch) {
        console.error('Could not find templateArgs. File preview:', htmlContent.substring(0, 1000));
        console.error('Searching for requests_statistics:', htmlContent.includes('requests_statistics'));
        console.error('Searching for window.templateArgs:', htmlContent.includes('window.templateArgs'));
        throw new Error('Could not find templateArgs in the HTML file. Please ensure this is a valid Locust HTML report.');
    }
    
    try {
        jsonStr = templateArgsMatch[1];
        
        // Clean up the JSON string
        jsonStr = jsonStr.replace(/\s+/g, ' ').trim();
        
        // Handle potential issues with the JSON
        if (!jsonStr.startsWith('{')) {
            const braceIndex = jsonStr.indexOf('{');
            if (braceIndex !== -1) {
                jsonStr = jsonStr.substring(braceIndex);
            }
        }
        
        if (!jsonStr.endsWith('}')) {
            const lastBraceIndex = jsonStr.lastIndexOf('}');
            if (lastBraceIndex !== -1) {
                jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
            }
        }
        
        console.log('Attempting to parse JSON...');
        reportData = JSON.parse(jsonStr);
        
        console.log('Successfully extracted data:', reportData);
        
        setTimeout(() => {
            processReportData();
            document.getElementById('loading').style.display = 'none';
            document.getElementById('content').style.display = 'block';
        }, 1000);
        
    } catch (error) {
        console.error('Error parsing JSON:', error);
        console.error('JSON string preview:', jsonStr ? jsonStr.substring(0, 500) : 'null');
        throw new Error('Could not parse the report data. The file may be corrupted or in an unsupported format.');
    }
}

// Process the extracted report data
function processReportData() {
    if (!reportData) return;
    
    createStatsOverview();
    createRequestsChart();
    createResponseTimeChart();
    createModulePerformanceChart();
    createPercentileChart();
    createThroughputChart();
    createErrorChart();
    createStatsTable();
    createErrorTable();
}

// Create overview statistics cards
function createStatsOverview() {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';
    
    const stats = reportData.requests_statistics || [];
    
    let totalRequests = 0;
    let totalFailures = 0;
    let avgResponseTime = 0;
    let maxRps = 0;
    
    stats.forEach(stat => {
        if (stat.name !== 'Aggregated') {
            totalRequests += stat.num_requests || 0;
            totalFailures += stat.num_failures || 0;
            avgResponseTime += (stat.avg_response_time || 0) * (stat.num_requests || 0);
            maxRps = Math.max(maxRps, stat.current_rps || 0);
        }
    });
    
    if (totalRequests > 0) {
        avgResponseTime = avgResponseTime / totalRequests;
    }
    
    const failureRate = totalRequests > 0 ? (totalFailures / totalRequests * 100) : 0;
    
    const statCards = [
        { label: 'Total Requests', value: totalRequests.toLocaleString(), icon: '📊' },
        { label: 'Total Failures', value: totalFailures.toLocaleString(), icon: '❌' },
        { label: 'Failure Rate', value: `${failureRate.toFixed(2)}%`, icon: '📉' },
        { label: 'Avg Response Time', value: `${avgResponseTime.toFixed(0)}ms`, icon: '⏱️' },
        { label: 'Test Duration', value: reportData.duration || 'N/A', icon: '⏰' },
        { label: 'Max RPS', value: maxRps.toFixed(2), icon: '🚀' }
    ];
    
    statCards.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 10px;">${stat.icon}</div>
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        statsGrid.appendChild(card);
    });
}

// Create requests overview chart
function createRequestsChart() {
    const ctx = document.getElementById('requestsChart').getContext('2d');
    
    if (chartInstances.requestsChart) {
        chartInstances.requestsChart.destroy();
    }
    
    const stats = reportData.requests_statistics || [];
    const labels = stats.filter(s => s.name !== 'Aggregated').map(s => s.name);
    const requests = stats.filter(s => s.name !== 'Aggregated').map(s => s.num_requests || 0);
    const failures = stats.filter(s => s.name !== 'Aggregated').map(s => s.num_failures || 0);
    
    chartInstances.requestsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Successful Requests',
                    data: requests.map((req, i) => req - failures[i]),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Failed Requests',
                    data: failures,
                    backgroundColor: 'rgba(231, 76, 60, 0.8)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Requests Overview - Success vs Failures'
                }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

// Create response time chart
function createResponseTimeChart() {
    const ctx = document.getElementById('responseTimeChart').getContext('2d');
    
    if (chartInstances.responseTimeChart) {
        chartInstances.responseTimeChart.destroy();
    }
    
    const stats = reportData.requests_statistics || [];
    const labels = stats.filter(s => s.name !== 'Aggregated').map(s => s.name);
    const avgTimes = stats.filter(s => s.name !== 'Aggregated').map(s => s.avg_response_time || 0);
    const minTimes = stats.filter(s => s.name !== 'Aggregated').map(s => s.min_response_time || 0);
    const maxTimes = stats.filter(s => s.name !== 'Aggregated').map(s => s.max_response_time || 0);
    
    chartInstances.responseTimeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Average Response Time',
                    data: avgTimes,
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Min Response Time',
                    data: minTimes,
                    borderColor: 'rgba(39, 174, 96, 1)',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Max Response Time',
                    data: maxTimes,
                    borderColor: 'rgba(231, 76, 60, 1)',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Response Time Analysis (ms)'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Response Time (ms)' }
                }
            }
        }
    });
}

// Create module performance chart
function createModulePerformanceChart() {
    const ctx = document.getElementById('modulePerformanceChart').getContext('2d');
    
    if (chartInstances.modulePerformanceChart) {
        chartInstances.modulePerformanceChart.destroy();
    }
    
    const stats = reportData.requests_statistics || [];
    const modulePerformance = {};
    
    // Group performance data by module
    stats.filter(s => s.name !== 'Aggregated').forEach(stat => {
        const moduleName = extractModuleName(stat.name);
        
        if (!modulePerformance[moduleName]) {
            modulePerformance[moduleName] = {
                totalRequests: 0,
                totalFailures: 0,
                avgResponseTime: 0,
                maxResponseTime: 0,
                totalRps: 0,
                endpointCount: 0
            };
        }
        
        const module = modulePerformance[moduleName];
        module.totalRequests += stat.num_requests || 0;
        module.totalFailures += stat.num_failures || 0;
        module.avgResponseTime += (stat.avg_response_time || 0) * (stat.num_requests || 0);
        module.maxResponseTime = Math.max(module.maxResponseTime, stat.max_response_time || 0);
        module.totalRps += stat.current_rps || 0;
        module.endpointCount++;
    });
    
    // Calculate weighted averages
    Object.keys(modulePerformance).forEach(module => {
        const data = modulePerformance[module];
        if (data.totalRequests > 0) {
            data.avgResponseTime = data.avgResponseTime / data.totalRequests;
        }
    });
    
    const modules = Object.keys(modulePerformance);
    const avgResponseTimes = modules.map(m => modulePerformance[m].avgResponseTime);
    const failureRates = modules.map(m => {
        const total = modulePerformance[m].totalRequests;
        const failures = modulePerformance[m].totalFailures;
        return total > 0 ? (failures / total * 100) : 0;
    });
    
    chartInstances.modulePerformanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: modules,
            datasets: [
                {
                    label: 'Avg Response Time (ms)',
                    data: avgResponseTimes,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: 'Failure Rate (%)',
                    data: failureRates,
                    backgroundColor: 'rgba(231, 76, 60, 0.8)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '📊 Module Performance Overview'
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const module = context.label;
                            const data = modulePerformance[module];
                            return [
                                `Total Requests: ${data.totalRequests.toLocaleString()}`,
                                `Total Failures: ${data.totalFailures.toLocaleString()}`,
                                `Max Response Time: ${data.maxResponseTime.toFixed(0)}ms`,
                                `Total RPS: ${data.totalRps.toFixed(2)}`,
                                `Endpoints: ${data.endpointCount}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Response Time (ms)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Failure Rate (%)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// Create percentile chart
function createPercentileChart() {
    const ctx = document.getElementById('percentileChart').getContext('2d');
    
    if (chartInstances.percentileChart) {
        chartInstances.percentileChart.destroy();
    }
    
    const responseTimeStats = reportData.response_time_statistics || [];
    
    if (responseTimeStats.length === 0) {
        ctx.canvas.parentElement.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No response time percentile data available</p>';
        return;
    }
    
    const labels = responseTimeStats.map(s => s.name);
    const percentiles = ['0.5', '0.95', '0.99'];
    const colors = ['rgba(102, 126, 234, 0.8)', 'rgba(243, 156, 18, 0.8)', 'rgba(231, 76, 60, 0.8)'];
    
    const datasets = percentiles.map((percentile, index) => ({
        label: `${(parseFloat(percentile) * 100)}th Percentile`,
        data: responseTimeStats.map(s => s[percentile] || 0),
        backgroundColor: colors[index],
        borderColor: colors[index].replace('0.8', '1'),
        borderWidth: 1
    }));
    
    chartInstances.percentileChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Response Time Percentiles (ms)' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Response Time (ms)' }
                }
            }
        }
    });
}

// Create throughput chart
function createThroughputChart() {
    const ctx = document.getElementById('throughputChart').getContext('2d');
    
    if (chartInstances.throughputChart) {
        chartInstances.throughputChart.destroy();
    }
    
    const stats = reportData.requests_statistics || [];
    const labels = stats.filter(s => s.name !== 'Aggregated').map(s => s.name);
    const rps = stats.filter(s => s.name !== 'Aggregated').map(s => s.current_rps || 0);
    
    chartInstances.throughputChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: rps,
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(118, 75, 162, 0.8)',
                    'rgba(39, 174, 96, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(231, 76, 60, 0.8)',
                    'rgba(155, 89, 182, 0.8)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Current Requests Per Second (RPS) Distribution' },
                legend: { position: 'bottom' }
            }
        }
    });
}

// Extract module name from request name
function extractModuleName(requestName) {
    if (!requestName) return 'Unknown';
    
    // Pattern: GET [module_name] text... or POST [module_name] text...
    const moduleMatch = requestName.match(/(?:GET|POST|PUT|DELETE|PATCH)\s*\[([^\]]+)\]/i);
    if (moduleMatch) {
        return moduleMatch[1].trim();
    }
    
    // Fallback: try to extract from path patterns like /api/module/...
    const pathMatch = requestName.match(/\/api\/([^\/\s]+)/i);
    if (pathMatch) {
        return pathMatch[1].trim();
    }
    
    // Another fallback: look for module-like patterns
    const wordMatch = requestName.match(/([a-zA-Z_]+)/);
    if (wordMatch) {
        return wordMatch[1].trim();
    }
    
    return 'Other';
}

// Group errors by module
function groupErrorsByModule(failures) {
    const moduleErrors = {};
    
    failures.forEach(failure => {
        const moduleName = extractModuleName(failure.name);
        
        if (!moduleErrors[moduleName]) {
            moduleErrors[moduleName] = {
                totalErrors: 0,
                errorTypes: {},
                details: []
            };
        }
        
        const occurrences = failure.occurrences || 1;
        moduleErrors[moduleName].totalErrors += occurrences;
        
        const errorType = failure.error || 'Unknown Error';
        moduleErrors[moduleName].errorTypes[errorType] = 
            (moduleErrors[moduleName].errorTypes[errorType] || 0) + occurrences;
        
        moduleErrors[moduleName].details.push({
            ...failure,
            occurrences: occurrences
        });
    });
    
    return moduleErrors;
}

// Create error chart
function createErrorChart() {
    const ctx = document.getElementById('errorChart').getContext('2d');
    
    if (chartInstances.errorChart) {
        chartInstances.errorChart.destroy();
    }
    
    const failures = reportData.failures_statistics || [];
    
    if (failures.length === 0) {
        ctx.canvas.parentElement.innerHTML = '<p style="text-align: center; padding: 40px; color: #27ae60;">🎉 No errors found! Excellent performance!</p>';
        return;
    }
    
    // Group errors by module
    const moduleErrors = groupErrorsByModule(failures);
    
    // Create module-based error chart
    const modules = Object.keys(moduleErrors);
    const errorCounts = modules.map(module => moduleErrors[module].totalErrors);
    
    chartInstances.errorChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: modules,
            datasets: [{
                data: errorCounts,
                backgroundColor: [
                    'rgba(231, 76, 60, 0.8)',
                    'rgba(243, 156, 18, 0.8)',
                    'rgba(230, 126, 34, 0.8)',
                    'rgba(192, 57, 43, 0.8)',
                    'rgba(211, 84, 0, 0.8)',
                    'rgba(155, 89, 182, 0.8)',
                    'rgba(52, 152, 219, 0.8)',
                    'rgba(46, 204, 113, 0.8)',
                    'rgba(241, 196, 15, 0.8)',
                    'rgba(231, 76, 60, 0.6)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Errors by Module' },
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const module = context.label;
                            const count = context.parsed;
                            const percentage = ((count / errorCounts.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                            return `${module}: ${count} errors (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Add detailed module breakdown
    createModuleErrorBreakdown(moduleErrors);
}

// Create statistics table
function createStatsTable() {
    const table = document.getElementById('statsTable').getElementsByTagName('tbody')[0];
    table.innerHTML = '';
    
    const stats = reportData.requests_statistics || [];
    
    stats.filter(s => s.name !== 'Aggregated').forEach(stat => {
        const row = table.insertRow();
        row.innerHTML = `
            <td>${stat.method || 'N/A'}</td>
            <td>${stat.name || 'N/A'}</td>
            <td>${(stat.num_requests || 0).toLocaleString()}</td>
            <td class="${(stat.num_failures || 0) > 0 ? 'error' : 'success'}">${(stat.num_failures || 0).toLocaleString()}</td>
            <td>${(stat.avg_response_time || 0).toFixed(2)}</td>
            <td>${(stat.min_response_time || 0).toFixed(2)}</td>
            <td>${(stat.max_response_time || 0).toFixed(2)}</td>
            <td>${(stat.current_rps || 0).toFixed(2)}</td>
        `;
    });
}

// Create detailed module error breakdown
function createModuleErrorBreakdown(moduleErrors) {
    // Find the chart container and add module breakdown after it
    const chartContainer = document.querySelector('#errors .chart-container');
    
    // Remove existing breakdown if it exists
    const existingBreakdown = document.getElementById('moduleBreakdown');
    if (existingBreakdown) {
        existingBreakdown.remove();
    }
    
    // Create module breakdown container
    const breakdownContainer = document.createElement('div');
    breakdownContainer.id = 'moduleBreakdown';
    breakdownContainer.className = 'table-container';
    breakdownContainer.style.marginTop = '20px';
    
    let breakdownHtml = '<h3 class="chart-title">📊 Error Breakdown by Module</h3>';
    
    Object.keys(moduleErrors).forEach(module => {
        const moduleData = moduleErrors[module];
        
        breakdownHtml += `
            <div style="margin-bottom: 25px; border: 1px solid #e0e0e0; border-radius: 10px; padding: 15px;">
                <h4 style="color: #667eea; margin-bottom: 15px; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.8em; margin-right: 10px;">
                        ${moduleData.totalErrors} errors
                    </span>
                    🔧 ${module}
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
        `;
        
        Object.keys(moduleData.errorTypes).forEach(errorType => {
            const count = moduleData.errorTypes[errorType];
            const percentage = ((count / moduleData.totalErrors) * 100).toFixed(1);
            
            breakdownHtml += `
                <div style="background: #f8f9ff; padding: 12px; border-radius: 8px; border-left: 4px solid #e74c3c;">
                    <div style="font-weight: 600; color: #e74c3c; margin-bottom: 5px;">${errorType}</div>
                    <div style="color: #666; font-size: 0.9em;">
                        ${count} occurrences (${percentage}% of module errors)
                    </div>
                </div>
            `;
        });
        
        breakdownHtml += '</div></div>';
    });
    
    breakdownContainer.innerHTML = breakdownHtml;
    
    // Insert after the chart container
    chartContainer.parentNode.insertBefore(breakdownContainer, chartContainer.nextSibling);
}

// Create error table
function createErrorTable() {
    const table = document.getElementById('errorTable').getElementsByTagName('tbody')[0];
    const tableContainer = table.closest('.table-container');
    
    // Update table headers to include module
    const thead = table.closest('table').querySelector('thead tr');
    thead.innerHTML = `
        <th>Module</th>
        <th>Endpoint</th>
        <th>Count</th>
        <th>Error Message</th>
    `;
    
    table.innerHTML = '';
    
    const failures = reportData.failures_statistics || [];
    
    if (failures.length === 0) {
        const row = table.insertRow();
        row.innerHTML = '<td colspan="4" style="text-align: center; color: #27ae60;">🎉 No errors found!</td>';
        return;
    }
    
    // Group by module for table display
    const moduleErrors = groupErrorsByModule(failures);
    
    Object.keys(moduleErrors).forEach(module => {
        const moduleData = moduleErrors[module];
        
        // Add module header row
        const moduleHeaderRow = table.insertRow();
        moduleHeaderRow.style.backgroundColor = '#f8f9ff';
        moduleHeaderRow.style.fontWeight = 'bold';
        moduleHeaderRow.innerHTML = `
            <td colspan="4" style="padding: 15px 12px; border-bottom: 2px solid #667eea; color: #667eea;">
                🔧 ${module} Module - ${moduleData.totalErrors} total errors
            </td>
        `;
        
        // Add individual error rows for this module
        moduleData.details.forEach(failure => {
            const row = table.insertRow();
            const errorMessage = failure.error || 'Unknown Error';
            const truncatedMessage = errorMessage.length > 80 ? errorMessage.substring(0, 80) + '...' : errorMessage;
            
            row.innerHTML = `
                <td style="padding-left: 25px; color: #888; font-size: 0.9em;">↳</td>
                <td class="error">${failure.method || 'N/A'} ${failure.name || 'N/A'}</td>
                <td class="error">${failure.occurrences || 1}</td>
                <td title="${errorMessage}" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${truncatedMessage}</td>
            `;
        });
    });
}

// Tab switching functionality
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

// Drag and drop functionality
document.addEventListener('DOMContentLoaded', function() {
    const fileUpload = document.querySelector('.file-upload');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUpload.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        fileUpload.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        fileUpload.addEventListener(eventName, unhighlight, false);
    });
    
    fileUpload.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        fileUpload.classList.add('highlight');
    }
    
    function unhighlight(e) {
        fileUpload.classList.remove('highlight');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            document.getElementById('fileInput').files = files;
            handleFileUpload({ target: { files: files } });
        }
    }
});

// Add CSS for drag and drop highlight
const style = document.createElement('style');
style.textContent = `
    .file-upload.highlight {
        border-color: #764ba2 !important;
        background: #f0f4ff !important;
        transform: scale(1.02);
    }
`;
document.head.appendChild(style); 