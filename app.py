import os
import json
import pandas as pd
import logging
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
import random
import math

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "kottakkal-traffic-management-2024")

# Kottakkal specific locations and landmarks
KOTTAKKAL_LOCATIONS = {
    'changuvetty': {'lat': 10.8808, 'lng': 76.0905, 'name': 'Changuvetty'},
    'avs_junction': {'lat': 10.8812, 'lng': 76.0908, 'name': 'AVS Junction'},
    'almas_hospital': {'lat': 10.8815, 'lng': 76.0902, 'name': 'Almas Hospital'},
    'temple_road': {'lat': 10.8805, 'lng': 76.0910, 'name': 'Temple Road'},
    'market_zone': {'lat': 10.8820, 'lng': 76.0895, 'name': 'Market Zone'},
    'kottakkal_center': {'lat': 10.8810, 'lng': 76.0900, 'name': 'Kottakkal Center'}
}

def load_traffic_data():
    """Load traffic simulation data from CSV"""
    try:
        df = pd.read_csv('data/traffic_simulation.csv')
        return df.to_dict('records')
    except Exception as e:
        logging.error(f"Error loading traffic data: {e}")
        return []

def load_reports():
    """Load incident reports from JSON"""
    try:
        with open('data/reports.json', 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error loading reports: {e}")
        return []

def save_report(report):
    """Save a new incident report"""
    try:
        reports = load_reports()
        report['id'] = len(reports) + 1
        report['timestamp'] = datetime.now().isoformat()
        reports.append(report)
        
        with open('data/reports.json', 'w') as f:
            json.dump(reports, f, indent=2)
        return True
    except Exception as e:
        logging.error(f"Error saving report: {e}")
        return False

def get_traffic_level(location, time_hour=None):
    """Get current traffic level for a location"""
    if time_hour is None:
        time_hour = datetime.now().hour
    
    # Simulate traffic patterns based on time and location
    base_traffic = 0.3
    
    # Peak hours (7-9 AM, 5-7 PM)
    if 7 <= time_hour <= 9 or 17 <= time_hour <= 19:
        base_traffic += 0.4
    
    # Location-specific factors
    location_factors = {
        'changuvetty': 0.2,
        'avs_junction': 0.3,
        'almas_hospital': 0.1,
        'temple_road': 0.4,
        'market_zone': 0.3,
        'kottakkal_center': 0.2
    }
    
    traffic_level = base_traffic + location_factors.get(location, 0.2)
    traffic_level += random.uniform(-0.1, 0.1)  # Add some randomness
    
    return min(1.0, max(0.0, traffic_level))

def calculate_route(start, end, mode='normal'):
    """Calculate route between two points with mode-specific optimizations"""
    # Simple route calculation for demo
    # In a real app, this would use routing APIs
    
    route_points = [start, end]
    
    # Mode-specific route modifications
    if mode == 'emergency':
        # Prioritize wider roads and hospital routes
        route_info = {
            'duration': '8-12 min',
            'distance': '3.2 km',
            'traffic_level': 'low',
            'notes': 'Emergency route - wider roads prioritized'
        }
    elif mode == 'rickshaw':
        # Include narrow roads and shortcuts
        route_info = {
            'duration': '10-15 min',
            'distance': '2.8 km',
            'traffic_level': 'medium',
            'notes': 'Rickshaw route - includes narrow roads and shortcuts'
        }
    elif mode == 'festival':
        # Avoid temple areas and crowded zones
        route_info = {
            'duration': '15-20 min',
            'distance': '4.1 km',
            'traffic_level': 'high',
            'notes': 'Festival bypass route - avoiding temple areas'
        }
    else:
        # Normal routing
        route_info = {
            'duration': '12-18 min',
            'distance': '3.5 km',
            'traffic_level': 'medium',
            'notes': 'Standard route'
        }
    
    return {
        'points': route_points,
        'info': route_info
    }

@app.route('/')
def index():
    """Main traffic map view"""
    traffic_data = load_traffic_data()
    reports = load_reports()
    
    # Get current traffic levels for key locations
    current_traffic = {}
    for loc_key, loc_data in KOTTAKKAL_LOCATIONS.items():
        current_traffic[loc_key] = {
            'level': get_traffic_level(loc_key),
            'location': loc_data
        }
    
    return render_template('index.html', 
                         traffic_data=current_traffic,
                         reports=reports[-10:],  # Last 10 reports
                         locations=KOTTAKKAL_LOCATIONS)

@app.route('/dashboard')
def dashboard():
    """Traffic analytics dashboard"""
    traffic_data = load_traffic_data()
    reports = load_reports()
    
    # Generate analytics data
    analytics = {
        'total_reports': len(reports),
        'active_incidents': len([r for r in reports if r.get('status', 'active') == 'active']),
        'peak_congestion_time': '8:00 AM - 9:00 AM',
        'most_congested_area': 'AVS Junction'
    }
    
    # Traffic patterns for the last 24 hours
    traffic_patterns = []
    for hour in range(24):
        avg_traffic = sum(get_traffic_level(loc) for loc in KOTTAKKAL_LOCATIONS.keys()) / len(KOTTAKKAL_LOCATIONS)
        traffic_patterns.append({
            'hour': hour,
            'level': avg_traffic
        })
    
    return render_template('dashboard.html',
                         analytics=analytics,
                         traffic_patterns=traffic_patterns,
                         reports=reports[-20:])

@app.route('/report', methods=['GET', 'POST'])
def report_incident():
    """Incident reporting page"""
    if request.method == 'POST':
        # Handle form submission
        report_data = {
            'type': request.form.get('incident_type'),
            'location': request.form.get('location'),
            'lat': float(request.form.get('lat', 0)),
            'lng': float(request.form.get('lng', 0)),
            'description': request.form.get('description'),
            'severity': request.form.get('severity', 'medium'),
            'status': 'active',
            'reported_by': request.form.get('reporter_name', 'Anonymous')
        }
        
        if save_report(report_data):
            flash('Incident reported successfully!', 'success')
        else:
            flash('Error reporting incident. Please try again.', 'error')
        
        return redirect(url_for('index'))
    
    return render_template('report.html', locations=KOTTAKKAL_LOCATIONS)

@app.route('/api/route')
def api_route():
    """API endpoint for route calculation"""
    start_lat = float(request.args.get('start_lat', 0))
    start_lng = float(request.args.get('start_lng', 0))
    end_lat = float(request.args.get('end_lat', 0))
    end_lng = float(request.args.get('end_lng', 0))
    mode = request.args.get('mode', 'normal')
    
    start_point = [start_lat, start_lng]
    end_point = [end_lat, end_lng]
    
    route = calculate_route(start_point, end_point, mode)
    
    return jsonify(route)

@app.route('/api/traffic')
def api_traffic():
    """API endpoint for current traffic data"""
    current_traffic = {}
    for loc_key, loc_data in KOTTAKKAL_LOCATIONS.items():
        current_traffic[loc_key] = {
            'level': get_traffic_level(loc_key),
            'location': loc_data,
            'color': get_traffic_color(get_traffic_level(loc_key))
        }
    
    return jsonify(current_traffic)

@app.route('/api/reports')
def api_reports():
    """API endpoint for incident reports"""
    reports = load_reports()
    return jsonify(reports)

def get_traffic_color(level):
    """Get color code for traffic level"""
    if level < 0.3:
        return 'green'
    elif level < 0.7:
        return 'yellow'
    else:
        return 'red'

if __name__ == '__main__':
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
