// PrivyPilot Camera Module

class CameraManager {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.isActive = false;
        this.constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment' // Use back camera on mobile
            },
            audio: false
        };
        
        this.setupElements();
    }
    
    setupElements() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        
        if (!this.video || !this.canvas) {
            console.warn('Camera elements not found. Camera functionality may be limited.');
        }
    }
    
    async startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported in this browser');
        }
        
        if (this.isActive) {
            console.log('Camera is already active');
            return;
        }
        
        try {
            // Show camera preview area
            this.showCameraPreview();
            
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            
            if (this.video) {
                this.video.srcObject = this.stream;
                this.video.play();
            }
            
            this.isActive = true;
            this.updateCameraUI(true);
            
            console.log('Camera started successfully');
            
            if (window.PrivyPilot && window.PrivyPilot.showNotification) {
                window.PrivyPilot.showNotification('Camera activated', 'success');
            }
            
        } catch (error) {
            console.error('Failed to start camera:', error);
            this.handleCameraError(error);
            throw error;
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
        
        this.isActive = false;
        this.hideCameraPreview();
        this.updateCameraUI(false);
        
        console.log('Camera stopped');
    }
    
    capturePhoto() {
        if (!this.isActive || !this.video || !this.canvas) {
            throw new Error('Camera not active or elements not available');
        }
        
        const context = this.canvas.getContext('2d');
        
        // Set canvas size to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to blob
        return new Promise((resolve, reject) => {
            this.canvas.toBlob((blob) => {
                if (blob) {
                    // Show captured image preview
                    this.showCapturedImage(this.canvas.toDataURL());
                    
                    // Create file object
                    const file = new File([blob], 'camera-capture.jpg', {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    
                    resolve(file);
                } else {
                    reject(new Error('Failed to capture image'));
                }
            }, 'image/jpeg', 0.8);
        });
    }
    
    showCameraPreview() {
        const uploadArea = document.getElementById('upload-area');
        const cameraPreview = document.getElementById('camera-preview');
        const cameraControls = document.getElementById('camera-controls');
        
        if (uploadArea) uploadArea.style.display = 'none';
        if (cameraPreview) cameraPreview.style.display = 'block';
        if (cameraControls) cameraControls.style.display = 'block';
    }
    
    hideCameraPreview() {
        const uploadArea = document.getElementById('upload-area');
        const cameraPreview = document.getElementById('camera-preview');
        const cameraControls = document.getElementById('camera-controls');
        
        if (uploadArea) uploadArea.style.display = 'block';
        if (cameraPreview) cameraPreview.style.display = 'none';
        if (cameraControls) cameraControls.style.display = 'none';
    }
    
    showCapturedImage(dataUrl) {
        const uploadArea = document.getElementById('upload-area');
        const cameraPreview = document.getElementById('camera-preview');
        const imagePreview = document.getElementById('image-preview');
        const previewImg = document.getElementById('preview-img');
        
        if (uploadArea) uploadArea.style.display = 'none';
        if (cameraPreview) cameraPreview.style.display = 'none';
        if (imagePreview) imagePreview.style.display = 'block';
        if (previewImg) previewImg.src = dataUrl;
        
        // Stop camera after capture
        this.stopCamera();
    }
    
    updateCameraUI(isActive) {
        // Update any UI elements that show camera state
        const cameraBtn = document.querySelector('button[onclick="startCamera()"]');
        if (cameraBtn) {
            if (isActive) {
                cameraBtn.innerHTML = '<i class="bi bi-camera-fill"></i> Camera Active';
                cameraBtn.classList.add('btn-success');
                cameraBtn.classList.remove('btn-primary');
            } else {
                cameraBtn.innerHTML = '<i class="bi bi-camera"></i> Take Photo';
                cameraBtn.classList.add('btn-primary');
                cameraBtn.classList.remove('btn-success');
            }
        }
    }
    
    handleCameraError(error) {
        let message;
        
        if (error.name === 'NotAllowedError') {
            message = 'Camera access denied. Please enable camera permissions and try again.';
        } else if (error.name === 'NotFoundError') {
            message = 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
            message = 'Camera is not supported in this browser.';
        } else if (error.name === 'NotReadableError') {
            message = 'Camera is being used by another application.';
        } else {
            message = 'Camera error: ' + error.message;
        }
        
        console.error('Camera error:', error);
        
        if (window.PrivyPilot && window.PrivyPilot.showNotification) {
            window.PrivyPilot.showNotification(message, 'error');
        }
        
        this.stopCamera();
    }
    
    // Switch between front and back camera (mobile)
    async switchCamera() {
        if (!this.isActive) {
            return;
        }
        
        // Toggle facing mode
        const currentFacingMode = this.constraints.video.facingMode;
        this.constraints.video.facingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        
        // Restart camera with new constraints
        this.stopCamera();
        await this.startCamera();
    }
    
    // Get available cameras
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            return [];
        }
    }
    
    // Take photo with specific camera
    async takePhotoWithCamera(deviceId) {
        const originalConstraints = { ...this.constraints };
        
        try {
            this.constraints.video.deviceId = deviceId;
            await this.startCamera();
            const photo = await this.capturePhoto();
            return photo;
        } finally {
            this.constraints = originalConstraints;
        }
    }
    
    // Create file input simulation for captured photos
    createFileInput(file) {
        const fileInput = document.querySelector('input[type="file"][accept*="image"]');
        if (fileInput) {
            // Create a new FileList containing our captured file
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    }
    
    // Utility methods
    isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    
    isCameraActive() {
        return this.isActive;
    }
    
    hasPermission() {
        if (!navigator.permissions) {
            return Promise.resolve('granted'); // Assume granted if API not available
        }
        
        return navigator.permissions.query({ name: 'camera' })
            .then(result => result.state);
    }
}

