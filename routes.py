import os
import json
import requests
from flask import render_template, request, redirect, url_for, flash, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
from app import app, db
from models import User, Washroom, Amenity, Review, EmergencyRequest, VanTracking
from utils import get_distance, analyze_image_with_blip, get_ai_suggestion
import logging
from datetime import datetime, timedelta
import math
import random

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        else:
            flash('Invalid email or password', 'error')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        name = request.form['name']
        gender = request.form['gender']
        language = request.form.get('language', 'en')
        
        # Check if user exists
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
            return render_template('register.html')
        
        if User.query.filter_by(username=username).first():
            flash('Username already taken', 'error')
            return render_template('register.html')
        
        # Create new user
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            name=name,
            gender=gender,
            language=language
        )
        
        db.session.add(user)
        db.session.commit()
        
        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        current_user.name = request.form['name']
        current_user.gender = request.form['gender']
        current_user.language = request.form['language']
        
        if request.form['new_password']:
            current_user.password_hash = generate_password_hash(request.form['new_password'])
        
        db.session.commit()
        flash('Profile updated successfully', 'success')
    
    return render_template('profile.html')

@app.route('/map')
@login_required
def map():
    return render_template('map.html')

@app.route('/washrooms')
@login_required
def washrooms():
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    
    # Get filters
    seat_type = request.args.get('seat_type')
    has_toilet_paper = request.args.get('toilet_paper') == 'true'
    has_baby_changing = request.args.get('baby_changing') == 'true'
    has_sanitary_napkins = request.args.get('sanitary_napkins') == 'true'
    has_charging_point = request.args.get('charging_point') == 'true'
    is_wheelchair_accessible = request.args.get('wheelchair_accessible') == 'true'
    is_paid = request.args.get('paid')
    min_cleanliness = request.args.get('min_cleanliness', type=float)
    
    # Base query
    query = db.session.query(Washroom).join(Amenity)
    
    # Apply filters
    if seat_type == 'indian':
        query = query.filter(Amenity.has_indian_seat == True)
    elif seat_type == 'western':
        query = query.filter(Amenity.has_western_seat == True)
    
    if has_toilet_paper:
        query = query.filter(Amenity.has_toilet_paper == True)
    if has_baby_changing:
        query = query.filter(Amenity.has_baby_changing == True)
    if has_sanitary_napkins:
        query = query.filter(Amenity.has_sanitary_napkins == True)
    if has_charging_point:
        query = query.filter(Amenity.has_charging_point == True)
    if is_wheelchair_accessible:
        query = query.filter(Amenity.is_wheelchair_accessible == True)
    
    if is_paid == 'free':
        query = query.filter(Washroom.is_paid == False)
    elif is_paid == 'paid':
        query = query.filter(Washroom.is_paid == True)
    
    if min_cleanliness:
        query = query.filter(Washroom.cleanliness_score >= min_cleanliness)
    
    washrooms = query.all()
    
    # Calculate distances if location provided
    if lat and lng:
        for washroom in washrooms:
            washroom.distance = get_distance(lat, lng, washroom.latitude, washroom.longitude)
        washrooms.sort(key=lambda x: x.distance)
    
    return render_template('washrooms.html', washrooms=washrooms, user_lat=lat, user_lng=lng)

@app.route('/emergency', methods=['GET', 'POST'])
@login_required
def emergency():
    if request.method == 'POST':
        lat = float(request.form['latitude'])
        lng = float(request.form['longitude'])
        
        # Handle image upload/capture
        image_description = ""
        if 'image' in request.files:
            image = request.files['image']
            if image.filename:
                try:
                    # Analyze image with BLIP
                    image_description = analyze_image_with_blip(image)
                except Exception as e:
                    logging.error(f"Image analysis failed: {e}")
                    image_description = "Unable to analyze image"
        
        # Get AI suggestion
        ai_suggestion = get_ai_suggestion(
            image_description=image_description,
            latitude=lat,
            longitude=lng,
            user_profile={
                'name': current_user.name,
                'gender': current_user.gender,
                'language': current_user.language
            }
        )
        
        # Create emergency request
        emergency_request = EmergencyRequest(
            user_id=current_user.id,
            latitude=lat,
            longitude=lng,
            image_description=image_description,
            ai_suggestion=ai_suggestion
        )
        
        db.session.add(emergency_request)
        db.session.commit()
        
        # Create van tracking entry
        van_tracking = VanTracking(
            emergency_request_id=emergency_request.id,
            current_latitude=lat + random.uniform(-0.01, 0.01),  # Start nearby
            current_longitude=lng + random.uniform(-0.01, 0.01),
            destination_latitude=lat,
            destination_longitude=lng,
            eta_minutes=random.randint(5, 15)
        )
        
        db.session.add(van_tracking)
        db.session.commit()
        
        flash('Emergency request submitted successfully!', 'success')
        return redirect(url_for('van_tracking', request_id=emergency_request.id))
    
    return render_template('emergency.html')

