// Kottakkal Smart Traffic Management - Main JavaScript with Google Maps

let map;
let trafficMarkers = [];
let directionsService;
let directionsRenderer;
let currentMode = 'normal';
let isEmergencyMode = false;
let isFestivalMode = false;

// Google Maps callback function
function initMap() {
    // Initialize Google Maps centered on Kottakkal, Kerala
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 10.8810, lng: 76.0900 },
        zoom: 15,
        styles: [
            {
                "featureType": "all",
                "elementType": "geometry",
                "stylers": [{ "color": "#2d3748" }]
            },
            {
                "featureType": "all",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#cbd5e0" }]
            },
            {
                "featureType": "road",
                "elementType": "geometry",
                "stylers": [{ "color": "#4a5568" }]
            },
            {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{ "color": "#1a202c" }]
            }
        ]
    });
    
    // Initialize directions service and renderer
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: true,
        polylineOptions: {
            strokeColor: '#0d6efd',
            strokeWeight: 5,
            strokeOpacity: 0.8
        }
    });
    directionsRenderer.setMap(map);
    
    // Add custom controls and initialize features
    addTrafficLegend();
    bindEventListeners();
    loadInitialData();
    updateTrafficMarkers();
    
    console.log('Google Map initialized successfully');
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Map will be initialized by Google Maps callback
    if (!document.getElementById('map')) {
        console.error('Map container not found');
    }
});

/**
 * Add traffic legend to the map
 */
function addTrafficLegend() {
    const legendDiv = document.createElement('div');
    legendDiv.className = 'map-legend bg-white p-2 rounded shadow-sm';
    legendDiv.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        background: white;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        font-size: 12px;
    `;
    legendDiv.innerHTML = `
        <h6 class="mb-2 text-dark"><i class="fas fa-info-circle"></i> Traffic Levels</h6>
        <div class="text-dark"><i class="fas fa-circle text-success"></i> Low Traffic</div>
        <div class="text-dark"><i class="fas fa-circle text-warning"></i> Moderate Traffic</div>
        <div class="text-dark"><i class="fas fa-circle text-danger"></i> Heavy Traffic</div>
    `;
    
    // Add legend to map container
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        mapContainer.appendChild(legendDiv);
    }
}

/**
 * Update traffic markers on the map
 */
function updateTrafficMarkers() {
    // Clear existing markers
    trafficMarkers.forEach(marker => marker.setMap(null));
    trafficMarkers = [];
    
    // Fetch current traffic data
    fetch('/api/traffic')
        .then(response => response.json())
        .then(data => {
            Object.entries(data).forEach(([key, locationData]) => {
                const { location, level, color } = locationData;
                
                // Create custom marker icon based on traffic level
                const markerIcon = {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: getTrafficColor(level),
                    fillOpacity: 0.8,
                    scale: 8 + (level * 10), // Size based on traffic level
                    strokeColor: '#ffffff',
                    strokeWeight: 2
                };
                
                // Create marker
                const marker = new google.maps.Marker({
                    position: { lat: location.lat, lng: location.lng },
                    map: map,
                    icon: markerIcon,
                    title: location.name
                });
                
                // Create info window with traffic information
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="traffic-popup" style="color: #333;">
                            <h6 style="margin: 0 0 8px 0; color: #333;">${location.name}</h6>
                            <p style="margin: 4px 0; color: #666;">Traffic Level: <span style="color: ${getTrafficColor(level)}; font-weight: bold;">${Math.round(level * 100)}%</span></p>
                            <p style="margin: 4px 0; color: #666;">Wait Time: ${getEstimatedWaitTime(level)}</p>
                            <button class="btn btn-sm btn-primary" onclick="getDirectionsTo(${location.lat}, ${location.lng})" style="margin-top: 8px;">
                                Get Directions
                            </button>
                        </div>
                    `
                });
                
                // Add click event to marker
                marker.addListener('click', () => {
                    infoWindow.open(map, marker);
                });
                
                trafficMarkers.push(marker);
            });
        })
        .catch(error => {
            console.error('Error fetching traffic data:', error);
            showNotification('Error loading traffic data', 'error');
        });
}

