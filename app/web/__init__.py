from flask import Blueprint
web_bp = Blueprint("web", __name__)
from .views import *  # noqa: F401,E402