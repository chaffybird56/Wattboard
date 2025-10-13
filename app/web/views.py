from flask import render_template, Blueprint
web_bp = Blueprint("web", __name__, template_folder="templates")

@web_bp.get("/")
def index():
    return render_template("index.html", title="Home Energy Monitoring")