/**
 * Get traffic color based on level
 */
function getTrafficColor(level) {
    if (level < 0.3) return '#28a745'; // Green
    if (level < 0.7) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
}

/**
 * Get estimated wait time based on traffic level
 */
function getEstimatedWaitTime(level) {
    if (level < 0.3) return '1-2 min';
    if (level < 0.7) return '3-5 min';
    return '5-10 min';
}

/**
 * Bind event listeners for the application
 */
function bindEventListeners() {
    // Mode toggle buttons
    document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentMode = this.id.replace('Mode', '').toLowerCase();
            updateMapForMode(currentMode);
        });
    });
    
    // Route form submission
    const routeForm = document.getElementById('routeForm');
    if (routeForm) {
        routeForm.addEventListener('submit', handleRouteRequest);
    }
    
    // Voice recognition button
    const voiceBtn = document.getElementById('voiceReportBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', startVoiceReport);
    }
}

/**
 * Load initial data
 */
function loadInitialData() {
    // Update traffic data every 30 seconds
    setInterval(updateTrafficMarkers, 30000);
    
    // Load recent reports
    loadRecentReports();
}

/**
 * Handle route request
 */
function handleRouteRequest(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const startSelect = document.getElementById('startLocation');
    const endSelect = document.getElementById('endLocation');
    
    const startOption = startSelect.options[startSelect.selectedIndex];
    const endOption = endSelect.options[endSelect.selectedIndex];
    
    if (!startOption.value || !endOption.value) {
        showNotification('Please select both start and end locations', 'warning');
        return;
    }
    
    const startLat = startOption.dataset.lat;
    const startLng = startOption.dataset.lng;
    const endLat = endOption.dataset.lat;
    const endLng = endOption.dataset.lng;
    
    calculateRoute(startLat, startLng, endLat, endLng, currentMode);
}

/**
 * Calculate and display route using Google Maps Directions API
 */
function calculateRoute(startLat, startLng, endLat, endLng, mode) {
    const origin = new google.maps.LatLng(parseFloat(startLat), parseFloat(startLng));
    const destination = new google.maps.LatLng(parseFloat(endLat), parseFloat(endLng));
    
    // Configure request based on mode
    let travelMode = google.maps.TravelMode.DRIVING;
    let avoidHighways = false;
    let avoidTolls = false;
    let avoidFerries = true;
    
    // Mode-specific routing preferences
    switch (mode) {
        case 'emergency':
            // Emergency vehicles - fastest route, can use highways
            travelMode = google.maps.TravelMode.DRIVING;
            avoidHighways = false;
            break;
        case 'rickshaw':
            // Rickshaw - avoid highways, prefer local roads
            travelMode = google.maps.TravelMode.DRIVING;
            avoidHighways = true;
            break;
        case 'festival':
            // Festival mode - avoid main roads, use alternatives
            travelMode = google.maps.TravelMode.DRIVING;
            avoidHighways = true;
            break;
        default:
            // Normal driving
            travelMode = google.maps.TravelMode.DRIVING;
            avoidHighways = false;
    }
    
    // Add mode-specific waypoints for Kottakkal routing
    let waypoints = [];
    
    if (mode === 'emergency') {
        // Emergency routes prioritize hospital access via wider roads
        waypoints = getEmergencyWaypoints(origin, destination);
    } else if (mode === 'rickshaw') {
        // Rickshaw routes use local roads and narrow passages
        waypoints = getRickshawWaypoints(origin, destination);
    } else if (mode === 'festival') {
        // Festival routes avoid temple areas and main crowd zones
        waypoints = getFestivalAvoidanceWaypoints(origin, destination);
    }
    
    const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: travelMode,
        avoidHighways: avoidHighways,
        avoidTolls: avoidTolls,
        avoidFerries: avoidFerries,
        unitSystem: google.maps.UnitSystem.METRIC,
        region: 'IN' // India region for better local routing
    };
    
    // Clear previous route
    directionsRenderer.setDirections({ routes: [] });
    
    // Calculate new route
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            // Update renderer style based on mode
            directionsRenderer.setOptions({
                polylineOptions: {
                    strokeColor: getModeColor(mode),
                    strokeWeight: 5,
                    strokeOpacity: 0.8
                }
            });
            
            directionsRenderer.setDirections(result);
            
            // Extract route information
            const route = result.routes[0];
            const leg = route.legs[0];
            
            const routeInfo = {
                duration: leg.duration.text,
                distance: leg.distance.text,
                traffic_level: getRouteTrafficLevel(mode),
                notes: getModeNotes(mode)
            };
            
            showRouteResults(routeInfo);
            showNotification(`${mode.charAt(0).toUpperCase() + mode.slice(1)} route calculated`, 'success');
        } else {
            console.error('Directions request failed due to ' + status);
            showNotification('Could not calculate route: ' + status, 'error');
        }
    });
}

