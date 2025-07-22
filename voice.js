// PrivyPilot Voice Assistant Module

class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = null;
        this.isListening = false;
        this.isSupported = false;
        this.currentLanguage = 'en-US';
        
        this.initializeVoiceServices();
        this.setupCommands();
    }
    
    initializeVoiceServices() {
        // Initialize Speech Recognition
        if ('speechRecognition' in window || 'webkitSpeechRecognition' in window) {
            this.recognition = new (window.speechRecognition || window.webkitSpeechRecognition)();
            this.setupRecognition();
            this.isSupported = true;
        }
        
        // Initialize Speech Synthesis
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
        }
        
        console.log('Voice services initialized:', {
            recognition: !!this.recognition,
            synthesis: !!this.synthesis
        });
    }
    
    setupRecognition() {
        if (!this.recognition) return;
        
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 3;
        this.recognition.lang = this.currentLanguage;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.onListeningStart();
            console.log('Voice recognition started');
        };
        
        this.recognition.onresult = (event) => {
            const results = Array.from(event.results);
            const transcript = results[0][0].transcript.trim();
            const confidence = results[0][0].confidence;
            
            console.log('Voice recognition result:', { transcript, confidence });
            this.handleVoiceCommand(transcript, confidence);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            this.isListening = false;
            this.onListeningEnd();
            this.handleVoiceError(event.error);
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.onListeningEnd();
            console.log('Voice recognition ended');
        };
    }
    
    setupCommands() {
        this.commands = {
            // Emergency commands
            emergency: {
                patterns: [
                    /emergency/i,
                    /help.*urgently?/i,
                    /need.*help.*now/i,
                    /bathroom.*emergency/i,
                    /washroom.*emergency/i,
                    /toilet.*emergency/i
                ],
                action: () => this.goToEmergency(),
                response: "Opening emergency assistance. Help is on the way!"
            },
            
            // Find washrooms
            findWashrooms: {
                patterns: [
                    /find.*washroom/i,
                    /find.*bathroom/i,
                    /find.*toilet/i,
                    /where.*washroom/i,
                    /where.*bathroom/i,
                    /where.*toilet/i,
                    /search.*washroom/i,
                    /locate.*washroom/i
                ],
                action: () => this.goToWashrooms(),
                response: "Finding nearby washrooms for you."
            },
            
            // Map view
            showMap: {
                patterns: [
                    /show.*map/i,
                    /open.*map/i,
                    /map.*view/i,
                    /where.*am.*i/i
                ],
                action: () => this.goToMap(),
                response: "Opening map view."
            },
            
            // Location
            getLocation: {
                patterns: [
                    /my.*location/i,
                    /where.*am.*i/i,
                    /current.*location/i,
                    /find.*my.*location/i
                ],
                action: () => this.getCurrentLocation(),
                response: "Getting your current location."
            },
            
            // Call van
            callVan: {
                patterns: [
                    /call.*van/i,
                    /emergency.*van/i,
                    /mobile.*washroom/i,
                    /dispatch.*van/i
                ],
                action: () => this.callEmergencyVan(),
                response: "Dispatching emergency van to your location."
            },
            
            // Navigate
            goHome: {
                patterns: [
                    /go.*home/i,
                    /home.*page/i,
                    /main.*page/i
                ],
                action: () => this.goHome(),
                response: "Going to home page."
            },
            
            // Profile
            myProfile: {
                patterns: [
                    /my.*profile/i,
                    /profile.*page/i,
                    /account.*settings/i
                ],
                action: () => this.goToProfile(),
                response: "Opening your profile."
            },
            
            // Hindi commands
            emergency_hindi: {
                patterns: [
                    /आपातकाल/i,
                    /मदद.*चाहिए/i,
                    /शौचालय.*जल्दी/i
                ],
                action: () => this.goToEmergency(),
                response: "आपातकालीन सहायता खोली जा रही है।"
            },
            
            findWashrooms_hindi: {
                patterns: [
                    /शौचालय.*खोजें/i,
                    /बाथरूम.*कहाँ/i,
                    /टॉयलेट.*कहाँ/i
                ],
                action: () => this.goToWashrooms(),
                response: "आस-पास के शौचालय खोजे जा रहे हैं।"
            }
        };
    }
    
    startListening() {
        if (!this.isSupported) {
            this.speak("Voice recognition is not supported in your browser.");
            return false;
        }
        
        if (this.isListening) {
            this.stopListening();
            return false;
        }
        
        try {
            this.recognition.lang = this.getCurrentLanguage();
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start voice recognition:', error);
            this.speak("Failed to start voice recognition. Please try again.");
            return false;
        }
    }
    
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    speak(text, options = {}) {
        if (!this.synthesis) {
            console.warn('Speech synthesis not supported');
            return;
        }
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate || 0.8;
        utterance.pitch = options.pitch || 1;
        utterance.volume = options.volume || 1;
        utterance.lang = options.lang || this.getCurrentLanguage();
        
        utterance.onstart = () => console.log('Speech started:', text);
        utterance.onend = () => console.log('Speech ended');
        utterance.onerror = (event) => console.error('Speech error:', event);
        
        this.synthesis.speak(utterance);
    }
    
    handleVoiceCommand(transcript, confidence = 1) {
        console.log('Processing voice command:', transcript);
        
        // Minimum confidence threshold
        if (confidence < 0.5) {
            this.speak("I didn't catch that clearly. Please try again.");
            return;
        }
        
        // Find matching command
        for (const [commandName, command] of Object.entries(this.commands)) {
            for (const pattern of command.patterns) {
                if (pattern.test(transcript)) {
                    console.log('Matched command:', commandName);
                    
                    try {
                        command.action();
                        this.speak(command.response);
                        return;
                    } catch (error) {
                        console.error('Command execution failed:', error);
                        this.speak("Sorry, I couldn't complete that action.");
                        return;
                    }
                }
            }
        }
        
        // No command matched
        this.handleUnknownCommand(transcript);
    }
    
    handleUnknownCommand(transcript) {
        const responses = [
            `I heard "${transcript}". You can say emergency, find washroom, show map, or call van.`,
            "I can help you with emergency assistance, finding washrooms, viewing the map, or calling an emergency van.",
            "Try saying 'emergency' for help, 'find washroom' to locate facilities, or 'show map' to see your location."
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.speak(response);
    }
    
    handleVoiceError(error) {
        let message;
        
        switch (error) {
            case 'no-speech':
                message = "I didn't hear anything. Please try again.";
                break;
            case 'audio-capture':
                message = "Microphone is not available. Please check your settings.";
                break;
            case 'not-allowed':
                message = "Microphone access is denied. Please enable microphone permissions.";
                break;
            case 'network':
                message = "Network error occurred. Please check your connection.";
                break;
            default:
                message = "Voice recognition error. Please try again.";
        }
        
        this.speak(message);
        
        if (window.PrivyPilot && window.PrivyPilot.showNotification) {
            window.PrivyPilot.showNotification(message, 'error');
        }
    }
    
    // Command actions
    goToEmergency() {
        window.location.href = '/emergency';
    }
    
    goToWashrooms() {
        const userLocation = this.getUserLocation();
        if (userLocation) {
            window.location.href = `/washrooms?lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
        } else {
            window.location.href = '/washrooms';
        }
    }
    
    goToMap() {
        window.location.href = '/map';
    }
    
    goHome() {
        window.location.href = '/';
    }
    
    goToProfile() {
        window.location.href = '/profile';
    }
    
    getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(4);
                    const lng = position.coords.longitude.toFixed(4);
                    this.speak(`Your location is latitude ${lat}, longitude ${lng}.`);
                },
                (error) => {
                    this.speak("Unable to get your location. Please enable GPS.");
                }
            );
        } else {
            this.speak("Geolocation is not supported by your browser.");
        }
    }
    
    callEmergencyVan() {
        const userLocation = this.getUserLocation();
        if (userLocation) {
            // Redirect to emergency page which will handle van dispatch
            window.location.href = '/emergency';
        } else {
            this.speak("Location is required to dispatch emergency van. Please enable GPS.");
        }
    }
    
    // Utility methods
    getCurrentLanguage() {
        // Try to get from user profile or default to browser language
        const userLang = document.documentElement.lang || navigator.language;
        
        if (userLang.startsWith('hi')) {
            return 'hi-IN';
        }
        return 'en-US';
    }
    
    setLanguage(language) {
        this.currentLanguage = language;
        if (this.recognition) {
            this.recognition.lang = language;
        }
    }
    
    getUserLocation() {
        if (window.PrivyPilot && window.PrivyPilot.userLocation) {
            return window.PrivyPilot.userLocation();
        }
        
        // Try session storage
        const lat = sessionStorage.getItem('userLat');
        const lng = sessionStorage.getItem('userLng');
        
        if (lat && lng) {
            return {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng)
            };
        }
        
        return null;
    }
    
    // Event handlers (to be overridden)
    onListeningStart() {
        // Update UI to show listening state
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="bi bi-mic-fill"></i> Listening...';
            voiceBtn.classList.remove('btn-outline-success');
            voiceBtn.classList.add('btn-success', 'voice-recording');
        }
        
        // Show visual feedback
        this.showListeningFeedback();
    }
    
    onListeningEnd() {
        // Update UI to show idle state
        const voiceBtn = document.getElementById('voice-btn');
        if (voiceBtn) {
            voiceBtn.innerHTML = '<i class="bi bi-mic"></i> Speak';
            voiceBtn.classList.remove('btn-success', 'voice-recording');
            voiceBtn.classList.add('btn-outline-success');
        }
        
        // Hide visual feedback
        this.hideListeningFeedback();
    }
    
    showListeningFeedback() {
        // Add visual listening indicator
        const indicator = document.createElement('div');
        indicator.id = 'voice-listening-indicator';
        indicator.className = 'position-fixed top-50 start-50 translate-middle bg-success text-white p-3 rounded-circle shadow-lg';
        indicator.style.zIndex = '9999';
        indicator.innerHTML = '<i class="bi bi-mic-fill fs-2"></i>';
        
        document.body.appendChild(indicator);
        
        // Add pulsing animation
        indicator.style.animation = 'voicePulse 1s ease-in-out infinite';
    }
    
    hideListeningFeedback() {
        const indicator = document.getElementById('voice-listening-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Public API
    toggle() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    isListeningActive() {
        return this.isListening;
    }
    
    isSupportedBrowser() {
        return this.isSupported;
    }
}

// Global voice assistant instance
let voiceAssistant = null;

// Initialize voice assistant
function initializeVoiceAssistant() {
    if (!voiceAssistant) {
        voiceAssistant = new VoiceAssistant();
    }
    return voiceAssistant;
}

// Global functions for backward compatibility
function toggleVoiceInput() {
    if (!voiceAssistant) {
        voiceAssistant = initializeVoiceAssistant();
    }
    
    voiceAssistant.toggle();
}

function speakText(text, options = {}) {
    if (!voiceAssistant) {
        voiceAssistant = initializeVoiceAssistant();
    }
    
    voiceAssistant.speak(text, options);
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeVoiceAssistant();
});

// Export for use in other modules
window.VoiceAssistant = VoiceAssistant;
window.voiceAssistant = voiceAssistant;
window.toggleVoiceInput = toggleVoiceInput;
window.speakText = speakText;
