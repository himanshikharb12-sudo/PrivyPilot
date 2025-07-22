// PrivyPilot Main Application JavaScript

// Global variables
let userLocation = null;
let isVoiceActive = false;
let recognition = null;
let synthesis = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    initializePWA();
    initializeVoiceAssistant();
    initializeLocationServices();
    setupEventListeners();
});

// App Initialization
function initializeApp() {
    console.log('PrivyPilot App Initialized');
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
    
    // Set up form validation
    setupFormValidation();
    
    // Initialize theme
    initializeTheme();
}

// PWA Functionality
function initializePWA() {
    let deferredPrompt;
    const installPrompt = document.getElementById('pwa-install-prompt');
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-dismiss-btn');
    
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install prompt
        if (installPrompt) {
            installPrompt.style.display = 'block';
        }
    });
    
    // Install button click
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('PWA installed');
                    showNotification('PrivyPilot installed successfully!', 'success');
                }
                
                deferredPrompt = null;
                installPrompt.style.display = 'none';
            }
        });
    }
    
    // Dismiss button click
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            installPrompt.style.display = 'none';
            localStorage.setItem('pwa-dismissed', 'true');
        });
    }
    
    // Hide prompt if previously dismissed
    if (localStorage.getItem('pwa-dismissed') === 'true' && installPrompt) {
        installPrompt.style.display = 'none';
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// Voice Assistant Initialization
function initializeVoiceAssistant() {
    if ('speechRecognition' in window || 'webkitSpeechRecognition' in window) {
        recognition = new (window.speechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = getCurrentLanguage();
        
        recognition.onstart = function() {
            isVoiceActive = true;
            updateVoiceUI(true);
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            handleVoiceCommand(transcript);
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            isVoiceActive = false;
            updateVoiceUI(false);
            showNotification('Voice recognition error. Please try again.', 'error');
        };
        
        recognition.onend = function() {
            isVoiceActive = false;
            updateVoiceUI(false);
        };
    }
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
        synthesis = window.speechSynthesis;
    }
}

// Location Services
function initializeLocationServices() {
    if (navigator.geolocation) {
        // Try to get cached location first
        const cachedLat = sessionStorage.getItem('userLat');
        const cachedLng = sessionStorage.getItem('userLng');
        
        if (cachedLat && cachedLng) {
            userLocation = {
                latitude: parseFloat(cachedLat),
                longitude: parseFloat(cachedLng)
            };
            updateLocationUI(userLocation);
        }
        
        // Get fresh location
        getCurrentLocation();
    }
}

// Get Current Location
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by this browser.', 'error');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            // Cache location
            sessionStorage.setItem('userLat', userLocation.latitude);
            sessionStorage.setItem('userLng', userLocation.longitude);
            
            updateLocationUI(userLocation);
            showNotification('Location detected successfully', 'success');
        },
        function(error) {
            console.error('Geolocation error:', error);
            
            let message;
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Location access denied. Please enable location services.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    message = 'Location request timed out.';
                    break;
                default:
                    message = 'An unknown error occurred while retrieving location.';
                    break;
            }
            
            showNotification(message, 'error');
        },
        options
    );
}

// Update Location UI
function updateLocationUI(location) {
    const statusEl = document.getElementById('location-status');
    const coordsEl = document.getElementById('current-location');
    
    if (statusEl) {
        statusEl.textContent = 'Located';
        statusEl.className = 'badge bg-success';
    }
    
    if (coordsEl) {
        coordsEl.textContent = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }
    
    // Update any forms with location inputs
    const latInputs = document.querySelectorAll('input[name="latitude"]');
    const lngInputs = document.querySelectorAll('input[name="longitude"]');
    
    latInputs.forEach(input => input.value = location.latitude);
    lngInputs.forEach(input => input.value = location.longitude);
}

