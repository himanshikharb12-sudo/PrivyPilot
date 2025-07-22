import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()

# create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# configure logging
logging.basicConfig(level=logging.DEBUG)

# configure the database
database_path = "/mnt/data/privypilot.db"
os.makedirs(os.path.dirname(database_path), exist_ok=True)
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{database_path}"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# initialize extensions
db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

with app.app_context():
    # Import models to ensure tables are created
    import models
    
    # Import routes
    import routes
    
    # Create all tables
    db.create_all()
    
    # Create sample data if needed
    from models import User, Washroom, Amenity
    from werkzeug.security import generate_password_hash
    
    # Create admin user if doesn't exist
    admin = User.query.filter_by(email='admin@privypilot.com').first()
    if not admin:
        admin = User(
            username='admin',
            email='admin@privypilot.com',
            password_hash=generate_password_hash('admin123'),
            name='Administrator',
            gender='other',
            language='en',
            is_admin=True
        )
        db.session.add(admin)
        
    # Create sample washrooms if table is empty
    if Washroom.query.count() == 0:
        sample_washrooms = [
            {
                'name': 'Central Mall Restroom',
                'latitude': 28.6139,
                'longitude': 77.2090,
                'address': 'Connaught Place, New Delhi',
                'type': 'mall',
                'is_paid': False,
                'cleanliness_score': 4.2
            },
            {
                'name': 'Coffee Shop Washroom',
                'latitude': 28.6129,
                'longitude': 77.2295,
                'address': 'Khan Market, New Delhi',
                'type': 'cafe',
                'is_paid': False,
                'cleanliness_score': 3.8
            },
            {
                'name': 'Petrol Pump Facility',
                'latitude': 28.6200,
                'longitude': 77.2100,
                'address': 'Ring Road, New Delhi',
                'type': 'petrol_pump',
                'is_paid': True,
                'cleanliness_score': 3.5
            }
        ]
        
        for washroom_data in sample_washrooms:
            washroom = Washroom(**washroom_data)
            db.session.add(washroom)
    
    # Create sample amenities if table is empty
    if Amenity.query.count() == 0:
        washrooms = Washroom.query.all()
        for washroom in washrooms:
            # Add random amenities
            amenity = Amenity(
                washroom_id=washroom.id,
                has_indian_seat=True,
                has_western_seat=True,
                has_toilet_paper=True,
                has_baby_changing=False,
                has_sanitary_napkins=True,
                has_charging_point=True,
                is_wheelchair_accessible=False
            )
            db.session.add(amenity)
    
    db.session.commit()

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))