/**
 * Get route traffic level based on mode
 */
function getRouteTrafficLevel(mode) {
    switch (mode) {
        case 'emergency': return 'low';
        case 'festival': return 'high';
        default: return 'medium';
    }
}

/**
 * Get mode-specific notes
 */
function getModeNotes(mode) {
    switch (mode) {
        case 'emergency':
            return 'Emergency route - prioritizing hospital access and wide roads';
        case 'rickshaw':
            return 'Rickshaw route - using local roads and shortcuts accessible to auto-rickshaws';
        case 'festival':
            return 'Festival bypass route - avoiding temple areas and crowded zones';
        default:
            return 'Standard route based on current traffic conditions';
    }
}

/**
 * Get emergency waypoints that prioritize hospital access
 */
function getEmergencyWaypoints(origin, destination) {
    const waypoints = [];
    
    // If route involves hospital area, ensure direct access via main roads
    const hospitalLocation = { lat: 10.8815, lng: 76.0902 }; // Almas Hospital
    
    // Add hospital waypoint if emergency route
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
        destination, 
        new google.maps.LatLng(hospitalLocation.lat, hospitalLocation.lng)
    );
    
    if (distance < 1000) { // Within 1km of hospital
        waypoints.push({
            location: new google.maps.LatLng(hospitalLocation.lat, hospitalLocation.lng),
            stopover: false
        });
    }
    
    return waypoints;
}

/**
 * Get rickshaw-specific waypoints using narrow roads and shortcuts
 */
function getRickshawWaypoints(origin, destination) {
    const waypoints = [];
    
    // Rickshaw routes can use narrow roads and local shortcuts
    // Add waypoints for typical rickshaw routes in Kottakkal
    const rickshawFriendlyPoints = [
        { lat: 10.8800, lng: 76.0895 }, // Local road near market
        { lat: 10.8825, lng: 76.0910 }  // Narrow passage near temple
    ];
    
    // Add relevant waypoints based on route direction
    rickshawFriendlyPoints.forEach(point => {
        const distToOrigin = google.maps.geometry.spherical.computeDistanceBetween(
            origin, new google.maps.LatLng(point.lat, point.lng)
        );
        const distToDestination = google.maps.geometry.spherical.computeDistanceBetween(
            destination, new google.maps.LatLng(point.lat, point.lng)
        );
        
        // Add if it's reasonably on the way (within 500m of route line)
        if (distToOrigin < 500 && distToDestination < 500) {
            waypoints.push({
                location: new google.maps.LatLng(point.lat, point.lng),
                stopover: false
            });
        }
    });
    
    return waypoints;
}

/**
 * Get festival avoidance waypoints to bypass temple areas
 */
