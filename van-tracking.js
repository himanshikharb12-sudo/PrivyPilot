// PrivyPilot Van Tracking Module

class VanTracker {
    constructor() {
        this.trackingMap = null;
        this.vanMarker = null;
        this.userMarker = null;
        this.routeLine = null;
        this.updateInterval = null;
        this.requestId = null;
        this.isTracking = false;
        
        this.initializeTracker();
    }
    
    initializeTracker() {
        // Get request ID from URL or data attributes
        const pathParts = window.location.pathname.split('/');
        if (pathParts.includes('van_tracking')) {
            this.requestId = pathParts[pathParts.indexOf('van_tracking') + 1];
        }
        
        console.log('Van tracker initialized for request:', this.requestId);
    }
    
    initializeTrackingMap(containerId = 'tracking-map', userLat, userLng, vanLat, vanLng) {
        // Initialize Leaflet map centered between user and van
        const centerLat = (parseFloat(userLat) + parseFloat(vanLat)) / 2;
        const centerLng = (parseFloat(userLng) + parseFloat(vanLng)) / 2;
        
        this.trackingMap = L.map(containerId).setView([centerLat, centerLng], 14);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.trackingMap);
        
        // Add user location marker
        this.userMarker = L.marker([userLat, userLng], {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<div class="position-relative"><i class="bi bi-person-fill text-danger fs-3"></i><div class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">You</div></div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(this.trackingMap);
        
        this.userMarker.bindPopup('<strong>Your Location</strong><br>Emergency request location');
        
        // Add van marker
        this.vanMarker = L.marker([vanLat, vanLng], {
            icon: L.divIcon({
                className: 'van-location-marker',
                html: '<div class="position-relative"><i class="bi bi-truck text-warning fs-3"></i><div class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark">Van</div></div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        }).addTo(this.trackingMap);
        
        this.vanMarker.bindPopup('<strong>Emergency Van</strong><br>En route to your location');
        
        // Draw initial route line
        this.updateRouteLine();
        
        // Fit map bounds to show both markers
        this.fitMapToMarkers();
        
        return this.trackingMap;
    }
    
    updateRouteLine() {
        if (!this.trackingMap || !this.userMarker || !this.vanMarker) return;
        
        // Remove existing route line
        if (this.routeLine) {
            this.trackingMap.removeLayer(this.routeLine);
        }
        
        const userPos = this.userMarker.getLatLng();
        const vanPos = this.vanMarker.getLatLng();
        
        // Create dashed line between van and user
        this.routeLine = L.polyline([
            [vanPos.lat, vanPos.lng],
            [userPos.lat, userPos.lng]
        ], {
            color: '#f59e0b',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10',
            className: 'route-line'
        }).addTo(this.trackingMap);
        
        // Add arrow direction indicator
        const midLat = (vanPos.lat + userPos.lat) / 2;
        const midLng = (vanPos.lng + userPos.lng) / 2;
        
        L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'route-arrow',
                html: '<i class="bi bi-arrow-right text-warning fs-4"></i>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(this.trackingMap);
    }
    
    fitMapToMarkers() {
        if (!this.trackingMap || !this.userMarker || !this.vanMarker) return;
        
        const group = new L.featureGroup([this.userMarker, this.vanMarker]);
        this.trackingMap.fitBounds(group.getBounds().pad(0.2));
    }
    
    startTracking() {
        if (this.isTracking || !this.requestId) return;
        
        this.isTracking = true;
        console.log('Starting van tracking for request:', this.requestId);
        
        // Initial update
        this.updateVanLocation();
        
        // Set up periodic updates every 3 seconds
        this.updateInterval = setInterval(() => {
            this.updateVanLocation();
        }, 3000);
    }
    
    stopTracking() {
        this.isTracking = false;
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('Van tracking stopped');
    }
    
    async updateVanLocation() {
        if (!this.requestId || !this.isTracking) return;
        
        try {
            const response = await fetch(`/api/van_location/${this.requestId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                console.error('Van location API error:', data.error);
                this.showTrackingError(data.error);
                return;
            }
            
            // Update van marker position with animation
            this.animateVanToPosition(data.latitude, data.longitude);
            
            // Update UI elements
            this.updateTrackingUI(data);
            
            // Check if van has arrived
            if (data.status === 'arrived') {
                this.handleVanArrival(data);
            }
            
        } catch (error) {
            console.error('Failed to update van location:', error);
            this.showTrackingError('Connection error. Retrying...');
        }
    }
    
    animateVanToPosition(newLat, newLng) {
        if (!this.vanMarker) return;
        
        const currentPos = this.vanMarker.getLatLng();
        const newPos = [newLat, newLng];
        
        // Calculate distance to determine if significant movement occurred
        const distance = this.calculateDistance(currentPos.lat, currentPos.lng, newLat, newLng);
        
        if (distance > 0.01) { // Only animate if moved more than 10 meters
            // Smooth animation to new position
            this.vanMarker.setLatLng(newPos);
            
            // Update route line
            this.updateRouteLine();
            
            // Optionally re-fit bounds if van moved significantly
            if (distance > 0.1) { // More than 100 meters
                this.fitMapToMarkers();
            }
            
            // Add movement trail effect
            this.addMovementTrail(currentPos, newPos);
        }
    }
    
    addMovementTrail(fromPos, toPos) {
        const trail = L.polyline([
            [fromPos.lat, fromPos.lng],
            [toPos[0], toPos[1]]
        ], {
            color: '#22c55e',
            weight: 2,
            opacity: 0.8,
            className: 'movement-trail'
        }).addTo(this.trackingMap);
        
        // Fade out trail after 5 seconds
        setTimeout(() => {
            if (this.trackingMap.hasLayer(trail)) {
                this.trackingMap.removeLayer(trail);
            }
        }, 5000);
    }
    
    updateTrackingUI(data) {
        // Update ETA display
        const etaElements = document.querySelectorAll('#eta-minutes, #eta-display');
        etaElements.forEach(el => {
            if (el.id === 'eta-display') {
                el.textContent = `${data.eta_minutes} min`;
            } else {
                el.textContent = data.eta_minutes;
            }
        });
        
        // Update status
        const statusElement = document.getElementById('van-status');
        if (statusElement) {
            statusElement.textContent = data.status.replace('_', ' ').toUpperCase();
        }
        
        // Calculate and update distance
        if (this.userMarker && this.vanMarker) {
            const userPos = this.userMarker.getLatLng();
            const vanPos = this.vanMarker.getLatLng();
            const distance = this.calculateDistance(userPos.lat, userPos.lng, vanPos.lat, vanPos.lng);
            
            const distanceElement = document.getElementById('distance-remaining');
            if (distanceElement) {
                distanceElement.textContent = distance < 1 ? 
                    `${Math.round(distance * 1000)} m` : 
                    `${distance.toFixed(1)} km`;
            }
        }
        
        // Update progress bar
        this.updateProgressBar(data);
        
        // Update van marker popup
        if (this.vanMarker) {
            const popupContent = `
                <strong>Emergency Van</strong><br>
                Status: ${data.status.replace('_', ' ')}<br>
                ETA: ${data.eta_minutes} minutes
            `;
            this.vanMarker.setPopupContent(popupContent);
        }
    }
    
    updateProgressBar(data) {
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (!progressBar || !progressPercentage) return;
        
        // Estimate progress based on ETA (assuming initial ETA was higher)
        const initialETA = parseInt(sessionStorage.getItem('initialETA')) || 15;
        const currentETA = data.eta_minutes;
        const progress = Math.max(0, Math.min(100, ((initialETA - currentETA) / initialETA) * 100));
        
        // Store initial ETA if not set
        if (!sessionStorage.getItem('initialETA')) {
            sessionStorage.setItem('initialETA', currentETA.toString());
        }
        
        progressBar.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.round(progress)}%`;
        
        // Update progress bar color based on progress
        progressBar.className = `progress-bar ${
            progress < 30 ? 'bg-danger' :
            progress < 70 ? 'bg-warning' :
            'bg-success'
        }`;
    }
    
    handleVanArrival(data) {
        console.log('Van has arrived!');
        
        // Stop tracking
        this.stopTracking();
        
        // Show arrival notification
        this.showArrivalNotification();
        
        // Update timeline
        this.updateTimelineForArrival();
        
        // Update van marker icon to show arrival
        if (this.vanMarker) {
            this.vanMarker.setIcon(L.divIcon({
                className: 'van-location-marker arrived',
                html: '<div class="position-relative"><i class="bi bi-truck text-success fs-3"></i><div class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success">Arrived</div></div>',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            }));
            
            this.vanMarker.setPopupContent('<strong>Emergency Van - ARRIVED</strong><br>Van is at your location');
        }
        
        // Play arrival sound if supported
        this.playArrivalSound();
    }
    
    showArrivalNotification() {
        const notification = document.createElement('div');
        notification.className = 'alert alert-success alert-dismissible position-fixed shadow-lg';
        notification.style.cssText = 'top: 100px; right: 20px; z-index: 9999; min-width: 350px; border-left: 5px solid #22c55e;';
        
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="me-3">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 2rem;"></i>
                </div>
                <div class="flex-grow-1">
                    <h6 class="mb-1 fw-bold">Van Has Arrived!</h6>
                    <p class="mb-0">Your emergency washroom van is now at your location. Please check outside.</p>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
        
        // Show browser notification if permitted
        this.showBrowserNotification();
    }
    
    showBrowserNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('PrivyPilot - Van Arrived!', {
                body: 'Your emergency washroom van is now at your location.',
                icon: '/static/images/logo.svg',
                badge: '/static/images/logo.svg',
                tag: 'van-arrival',
                requireInteraction: true
            });
        }
    }
    
    updateTimelineForArrival() {
        const pendingItem = document.querySelector('.timeline-item.pending');
        if (pendingItem) {
            pendingItem.className = 'timeline-item completed';
            const marker = pendingItem.querySelector('.timeline-marker');
            if (marker) {
                marker.className = 'timeline-marker bg-success';
            }
            const timeElement = pendingItem.querySelector('small');
            if (timeElement) {
                timeElement.textContent = 'Arrived ' + new Date().toLocaleTimeString();
            }
        }
    }
    
    playArrivalSound() {
        try {
            // Create audio context and play a simple success tone
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Could not play arrival sound:', error);
        }
    }
    
    showTrackingError(message) {
        const errorElement = document.getElementById('tracking-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
    
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Public methods
    getRequestId() {
        return this.requestId;
    }
    
    setRequestId(requestId) {
        this.requestId = requestId;
    }
    
    isCurrentlyTracking() {
        return this.isTracking;
    }
    
    getTrackingMap() {
        return this.trackingMap;
    }
    
    destroy() {
        this.stopTracking();
        
        if (this.trackingMap) {
            this.trackingMap.remove();
            this.trackingMap = null;
        }
        
        this.vanMarker = null;
        this.userMarker = null;
        this.routeLine = null;
    }
}

// Global van tracker instance
let vanTracker = null;

// Initialize van tracker
function initializeVanTracker() {
    if (!vanTracker) {
        vanTracker = new VanTracker();
    }
    return vanTracker;
}

// Global functions for backward compatibility
function startVanTracking(requestId, userLat, userLng, vanLat, vanLng) {
    if (!vanTracker) {
        vanTracker = initializeVanTracker();
    }
    
    if (requestId) {
        vanTracker.setRequestId(requestId);
    }
    
    // Initialize map if coordinates provided
    if (userLat && userLng && vanLat && vanLng) {
        vanTracker.initializeTrackingMap('tracking-map', userLat, userLng, vanLat, vanLng);
    }
    
    vanTracker.startTracking();
}

function stopVanTracking() {
    if (vanTracker) {
        vanTracker.stopTracking();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a van tracking page
    if (window.location.pathname.includes('van_tracking')) {
        initializeVanTracker();
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
});

// Export for use in other modules
window.VanTracker = VanTracker;
window.vanTracker = vanTracker;
window.startVanTracking = startVanTracking;
window.stopVanTracking = stopVanTracking;
