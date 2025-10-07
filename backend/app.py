import os
import datetime
from typing import Dict, Any

from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
from dotenv import load_dotenv

# Optional Google verification
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests


load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv("CORS_ORIGIN", "*")}})


# =======================
# In-memory user store (for demo only)
# =======================
users_by_email: Dict[str, Dict[str, Any]] = {}


def create_token(user: Dict[str, Any]) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    return jwt.encode(payload, os.getenv("JWT_SECRET", "dev_secret"), algorithm="HS256")


def next_user_id() -> int:
    return len(users_by_email) + 1


@app.get("/")
def root():
    return jsonify({
        "status": "ok",
        "message": "Minimal SmartExpense API running",
        "endpoints": [
            "POST /api/auth/register",
            "POST /api/auth/login",
            "POST /api/auth/google",
            "GET /api/me",
        ],
    })


@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "")

    if not name or not email or len(password) < 6:
        return jsonify({"message": "Thiếu dữ liệu hoặc mật khẩu quá ngắn"}), 400

    if email in users_by_email:
        return jsonify({"message": "Email đã tồn tại"}), 409

    user = {
        "id": next_user_id(),
        "name": name,
        "email": email,
        # For demo only: store plain password. DO NOT DO THIS IN PRODUCTION
        "password": password,
        "role": "user",
    }
    users_by_email[email] = user

    # Minimal API: do not auto-login on signup per requirement
    return jsonify({"user": {"id": user["id"], "name": name, "email": email}}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"message": "Thiếu email/password"}), 400

    user = users_by_email.get(email)
    if not user or user.get("password") != password:
        return jsonify({"message": "Email hoặc mật khẩu không đúng"}), 401

    token = create_token(user)
    return jsonify({
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user.get("role", "user")},
        "token": token,
    })


@app.post("/api/auth/google")
def google_login():
    data = request.get_json(silent=True) or {}
    id_token_str = data.get("credential") or data.get("idToken")
    if not id_token_str:
        return jsonify({"message": "Thiếu idToken"}), 400

    client_id = os.getenv("60974853277-a0jg39ps7b4too995e58rvmehte0e16a.apps.googleusercontent.com", "")
    try:
        req = google_requests.Request()
        idinfo = google_id_token.verify_oauth2_token(id_token_str, req, audience=(client_id or None))

        if client_id and idinfo.get("aud") != client_id:
            return jsonify({"message": "ID token không đúng client"}), 401

        email = (idinfo.get("email") or "").lower()
        name = idinfo.get("name") or (email.split("@")[0] if email else "Người dùng")
        if not email:
            return jsonify({"message": "Không lấy được email từ Google"}), 400

        user = users_by_email.get(email)
        if not user:
            user = {
                "id": next_user_id(),
                "name": name,
                "email": email,
                "role": "user",
            }
            users_by_email[email] = user

        token = create_token(user)
        return jsonify({
            "user": {"id": user["id"], "name": user["name"], "email": user["email"], "role": user.get("role", "user")},
            "token": token,
        })
    except ValueError:
        return jsonify({"message": "ID token không hợp lệ"}), 401
    except Exception as e:
        print("❌ Google login error:", e)
        return jsonify({"message": "Đăng nhập Google thất bại"}), 500


@app.get("/api/me")
def me():
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        return jsonify({"message": "Thiếu token"}), 401
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET", "dev_secret"), algorithms=["HS256"])
        return jsonify({
            "userId": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "role": payload.get("role", "user"),
        })
    except Exception:
        return jsonify({"message": "Token không hợp lệ"}), 401


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "5000")), debug=True)


