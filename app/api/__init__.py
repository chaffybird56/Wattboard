from flask import Blueprint
api_bp = Blueprint("api", __name__)
from .routes import *  # noqa: F401,E402