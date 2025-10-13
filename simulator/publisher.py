import os, json, random, time
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
PORT   = int(os.getenv("MQTT_BROKER_PORT", "1883"))
METER_IDS = ["MTR-1001", "MTR-1002", "MTR-2303"]
FEEDER = "FDR-12"

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect(BROKER, PORT)

while True:
    base_kw = 1200 + 800 * (0.5 + 0.5*random.random())
    for i, mid in enumerate(METER_IDS):
        ts = datetime.now(timezone.utc).isoformat()
        kw = base_kw/len(METER_IDS) * (0.9 + 0.2*random.random())
        volts = 416 + random.uniform(-4, 4)
        hertz = 60 + random.uniform(-0.03, 0.03)
        payload = {
            "ts": ts, "kw": round(kw,2), "kvar": round(kw*0.35,2),
            "volts": round(volts,2), "hertz": round(hertz,3),
            "voltage_level": "MV" if i==0 else "LV", "feeder": FEEDER
        }
        topic = f"utility/meter/{mid}/reading"
        client.publish(topic, json.dumps(payload), qos=1)
        print("->", topic, payload)
    time.sleep(5)