@app.route('/van_tracking/<int:request_id>')
@login_required
def van_tracking(request_id):
    emergency_request = EmergencyRequest.query.get_or_404(request_id)
    van_tracking = VanTracking.query.filter_by(emergency_request_id=request_id).first()
    
    if not van_tracking:
        flash('Van tracking not found', 'error')
        return redirect(url_for('emergency'))
    
    return render_template('van_tracking.html', 
                         emergency_request=emergency_request, 
                         van_tracking=van_tracking)

@app.route('/api/van_location/<int:request_id>')
@login_required
def get_van_location(request_id):
    van_tracking = VanTracking.query.filter_by(emergency_request_id=request_id).first()
    
    if not van_tracking:
        return jsonify({'error': 'Van tracking not found'}), 404
    
    # Simulate van movement
    current_time = datetime.utcnow()
    time_diff = (current_time - van_tracking.last_updated).total_seconds() / 60  # minutes
    
    if time_diff > 0.5:  # Update every 30 seconds
        # Move van closer to destination
        lat_diff = van_tracking.destination_latitude - van_tracking.current_latitude
        lng_diff = van_tracking.destination_longitude - van_tracking.current_longitude
        
        # Move 10% closer each update
        move_factor = 0.1
        van_tracking.current_latitude += lat_diff * move_factor
        van_tracking.current_longitude += lng_diff * move_factor
        
        # Update ETA
        distance = get_distance(
            van_tracking.current_latitude, van_tracking.current_longitude,
            van_tracking.destination_latitude, van_tracking.destination_longitude
        )
        van_tracking.eta_minutes = max(1, int(distance * 2))  # Rough estimate: 2 min per km
        
        # Check if arrived
        if distance < 0.1:  # Less than 100 meters
            van_tracking.status = 'arrived'
            van_tracking.eta_minutes = 0
        
        van_tracking.last_updated = current_time
        db.session.commit()
    
    return jsonify({
        'latitude': van_tracking.current_latitude,
        'longitude': van_tracking.current_longitude,
        'eta_minutes': van_tracking.eta_minutes,
        'status': van_tracking.status
    })

@app.route('/reviews/<int:washroom_id>', methods=['GET', 'POST'])
@login_required
def reviews(washroom_id):
    washroom = Washroom.query.get_or_404(washroom_id)
    
    if request.method == 'POST':
        rating = int(request.form['rating'])
        comment = request.form['comment']
        
        # Check if user already reviewed this washroom
        existing_review = Review.query.filter_by(
            user_id=current_user.id, 
            washroom_id=washroom_id
        ).first()
        
        if existing_review:
            existing_review.rating = rating
            existing_review.comment = comment
        else:
            review = Review(
                user_id=current_user.id,
                washroom_id=washroom_id,
                rating=rating,
                comment=comment
            )
            db.session.add(review)
        
        # Update washroom's cleanliness score
        all_reviews = Review.query.filter_by(washroom_id=washroom_id).all()
        if all_reviews:
            avg_rating = sum(r.rating for r in all_reviews) / len(all_reviews)
            washroom.cleanliness_score = round(avg_rating, 1)
        
        db.session.commit()
        flash('Review submitted successfully!', 'success')
        return redirect(url_for('reviews', washroom_id=washroom_id))
    
    reviews = Review.query.filter_by(washroom_id=washroom_id).order_by(Review.created_at.desc()).all()
    user_review = Review.query.filter_by(user_id=current_user.id, washroom_id=washroom_id).first()
    
    return render_template('reviews.html', washroom=washroom, reviews=reviews, user_review=user_review)

@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('index'))
    
    users = User.query.all()
    washrooms = Washroom.query.all()
    reviews = Review.query.order_by(Review.created_at.desc()).limit(50).all()
    emergency_requests = EmergencyRequest.query.order_by(EmergencyRequest.created_at.desc()).limit(50).all()
    
    return render_template('admin.html', 
                         users=users, 
                         washrooms=washrooms, 
                         reviews=reviews,
                         emergency_requests=emergency_requests)

@app.route('/admin/delete_user/<int:user_id>')
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('index'))
    
    user = User.query.get_or_404(user_id)
    if user.is_admin:
        flash('Cannot delete admin user', 'error')
    else:
        db.session.delete(user)
        db.session.commit()
        flash('User deleted successfully', 'success')
    
    return redirect(url_for('admin'))

@app.route('/admin/delete_washroom/<int:washroom_id>')
@login_required
def delete_washroom(washroom_id):
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('index'))
    
    washroom = Washroom.query.get_or_404(washroom_id)
    db.session.delete(washroom)
    db.session.commit()
    flash('Washroom deleted successfully', 'success')
    
    return redirect(url_for('admin'))

@app.route('/admin/delete_review/<int:review_id>')
@login_required
def delete_review(review_id):
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('index'))
    
    review = Review.query.get_or_404(review_id)
    db.session.delete(review)
    db.session.commit()
    flash('Review deleted successfully', 'success')
    
    return redirect(url_for('admin'))
