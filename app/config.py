import os, yaml
from dotenv import load_dotenv

def load_config(app):
    load_dotenv()
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev")
    app.config["DATABASE_URL"] = os.getenv("DATABASE_URL", "sqlite:///energy.db")
    app.config["MQTT_BROKER_HOST"] = os.getenv("MQTT_BROKER_HOST", "localhost")
    app.config["MQTT_BROKER_PORT"] = int(os.getenv("MQTT_BROKER_PORT", "1883"))
    app.config["MQTT_TOPICS"] = os.getenv("MQTT_TOPICS", "utility/meter/+/reading")
    app.config["TIMEZONE"] = os.getenv("TIMEZONE", "UTC")

    app_cfg_path = os.path.join("config", "app.example.yml")
    if os.path.exists(app_cfg_path):
        with open(app_cfg_path, "r") as f:
            data = yaml.safe_load(f) or {}
            if isinstance(data, dict):
                for k,v in data.items():
                    app.config[k] = v

    alarms_cfg_path = os.path.join("config", "alarms.yml")
    if os.path.exists(alarms_cfg_path):
        with open(alarms_cfg_path, "r") as f:
            app.config["ALARMS"] = (yaml.safe_load(f) or {}).get("alarms", [])
    else:
        app.config["ALARMS"] = []