function getFestivalAvoidanceWaypoints(origin, destination) {
    const waypoints = [];
    
    // Temple areas to avoid during festivals
    const templeLocation = { lat: 10.8805, lng: 76.0910 }; // Temple Road
    const crowdedMarket = { lat: 10.8820, lng: 76.0895 };   // Market Zone
    
    // Add bypass waypoints to avoid crowded areas
    const bypassPoints = [
        { lat: 10.8790, lng: 76.0885 }, // Southern bypass
        { lat: 10.8835, lng: 76.0915 }  // Northern alternative
    ];
    
    // Check if route would pass through congested areas
    const templeDistance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng((origin.lat() + destination.lat()) / 2, (origin.lng() + destination.lng()) / 2),
        new google.maps.LatLng(templeLocation.lat, templeLocation.lng)
    );
    
    if (templeDistance < 800) { // Route passes near temple area
        // Add bypass waypoint
        waypoints.push({
            location: new google.maps.LatLng(bypassPoints[0].lat, bypassPoints[0].lng),
            stopover: false
        });
    }
    
    return waypoints;
}

/**
 * Get color for different modes
 */
function getModeColor(mode) {
    switch (mode) {
        case 'emergency': return '#dc3545';
        case 'rickshaw': return '#ffc107';
        case 'festival': return '#6f42c1';
        default: return '#0d6efd';
    }
}

/**
 * Show route results
 */
function showRouteResults(routeInfo) {
    const resultsDiv = document.getElementById('routeResults');
    if (!resultsDiv) return;
    
    document.getElementById('routeDuration').textContent = routeInfo.duration;
    document.getElementById('routeDistance').textContent = routeInfo.distance;
    document.getElementById('routeTraffic').textContent = routeInfo.traffic_level;
    document.getElementById('routeTraffic').className = `badge bg-${getTrafficBadgeClass(routeInfo.traffic_level)}`;
    document.getElementById('routeNotes').textContent = routeInfo.notes;
    
    resultsDiv.style.display = 'block';
}

/**
 * Get badge class for traffic level
 */
function getTrafficBadgeClass(level) {
    switch (level) {
        case 'low': return 'success';
        case 'high': return 'danger';
        default: return 'warning';
    }
}

/**
 * Update map display based on mode
 */
function updateMapForMode(mode) {
    console.log(`Switching to ${mode} mode`);
    
    // Update visual styling based on mode
    const mapContainer = document.getElementById('map-container');
    
    // Remove existing mode classes
    mapContainer.classList.remove('emergency-mode', 'festival-mode');
    
    switch (mode) {
        case 'emergency':
            mapContainer.classList.add('emergency-mode');
            showNotification('Emergency mode activated - prioritizing hospital routes', 'info');
            break;
        case 'festival':
            mapContainer.classList.add('festival-mode');
            showNotification('Festival mode activated - avoiding temple areas', 'info');
            break;
        case 'rickshaw':
            showNotification('Rickshaw mode activated - including narrow roads', 'info');
            break;
        default:
            showNotification('Normal mode activated', 'info');
    }
    
    // Update traffic markers if needed
    updateTrafficMarkers();
}

/**
 * Toggle traffic view
 */
function toggleTrafficView() {
    const isVisible = trafficMarkers.length > 0 && trafficMarkers[0].getMap() !== null;
    
    trafficMarkers.forEach(marker => {
        marker.setMap(isVisible ? null : map);
    });
    
    showNotification(isVisible ? 'Traffic view hidden' : 'Traffic view shown', 'info');
}

/**
 * Start voice reporting
 */
function startVoiceReport() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showNotification('Voice recognition not supported in this browser', 'error');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
        showNotification('Listening... Please speak your report', 'info');
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        processVoiceReport(transcript);
    };
    
    recognition.onerror = function(event) {
        showNotification('Voice recognition error: ' + event.error, 'error');
    };
    
    recognition.start();
}

/**
 * Process voice report
 */
