// PrivyPilot Map Functionality

let map;
let userMarker;
let washroomMarkers = [];
let vanMarkers = [];
let emergencyMarkers = [];
let routeControl;

// Map configuration
const MAP_CONFIG = {
    defaultCenter: [28.6139, 77.2090], // New Delhi
    defaultZoom: 13,
    maxZoom: 18,
    minZoom: 5
};

// Marker icons
const MARKER_ICONS = {
    user: {
        html: '<i class="bi bi-person-fill text-danger fs-3"></i>',
        className: 'user-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    },
    washroom: {
        html: '<i class="bi bi-building text-primary fs-3"></i>',
        className: 'washroom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    },
    van: {
        html: '<i class="bi bi-truck text-warning fs-3"></i>',
        className: 'van-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    },
    emergency: {
        html: '<i class="bi bi-exclamation-triangle text-danger fs-3"></i>',
        className: 'emergency-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }
};

// Initialize map
function initializeMap(containerId = 'map', center = null, zoom = null) {
    const mapCenter = center || MAP_CONFIG.defaultCenter;
    const mapZoom = zoom || MAP_CONFIG.defaultZoom;
    
    map = L.map(containerId).setView(mapCenter, mapZoom);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: MAP_CONFIG.maxZoom,
        minZoom: MAP_CONFIG.minZoom
    }).addTo(map);
    
    // Add map controls
    addMapControls();
    
    return map;
}

// Add map controls
function addMapControls() {
    // Locate control
    L.control.locate({
        position: 'topright',
        strings: {
            title: "Show my location"
        },
        flyTo: true,
        cacheLocation: true,
        setView: 'untilPanOrZoom',
        keepCurrentZoomLevel: true,
        locateOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    }).addTo(map);
    
    // Scale control
    L.control.scale({
        position: 'bottomleft',
        imperial: false
    }).addTo(map);
}

// Add user location marker
function addUserMarker(lat, lng, popup = 'Your Location') {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    userMarker = L.marker([lat, lng], {
        icon: createDivIcon(MARKER_ICONS.user)
    }).addTo(map);
    
    if (popup) {
        userMarker.bindPopup(popup);
    }
    
    return userMarker;
}

// Add washroom markers
function addWashroomMarkers(washrooms) {
    clearWashroomMarkers();
    
    washrooms.forEach(washroom => {
        const icon = getWashroomIcon(washroom.type);
        const marker = L.marker([washroom.latitude, washroom.longitude], {
            icon: createDivIcon({
                ...MARKER_ICONS.washroom,
                html: `<i class="bi bi-${icon} text-primary fs-3"></i>`
            })
        }).addTo(map);
        
        // Create popup content
        const popupContent = createWashroomPopup(washroom);
        marker.bindPopup(popupContent);
        
        // Add click event
        marker.on('click', function() {
            showWashroomDetails(washroom);
        });
        
        washroomMarkers.push(marker);
    });
    
    // Fit map to show all markers
    if (washroomMarkers.length > 0) {
        const group = new L.featureGroup([...washroomMarkers, userMarker].filter(Boolean));
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Get washroom icon based on type
function getWashroomIcon(type) {
    const icons = {
        mall: 'building',
        cafe: 'cup-hot',
        petrol_pump: 'fuel-pump',
        restaurant: 'shop',
        govt: 'bank'
    };
    return icons[type] || 'geo-alt';
}

// Create washroom popup content
function createWashroomPopup(washroom) {
    const rating = '★'.repeat(Math.floor(washroom.cleanliness_score)) + 
                  '☆'.repeat(5 - Math.floor(washroom.cleanliness_score));
    
    return `
        <div class="washroom-popup">
            <h6 class="fw-bold mb-2">${washroom.name}</h6>
            <div class="mb-2">
                <span class="badge bg-${getTypeColor(washroom.type)}">${washroom.type.replace('_', ' ').toUpperCase()}</span>
                ${washroom.is_paid ? '<span class="badge bg-info">PAID</span>' : '<span class="badge bg-success">FREE</span>'}
            </div>
            <div class="mb-2">
                <span class="text-warning">${rating}</span>
                <span class="small text-muted">(${washroom.cleanliness_score}/5)</span>
            </div>
            <div class="d-grid gap-1">
                <button class="btn btn-primary btn-sm" onclick="getDirections(${washroom.latitude}, ${washroom.longitude})">
                    <i class="bi bi-navigation"></i> Directions
                </button>
                <a href="/reviews/${washroom.id}" class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-star"></i> Reviews
                </a>
            </div>
        </div>
    `;
}

// Get type color
function getTypeColor(type) {
    const colors = {
        mall: 'primary',
        cafe: 'success',
        petrol_pump: 'warning',
        restaurant: 'info',
        govt: 'secondary'
    };
    return colors[type] || 'primary';
}

// Add van marker
function addVanMarker(lat, lng, vanData) {
    const marker = L.marker([lat, lng], {
        icon: createDivIcon(MARKER_ICONS.van)
    }).addTo(map);
    
    const popupContent = `
        <div class="van-popup">
            <h6 class="fw-bold mb-2">
                <i class="bi bi-truck text-warning"></i> Emergency Van
            </h6>
            <div class="mb-2">
                <strong>ETA:</strong> ${vanData.eta || 'Calculating...'} minutes
            </div>
            <div class="mb-2">
                <strong>Status:</strong> 
                <span class="badge bg-${vanData.status === 'en_route' ? 'warning' : 'success'}">
                    ${vanData.status ? vanData.status.replace('_', ' ').toUpperCase() : 'EN ROUTE'}
                </span>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    vanMarkers.push(marker);
    
    return marker;
}

// Add emergency marker
function addEmergencyMarker(lat, lng, emergencyData) {
    const marker = L.marker([lat, lng], {
        icon: createDivIcon(MARKER_ICONS.emergency)
    }).addTo(map);
    
    const popupContent = `
        <div class="emergency-popup">
            <h6 class="fw-bold mb-2 text-danger">
                <i class="bi bi-exclamation-triangle"></i> Emergency Request
            </h6>
            <div class="mb-2">
                <strong>Time:</strong> ${new Date(emergencyData.created_at).toLocaleTimeString()}
            </div>
            <div class="mb-2">
                <strong>Status:</strong> 
                <span class="badge bg-${emergencyData.status === 'active' ? 'warning' : 'success'}">
                    ${emergencyData.status.toUpperCase()}
                </span>
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    emergencyMarkers.push(marker);
    
    return marker;
}

// Create div icon
function createDivIcon(config) {
    return L.divIcon({
        className: config.className,
        html: config.html,
        iconSize: config.iconSize,
        iconAnchor: config.iconAnchor
    });
}

// Clear markers
function clearWashroomMarkers() {
    washroomMarkers.forEach(marker => map.removeLayer(marker));
    washroomMarkers = [];
}

function clearVanMarkers() {
    vanMarkers.forEach(marker => map.removeLayer(marker));
    vanMarkers = [];
}

function clearEmergencyMarkers() {
    emergencyMarkers.forEach(marker => map.removeLayer(marker));
    emergencyMarkers = [];
}

function clearAllMarkers() {
    clearWashroomMarkers();
    clearVanMarkers();
    clearEmergencyMarkers();
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
}

// Route management
function addRoute(waypoints, options = {}) {
    if (routeControl) {
        map.removeControl(routeControl);
    }
    
    routeControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        createMarker: function() { return null; }, // Don't create default markers
        lineOptions: {
            styles: [
                { color: '#2563eb', weight: 6, opacity: 0.7 }
            ]
        },
        ...options
    }).addTo(map);
    
    return routeControl;
}

function removeRoute() {
    if (routeControl) {
        map.removeControl(routeControl);
        routeControl = null;
    }
}

// Map utility functions
function centerMapOnUser() {
    if (window.PrivyPilot && window.PrivyPilot.userLocation()) {
        const location = window.PrivyPilot.userLocation();
        map.setView([location.latitude, location.longitude], 15);
    } else {
        navigator.geolocation.getCurrentPosition(function(position) {
            map.setView([position.coords.latitude, position.coords.longitude], 15);
        });
    }
}

function fitMapToMarkers() {
    const allMarkers = [...washroomMarkers, ...vanMarkers, ...emergencyMarkers];
    if (userMarker) allMarkers.push(userMarker);
    
    if (allMarkers.length > 0) {
        const group = new L.featureGroup(allMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function setMapView(lat, lng, zoom = 15) {
    map.setView([lat, lng], zoom);
}

// Distance calculation
function calculateMapDistance(lat1, lng1, lat2, lng2) {
    return map.distance([lat1, lng1], [lat2, lng2]) / 1000; // Convert to km
}

// Get directions
function getDirections(lat, lng) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            // Try to use map routing first
            if (L.Routing) {
                addRoute([
                    L.latLng(userLat, userLng),
                    L.latLng(lat, lng)
                ]);
            } else {
                // Fallback to external navigation
                const url = `https://www.google.com/maps/dir/${userLat},${userLng}/${lat},${lng}`;
                window.open(url, '_blank');
            }
        }, function(error) {
            // Fallback if geolocation fails
            const url = `https://www.google.com/maps/search/${lat},${lng}`;
            window.open(url, '_blank');
        });
    } else {
        const url = `https://www.google.com/maps/search/${lat},${lng}`;
        window.open(url, '_blank');
    }
}

// Show washroom details
function showWashroomDetails(washroom) {
    // This function can be customized based on specific needs
    const modal = document.getElementById('washroomModal');
    if (modal) {
        // Update modal content with washroom details
        // Implementation depends on the specific modal structure
        const bootstrap_modal = new bootstrap.Modal(modal);
        bootstrap_modal.show();
    }
}

// Map event handlers
function onMapReady(callback) {
    if (map) {
        callback(map);
    } else {
        // Wait for map to be initialized
        const checkMap = setInterval(() => {
            if (map) {
                clearInterval(checkMap);
                callback(map);
            }
        }, 100);
    }
}

// Filter markers by distance
function filterMarkersByDistance(maxDistance, userLat, userLng) {
    washroomMarkers.forEach(marker => {
        const markerPos = marker.getLatLng();
        const distance = calculateMapDistance(userLat, userLng, markerPos.lat, markerPos.lng);
        
        if (distance <= maxDistance) {
            if (!map.hasLayer(marker)) {
                map.addLayer(marker);
            }
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
    });
}

// Export functions for global use
window.MapUtils = {
    initializeMap,
    addUserMarker,
    addWashroomMarkers,
    addVanMarker,
    addEmergencyMarker,
    clearAllMarkers,
    addRoute,
    removeRoute,
    centerMapOnUser,
    fitMapToMarkers,
    setMapView,
    getDirections,
    calculateMapDistance,
    filterMarkersByDistance,
    onMapReady
};