// Global camera manager instance
let cameraManager = null;

// Initialize camera manager
function initializeCameraManager() {
    if (!cameraManager) {
        cameraManager = new CameraManager();
    }
    return cameraManager;
}

// Global functions for backward compatibility
async function startCamera() {
    if (!cameraManager) {
        cameraManager = initializeCameraManager();
    }
    
    try {
        await cameraManager.startCamera();
    } catch (error) {
        console.error('Failed to start camera:', error);
    }
}

function stopCamera() {
    if (cameraManager) {
        cameraManager.stopCamera();
    }
}

async function capturePhoto() {
    if (!cameraManager) {
        throw new Error('Camera not initialized');
    }
    
    try {
        const file = await cameraManager.capturePhoto();
        
        // Automatically add to file input if available
        cameraManager.createFileInput(file);
        
        if (window.PrivyPilot && window.PrivyPilot.showNotification) {
            window.PrivyPilot.showNotification('Photo captured successfully!', 'success');
        }
        
        return file;
    } catch (error) {
        console.error('Failed to capture photo:', error);
        
        if (window.PrivyPilot && window.PrivyPilot.showNotification) {
            window.PrivyPilot.showNotification('Failed to capture photo', 'error');
        }
        
        throw error;
    }
}

async function switchCamera() {
    if (cameraManager) {
        await cameraManager.switchCamera();
    }
}

// File preview function for uploaded images
function previewFile(input) {
    const file = input.files[0];
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('File size too large. Please select an image smaller than 10MB.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const uploadArea = document.getElementById('upload-area');
            const imagePreview = document.getElementById('image-preview');
            const previewImg = document.getElementById('preview-img');
            
            if (uploadArea) uploadArea.style.display = 'none';
            if (imagePreview) imagePreview.style.display = 'block';
            if (previewImg) previewImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Reset image selection
function resetImageSelection() {
    const uploadArea = document.getElementById('upload-area');
    const imagePreview = document.getElementById('image-preview');
    const cameraPreview = document.getElementById('camera-preview');
    const fileInput = document.querySelector('input[type="file"][accept*="image"]');
    
    if (uploadArea) uploadArea.style.display = 'block';
    if (imagePreview) imagePreview.style.display = 'none';
    if (cameraPreview) cameraPreview.style.display = 'none';
    if (fileInput) fileInput.value = '';
    
    // Stop camera if active
    if (cameraManager && cameraManager.isCameraActive()) {
        cameraManager.stopCamera();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeCameraManager();
    
    // Add drag and drop support
    setupDragAndDrop();
});

// Drag and drop functionality
function setupDragAndDrop() {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });
    
    uploadArea.addEventListener('drop', handleDrop, false);
    
    function highlight() {
        uploadArea.classList.add('border-primary', 'bg-light');
    }
    
    function unhighlight() {
        uploadArea.classList.remove('border-primary', 'bg-light');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                // Simulate file input
                const fileInput = document.querySelector('input[type="file"][accept*="image"]');
                if (fileInput) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    
                    // Trigger preview
                    previewFile(fileInput);
                }
            } else {
                alert('Please drop an image file.');
            }
        }
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
window.cameraManager = cameraManager;
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.capturePhoto = capturePhoto;
window.switchCamera = switchCamera;
window.previewFile = previewFile;
window.resetImageSelection = resetImageSelection;
