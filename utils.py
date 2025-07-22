import math
import requests
import os
import base64
from io import BytesIO
from PIL import Image

def get_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) * math.sin(delta_lat / 2) +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lon / 2) * math.sin(delta_lon / 2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    
    return distance

def analyze_image_with_blip(image_file):
    """Analyze image using Hugging Face BLIP model"""
    try:
        # Convert image to base64
        image = Image.open(image_file.stream)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize image if too large
        if image.size[0] > 512 or image.size[1] > 512:
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        
        # Convert to base64
        buffer = BytesIO()
        image.save(buffer, format='JPEG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        # Use Hugging Face Inference API
        API_URL = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
        headers = {"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY', 'hf_demo_key')}"}
        
        # Send request to Hugging Face
        response = requests.post(
            API_URL,
            headers=headers,
            json={"inputs": img_str},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0].get('generated_text', 'Unable to describe image')
            else:
                return 'Unable to describe image'
        else:
            print(f"BLIP API Error: {response.status_code} - {response.text}")
            return 'Unable to analyze image - API error'
            
    except Exception as e:
        print(f"Image analysis error: {e}")
        return 'Unable to analyze image - processing error'

def get_ai_suggestion(image_description, latitude, longitude, user_profile):
    """Get AI suggestion using local LLM (Ollama)"""
    try:
        # Try to use Ollama first
        ollama_url = "http://localhost:11434/api/generate"
        
        prompt = f"""
        Emergency washroom assistance request:
        
        User Profile:
        - Name: {user_profile['name']}
        - Gender: {user_profile['gender']}
        - Language: {user_profile['language']}
        
        Location: {latitude}, {longitude}
        
        Scene Description: {image_description}
        
        Please provide emergency assistance suggestions for finding appropriate washroom facilities. Consider:
        1. Safety and privacy concerns
        2. Nearest available options
        3. Gender-appropriate facilities
        4. Emergency protocols if no facilities are nearby
        5. Health and hygiene considerations
        
        Provide practical, immediate advice in a helpful tone.
        """
        
        payload = {
            "model": "llama3:latest",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 300
            }
        }
        
        response = requests.post(ollama_url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result.get('response', get_fallback_suggestion(image_description, user_profile))
        else:
            print(f"Ollama error: {response.status_code}")
            return get_fallback_suggestion(image_description, user_profile)
            
    except Exception as e:
        print(f"AI suggestion error: {e}")
        return get_fallback_suggestion(image_description, user_profile)

def get_fallback_suggestion(image_description, user_profile):
    """Provide fallback suggestions when AI is not available"""
    suggestions = []
    
    # Base suggestion
    suggestions.append("🚨 Emergency washroom assistance activated!")
    
    # Gender-specific advice
    if user_profile['gender'] == 'female':
        suggestions.append("👩 Looking for female-friendly facilities with proper privacy and safety.")
    elif user_profile['gender'] == 'male':
        suggestions.append("👨 Searching for male washroom facilities in your vicinity.")
    
    # Location-based advice
    suggestions.append("📍 Based on your location, I recommend:")
    suggestions.append("• Check nearby malls, cafes, or restaurants")
    suggestions.append("• Look for petrol pumps with customer facilities")
    suggestions.append("• Consider government buildings or public facilities")
    
    # Image-based advice
    if 'outdoor' in image_description.lower() or 'tree' in image_description.lower() or 'forest' in image_description.lower():
        suggestions.append("🌳 You appear to be outdoors. Safety tips:")
        suggestions.append("• Ensure privacy and safety first")
        suggestions.append("• Avoid areas near water sources")
        suggestions.append("• Choose locations away from paths")
        suggestions.append("• Be mindful of plants that might cause irritation")
    
    # Emergency van suggestion
    suggestions.append("🚐 Emergency mobile washroom van has been dispatched!")
    suggestions.append("📱 Track van location in real-time on the map.")
    
    # Language consideration
    if user_profile['language'] == 'hi':
        suggestions.append("💬 हिंदी में सहायता के लिए वॉइस असिस्टेंट का उपयोग करें।")
    
    return "\n".join(suggestions)

def translate_text(text, target_language):
    """Simple translation helper (can be expanded with proper translation API)"""
    if target_language == 'hi':
        # Basic Hindi translations for common phrases
        translations = {
            'Find Washrooms': 'शौचालय खोजें',
            'Emergency Help': 'आपातकालीन सहायता',
            'Track Van': 'वैन ट्रैक करें',
            'My Profile': 'मेरी प्रोफ़ाइल',
            'Reviews': 'समीक्षाएं',
            'Login': 'लॉगिन',
            'Register': 'रजिस्टर करें',
            'Logout': 'लॉगआउट',
            'Submit': 'जमा करें',
            'Cancel': 'रद्द करें',
            'Search': 'खोजें',
            'Filter': 'फ़िल्टर',
            'Distance': 'दूरी',
            'Rating': 'रेटिंग',
            'Clean': 'साफ',
            'Paid': 'भुगतान',
            'Free': 'मुफ्त',
            'Male': 'पुरुष',
            'Female': 'महिला',
            'Other': 'अन्य'
        }
        return translations.get(text, text)
    return text