function processVoiceReport(transcript) {
    console.log('Voice report:', transcript);
    
    // Simple keyword detection for incident types
    let incidentType = 'traffic_jam';
    if (transcript.toLowerCase().includes('accident')) incidentType = 'accident';
    if (transcript.toLowerCase().includes('pothole')) incidentType = 'pothole';
    if (transcript.toLowerCase().includes('block')) incidentType = 'road_block';
    if (transcript.toLowerCase().includes('festival') || transcript.toLowerCase().includes('crowd')) incidentType = 'festival_crowd';
    
    // Create quick report
    createQuickReport(incidentType, transcript);
}

/**
 * Create quick report
 */
function createQuickReport(type, description) {
    // Get current location if available
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            submitQuickReport({
                type: type,
                description: description,
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                location: 'Current Location'
            });
        });
    } else {
        // Use default location
        submitQuickReport({
            type: type,
            description: description,
            lat: 10.8810,
            lng: 76.0900,
            location: 'Kottakkal Center'
        });
    }
}

/**
 * Submit quick report
 */
function submitQuickReport(reportData) {
    // In a real implementation, this would send to the server
    console.log('Quick report submitted:', reportData);
    showNotification('Report submitted successfully!', 'success');
    
    // Add marker to map for immediate feedback
    const marker = new google.maps.Marker({
        position: { lat: reportData.lat, lng: reportData.lng },
        map: map,
        icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: '#ffc107',
            fillOpacity: 1,
            scale: 6,
            strokeColor: '#ffffff',
            strokeWeight: 2
        },
        title: 'New Report'
    });
    
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="color: #333;">
                <h6 style="margin: 0 0 8px 0; color: #333;">New Report</h6>
                <p style="margin: 4px 0; color: #666;"><strong>Type:</strong> ${reportData.type.replace('_', ' ')}</p>
                <p style="margin: 4px 0; color: #666;"><strong>Description:</strong> ${reportData.description}</p>
            </div>
        `
    });
    
    marker.addListener('click', () => {
        infoWindow.open(map, marker);
    });
}

/**
 * Show quick report modal
 */
function showQuickReport() {
    const modal = new bootstrap.Modal(document.getElementById('quickReportModal'));
    
    // Get current location for the report
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            document.getElementById('quickReportLocation').value = 'Current Location';
            document.getElementById('quickReportLat').value = position.coords.latitude;
            document.getElementById('quickReportLng').value = position.coords.longitude;
        });
    }
    
    modal.show();
}

/**
 * Submit quick report from modal
 */
function submitQuickReport() {
    const type = document.getElementById('quickReportType').value;
    const description = document.getElementById('quickReportDescription').value;
    const lat = document.getElementById('quickReportLat').value;
    const lng = document.getElementById('quickReportLng').value;
    const location = document.getElementById('quickReportLocation').value;
    
    if (!type || !description) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }
    
    // Submit the report
    const formData = new FormData();
    formData.append('incident_type', type);
    formData.append('description', description);
    formData.append('lat', lat);
    formData.append('lng', lng);
    formData.append('location', location);
    formData.append('severity', 'medium');
    formData.append('reported_by', 'Quick Report');
    
    fetch('/report', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            showNotification('Report submitted successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('quickReportModal')).hide();
            updateTrafficMarkers(); // Refresh the map
        } else {
            showNotification('Error submitting report', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error submitting report', 'error');
    });
}

/**
 * Get directions to a specific location
 */
function getDirectionsTo(lat, lng) {
    console.log(`Getting directions to ${lat}, ${lng}`);
    showNotification('Getting directions...', 'info');
    
    // Get current location if available
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            calculateRoute(userLat, userLng, lat, lng, currentMode);
        }, function() {
            // Use Kottakkal center as default starting point
            calculateRoute(10.8810, 76.0900, lat, lng, currentMode);
        });
    } else {
        // Use Kottakkal center as default starting point
        calculateRoute(10.8810, 76.0900, lat, lng, currentMode);
    }
}

/**
 * Load recent reports
 */
function loadRecentReports() {
    fetch('/api/reports')
        .then(response => response.json())
        .then(reports => {
            // Display recent reports on the map
            reports.slice(-10).forEach(report => {
                if (report.lat && report.lng) {
                    const marker = new google.maps.Marker({
                        position: { lat: report.lat, lng: report.lng },
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                            fillColor: getSeverityHexColor(report.severity),
                            fillOpacity: 1,
                            scale: 5,
                            strokeColor: '#ffffff',
                            strokeWeight: 1
                        },
                        title: report.type.replace('_', ' ').toUpperCase()
                    });
                    
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div style="color: #333; max-width: 250px;">
                                <h6 style="margin: 0 0 8px 0; color: #333;">${report.type.replace('_', ' ').toUpperCase()}</h6>
                                <p style="margin: 4px 0; color: #666;"><strong>Location:</strong> ${report.location}</p>
                                <p style="margin: 4px 0; color: #666;"><strong>Description:</strong> ${report.description}</p>
                                <p style="margin: 4px 0; color: #666;"><strong>Severity:</strong> <span style="color: ${getSeverityHexColor(report.severity)}; font-weight: bold;">${report.severity}</span></p>
                                <small style="color: #999;">Reported by: ${report.reported_by}</small>
                            </div>
                        `
                    });
                    
                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                    });
                }
            });
        })
        .catch(error => {
            console.error('Error loading reports:', error);
        });
}