// Voice Command Handling
function handleVoiceCommand(transcript) {
    const command = transcript.toLowerCase();
    
    console.log('Voice command:', command);
    
    // Emergency commands
    if (command.includes('emergency') || command.includes('help')) {
        window.location.href = '/emergency';
        speak('Opening emergency assistance');
        return;
    }
    
    // Find washroom commands
    if (command.includes('find') && command.includes('washroom')) {
        window.location.href = '/washrooms';
        speak('Finding nearby washrooms');
        return;
    }
    
    // Map commands
    if (command.includes('map') || command.includes('show map')) {
        window.location.href = '/map';
        speak('Opening map');
        return;
    }
    
    // Location commands
    if (command.includes('location') || command.includes('where am i')) {
        if (userLocation) {
            speak(`Your location is ${userLocation.latitude.toFixed(2)}, ${userLocation.longitude.toFixed(2)}`);
        } else {
            speak('Getting your location');
            getCurrentLocation();
        }
        return;
    }
    
    // Default response
    speak('I heard: ' + transcript + '. You can say emergency, find washroom, or show map.');
}

// Text-to-Speech
function speak(text) {
    if (synthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.lang = getCurrentLanguage() === 'hi' ? 'hi-IN' : 'en-US';
        synthesis.speak(utterance);
    }
}

// Toggle Voice Input
function toggleVoiceInput() {
    if (isVoiceActive) {
        recognition.stop();
    } else {
        if (recognition) {
            recognition.start();
        } else {
            showNotification('Voice recognition not supported in your browser.', 'error');
        }
    }
}

// Update Voice UI
function updateVoiceUI(isActive) {
    const voiceBtn = document.getElementById('voice-btn');
    
    if (voiceBtn) {
        if (isActive) {
            voiceBtn.innerHTML = '<i class="bi bi-mic-fill"></i> Listening...';
            voiceBtn.classList.remove('btn-outline-success');
            voiceBtn.classList.add('btn-success', 'voice-recording');
        } else {
            voiceBtn.innerHTML = '<i class="bi bi-mic"></i> Speak';
            voiceBtn.classList.remove('btn-success', 'voice-recording');
            voiceBtn.classList.add('btn-outline-success');
        }
    }
}

// Get Current Language
function getCurrentLanguage() {
    // Try to get from user profile or default to browser language
    const userLang = document.documentElement.lang || navigator.language.substr(0, 2);
    return userLang === 'hi' ? 'hi-IN' : 'en-US';
}

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// Form Validation
function setupFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    
    Array.from(forms).forEach(function(form) {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
                
                // Focus on first invalid field
                const firstInvalid = form.querySelector(':invalid');
                if (firstInvalid) {
                    firstInvalid.focus();
                }
            }
            
            form.classList.add('was-validated');
        }, false);
    });
}

// Event Listeners
function setupEventListeners() {
    // Handle online/offline status
    window.addEventListener('online', function() {
        showNotification('Connection restored', 'success');
    });
    
    window.addEventListener('offline', function() {
        showNotification('You are offline. Some features may be limited.', 'warning');
    });
    
    // Handle back button navigation
    window.addEventListener('popstate', function(event) {
        // Handle any cleanup needed when navigating back
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Ctrl+E for emergency (or Cmd+E on Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault();
            window.location.href = '/emergency';
        }
        
        // Ctrl+F for find washrooms
        if ((event.ctrlKey || event.metaKey) && event.key === 'f' && event.target.tagName !== 'INPUT') {
            event.preventDefault();
            window.location.href = '/washrooms';
        }
    });
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 100px; right: 20px; z-index: 9999; min-width: 300px;';
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function formatDistance(distance) {
    if (distance < 1) {
        return Math.round(distance * 1000) + ' m';
    } else {
        return distance.toFixed(1) + ' km';
    }
}

function formatTime(minutes) {
    if (minutes < 60) {
        return minutes + ' min';
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours + 'h ' + mins + 'm';
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Export functions for use in other scripts
window.PrivyPilot = {
    getCurrentLocation,
    speak,
    toggleVoiceInput,
    showNotification,
    formatDistance,
    formatTime,
    calculateDistance,
    userLocation: () => userLocation
};
