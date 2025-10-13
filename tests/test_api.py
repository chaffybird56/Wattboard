from app import create_app

def test_health():
    app = create_app()
    c = app.test_client()
    r = c.get("/api/daily")
    assert r.status_code == 200