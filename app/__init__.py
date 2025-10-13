from flask import Flask
from flask_cors import CORS
from .config import load_config
from .models import db, init_db
from .mqtt_worker import start_mqtt_worker
from .summarizer import init_scheduler
from .api import api_bp
from .web import web_bp

def create_app():
    app = Flask(__name__, static_folder="static", template_folder="web/templates")
    CORS(app)
    load_config(app)
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", app.config.get("DATABASE_URL"))
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    db.init_app(app)
    with app.app_context():
        init_db()

    app.register_blueprint(api_bp, url_prefix="/api")
    app.register_blueprint(web_bp)

    # start background services
    start_mqtt_worker(app)          # Paho MQTT subscriber in a daemon thread
    init_scheduler(app)             # APScheduler jobs (daily summaries, alarms)

    return app