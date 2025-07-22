from app import db, Base
from flask_login import UserMixin
from datetime import datetime

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.String(20), nullable=False)
    language = db.Column(db.String(10), default='en')
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    reviews = db.relationship('Review', backref='user', lazy=True)
    emergency_requests = db.relationship('EmergencyRequest', backref='user', lazy=True)

class Washroom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    address = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False)  # mall, cafe, petrol_pump, restaurant, govt
    is_paid = db.Column(db.Boolean, default=False)
    cleanliness_score = db.Column(db.Float, default=3.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    amenities = db.relationship('Amenity', backref='washroom', lazy=True, uselist=False)
    reviews = db.relationship('Review', backref='washroom', lazy=True)

class Amenity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    washroom_id = db.Column(db.Integer, db.ForeignKey('washroom.id'), nullable=False)
    has_indian_seat = db.Column(db.Boolean, default=False)
    has_western_seat = db.Column(db.Boolean, default=False)
    has_toilet_paper = db.Column(db.Boolean, default=False)
    has_baby_changing = db.Column(db.Boolean, default=False)
    has_sanitary_napkins = db.Column(db.Boolean, default=False)
    has_charging_point = db.Column(db.Boolean, default=False)
    is_wheelchair_accessible = db.Column(db.Boolean, default=False)

class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    washroom_id = db.Column(db.Integer, db.ForeignKey('washroom.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class EmergencyRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    image_description = db.Column(db.Text)
    ai_suggestion = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')  # active, resolved
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class VanTracking(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    emergency_request_id = db.Column(db.Integer, db.ForeignKey('emergency_request.id'), nullable=False)
    current_latitude = db.Column(db.Float, nullable=False)
    current_longitude = db.Column(db.Float, nullable=False)
    destination_latitude = db.Column(db.Float, nullable=False)
    destination_longitude = db.Column(db.Float, nullable=False)
    eta_minutes = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='dispatched')  # dispatched, en_route, arrived
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