/**
 * Get icon for incident type
 */
function getIncidentIcon(type) {
    switch (type) {
        case 'accident': return 'car-crash';
        case 'pothole': return 'road';
        case 'road_block': return 'ban';
        case 'festival_crowd': return 'users';
        case 'construction': return 'hard-hat';
        case 'flooding': return 'water';
        default: return 'exclamation-triangle';
    }
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity) {
    switch (severity) {
        case 'low': return 'success';
        case 'high': return 'danger';
        default: return 'warning';
    }
}

/**
 * Get hex color for severity level
 */
function getSeverityHexColor(severity) {
    switch (severity) {
        case 'low': return '#28a745';
        case 'high': return '#dc3545';
        default: return '#ffc107';
    }
}

/**
 * Toggle emergency mode
 */
function toggleEmergencyMode() {
    isEmergencyMode = !isEmergencyMode;
    currentMode = isEmergencyMode ? 'emergency' : 'normal';
    
    // Update the radio button
    document.getElementById(isEmergencyMode ? 'emergencyMode' : 'normalMode').checked = true;
    
    updateMapForMode(currentMode);
}

/**
 * Toggle festival mode
 */
function toggleFestivalMode() {
    isFestivalMode = !isFestivalMode;
    currentMode = isFestivalMode ? 'festival' : 'normal';
    
    // Update the radio button
    document.getElementById(isFestivalMode ? 'festivalMode' : 'normalMode').checked = true;
    
    updateMapForMode(currentMode);
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'info'} alert-dismissible fade show`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
    `;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

/**
 * Switch language
 */
function switchLanguage(lang) {
    console.log(`Switching to ${lang} language`);
    // In a real implementation, this would update all text elements
    showNotification(`Language switched to ${lang === 'ml' ? 'Malayalam' : 'English'}`, 'info');
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

/**
 * Show route alternatives
 */
function showRouteAlternatives() {
    showNotification('Alternative routes feature coming soon!', 'info');
}

// Export functions for global access
window.toggleTrafficView = toggleTrafficView;
window.startVoiceReport = startVoiceReport;
window.showQuickReport = showQuickReport;
window.submitQuickReport = submitQuickReport;
window.getDirectionsTo = getDirectionsTo;
window.toggleEmergencyMode = toggleEmergencyMode;
window.toggleFestivalMode = toggleFestivalMode;
window.switchLanguage = switchLanguage;
window.showRouteAlternatives = showRouteAlternatives;
