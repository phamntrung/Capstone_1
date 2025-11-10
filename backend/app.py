import os
import datetime
import secrets
import json
from typing import Dict, Any, List, Optional
from functools import wraps
try:
    from zoneinfo import ZoneInfo
except ImportError:
    # Python < 3.9 fallback
    try:
        from backports.zoneinfo import ZoneInfo
    except ImportError:
        # If zoneinfo not available, use UTC offset manually
        ZoneInfo = None

from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash

# Import database và models
from database import init_database, db, migrate
from models import User, Category, Expense, Budget, Notification, Device, UserSetting
from email_service import email_service
try:
    # optional ML helpers
    from .ai_categorize import is_model_available, predict_category_ml, train_category_model_from_pairs
except Exception:  # fallback if package import style fails
    try:
        from ai_categorize import is_model_available, predict_category_ml, train_category_model_from_pairs
    except Exception:
        is_model_available = lambda: False  # type: ignore
        def predict_category_ml(_text: str):  # type: ignore
            raise RuntimeError("ML model not available")
        def train_category_model_from_pairs(_t, _l):  # type: ignore
            raise RuntimeError("Training dependencies not available")

# Optional Google verification
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests


load_dotenv()
app = Flask(__name__)

# CORS Configuration - Allow multiple origins for development
# In production, specify exact origins for security
cors_origin_env = os.getenv("CORS_ORIGIN", "*")
if cors_origin_env == "*":
    # Development: Allow common localhost origins
    allowed_origins = [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
else:
    # Production: Use configured origin(s)
    allowed_origins = [origin.strip() for origin in cors_origin_env.split(",")]

# Enable credentials (cookies) for CORS - required for httpOnly cookies
CORS(app,
     resources={r"/api/*": {"origins": allowed_origins, "supports_credentials": True}},
     supports_credentials=True
)

# Log CORS configuration for debugging
print(f"🌐 CORS Configuration:")
print(f"   Allowed origins: {allowed_origins}")
print(f"   Supports credentials: True")

# Add Cross-Origin-Opener-Policy header to allow Google Sign-In postMessage
# This prevents the "Cross-Origin-Opener-Policy policy would block the window.postMessage call" error
@app.after_request
def set_coop_header(response):
    # Set COOP to "same-origin-allow-popups" to allow Google Sign-In postMessage
    # This allows same-origin popups and postMessage while maintaining security
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'

    # Log CORS requests for debugging (only in development)
    if os.getenv("FLASK_ENV") == "development" or os.getenv("FLASK_DEBUG") == "True":
        origin = request.headers.get('Origin', 'No Origin')
        if origin != 'No Origin':
            print(f"🌐 CORS Request: {request.method} {request.path} from {origin}")

    return response

# Khởi tạo database
init_database(app)


def get_current_date_vietnam():
    """Lấy ngày hiện tại theo timezone Vietnam (Asia/Ho_Chi_Minh)"""
    if ZoneInfo:
        try:
            vietnam_tz = ZoneInfo("Asia/Ho_Chi_Minh")
            now = datetime.datetime.now(vietnam_tz)
            return now.date()
        except Exception:
            # Fallback nếu timezone không khả dụng
            pass
    # Fallback: dùng UTC+7 (Vietnam GMT+7)
    utc_now = datetime.datetime.utcnow()
    vietnam_offset = datetime.timedelta(hours=7)
    vietnam_time = utc_now + vietnam_offset
    return vietnam_time.date()


def create_token(user) -> str:
    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
    }
    return jwt.encode(payload, os.getenv("JWT_SECRET", "dev_secret"), algorithm="HS256")


def auth_required(fn):
    """
    Authentication decorator that checks for JWT token
    Supports both httpOnly cookie (preferred) and Authorization header (fallback)
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = None

        # Priority 1: Try to get token from httpOnly cookie (most secure)
        token = request.cookies.get('auth_token')

        # Priority 2: Fallback to Authorization header (for compatibility)
        if not token:
            auth_header = request.headers.get("Authorization", "")
            token = auth_header[7:] if auth_header.startswith("Bearer ") else None

        if not token:
            return jsonify({"message": "Thiếu token"}), 401

        try:
            payload = jwt.decode(token, os.getenv("JWT_SECRET", "dev_secret"), algorithms=["HS256"])
            user_id = payload.get("sub")
            if user_id:
                user = User.query.get(user_id)
                if user:
                    request.user = user
                    return fn(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token đã hết hạn"}), 401
        except jwt.InvalidTokenError as e:
            print(f"❌ Invalid token: {e}")
            pass

        return jsonify({"message": "Token không hợp lệ"}), 401
    return wrapper


@app.get("/")
def root():
    return jsonify({
        "status": "ok",
        "message": "Minimal SmartExpense API running",
        "cors_origins": allowed_origins,
        "endpoints": [
            "POST /api/auth/register",
            "POST /api/auth/login",
            "POST /api/auth/google",
            "POST /api/auth/forgot-password",
            "POST /api/auth/reset-password",
            "POST /api/auth/change-password",
            "GET /api/me",
            "PATCH /api/me/balance",
            "GET /api/profile",
            "PUT /api/profile",
            "GET /api/notifications",
            "GET /api/notifications/unread-count",
            "PATCH /api/notifications/<id>/read",
            "PATCH /api/notifications/read-all",
            "DELETE /api/notifications/<id>",
            "DELETE /api/notifications/all",
            "GET/POST /api/expenses",
            "GET/PUT/DELETE /api/expenses/<id>",
            "GET /api/expenses/stats",
            "GET/POST /api/categories",
            "GET/PUT/DELETE /api/categories/<id>",
            "GET/PUT/DELETE /api/devices",
            "POST /api/devices/logout-all",
            "GET /api/2fa/status",
            "POST /api/2fa/generate",
            "POST /api/2fa/verify",
            "GET /api/2fa/recovery-codes",
            "POST /api/2fa/disable",
            "GET/PUT /api/budgets/<yyyymm>",
            "GET /api/reports/summary",
            "POST /api/ai/categorize",
            "POST /api/ai/admin/train_categories",
            "GET /api/ai/forecast",
            "GET /api/ai/alerts",
            "GET /api/ai/insights",
            "POST /api/ai/chat",
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

    # Kiểm tra email đã tồn tại
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"message": "Email đã tồn tại"}), 409

    # Tạo user mới
    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="user"
    )

    db.session.add(user)
    db.session.commit()

    # Tạo thông báo chào mừng
    try:
        email_service.send_notification(
            user_id=user.id,
            user_email=email,
            title="Chào mừng đến với SmartExpense! 🎉",
            message=f"Xin chào {name}! Cảm ơn bạn đã đăng ký tài khoản SmartExpense. Chúc bạn quản lý chi tiêu hiệu quả!",
            notification_type="success",
            send_email=True
        )
    except Exception as e:
        print(f"⚠️ Lỗi khi tạo thông báo đăng ký: {e}")

    return jsonify({
        "success": True,
        "message": "Đăng ký thành công! Vui lòng đăng nhập.",
        "user": {"id": user.id, "name": name, "email": email},
        "redirect": "/login.html"
    }), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"message": "Thiếu email/password"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"message": "Email hoặc mật khẩu không đúng"}), 401

    # Cập nhật last_login_at
    user.last_login_at = datetime.datetime.utcnow()
    db.session.commit()

    # Tạo thông báo đăng nhập thành công
    try:
        email_service.send_notification(
            user_id=user.id,
            user_email=email,
            title="Đăng nhập thành công ✅",
            message=f"Xin chào {user.name}! Bạn đã đăng nhập thành công vào SmartExpense.",
            notification_type="success",
            send_email=False  # Không gửi email cho mỗi lần đăng nhập
        )
    except Exception as e:
        print(f"⚠️ Lỗi khi tạo thông báo đăng nhập: {e}")

    token = create_token(user)
    return jsonify({
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
        "token": token,
    })


@app.post("/api/auth/forgot-password")
def forgot_password():
    """Gửi link reset password qua email"""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"message": "Vui lòng nhập email"}), 400

    # Tìm user
    user = User.query.filter_by(email=email).first()

    # Không báo lỗi nếu email không tồn tại (bảo mật)
    if not user:
        return jsonify({"message": "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu"}), 200

    # Tạo reset token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=120)  # 2 giờ

    # Lưu token vào user_settings
    # Xóa token cũ nếu có
    UserSetting.query.filter_by(
        user_id=user.id,
        setting_key='password_reset_token'
    ).delete()

    # Lưu token mới
    token_setting = UserSetting(
        user_id=user.id,
        setting_key='password_reset_token',
        setting_value=json.dumps({
            'token': reset_token,
            'expires_at': expires_at.isoformat()
        })
    )
    db.session.add(token_setting)
    db.session.commit()

    # Tạo reset link
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    reset_link = f"{frontend_url}/frontend/datlaimatkhau.html?token={reset_token}"

    # Gửi email
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .button {{ display: inline-block; padding: 12px 24px; background: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
        .button:hover {{ background: #1f49cf; color: white !important; }}
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Đặt lại mật khẩu - SmartExpense</h2>
        <p>Xin chào <strong>{user.name}</strong>,</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản SmartExpense.</p>
        <p>Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
        <a href="{reset_link}" class="button">Đặt lại mật khẩu</a>
        <p>Hoặc copy link sau vào trình duyệt:</p>
        <p style="word-break: break-all; color: #2563eb;">{reset_link}</p>
        <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 2 giờ.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        <p>Trân trọng,<br>Đội ngũ SmartExpense</p>
      </div>
    </body>
    </html>
    """

    try:
        email_service.send_email(
            to_email=user.email,
            subject="Đặt lại mật khẩu - SmartExpense",
            html_content=html_content
        )
    except Exception as e:
        print(f"⚠️ Lỗi khi gửi email: {e}")

    return jsonify({"message": "Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu"}), 200


@app.post("/api/auth/reset-password")
def reset_password():
    """Đặt lại mật khẩu với token"""
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    password = data.get("password")

    if not token or not password:
        return jsonify({"message": "Thiếu token hoặc mật khẩu mới"}), 400

    if len(password) < 8:
        return jsonify({"message": "Mật khẩu phải có ít nhất 8 ký tự"}), 400

    # Tìm user có token này
    token_setting = UserSetting.query.filter_by(setting_key='password_reset_token').all()

    user = None
    for setting in token_setting:
        try:
            token_data = json.loads(setting.setting_value)
            if token_data.get('token') == token:
                expires_at = datetime.datetime.fromisoformat(token_data.get('expires_at'))
                if expires_at > datetime.datetime.utcnow():
                    user = User.query.get(setting.user_id)
                    break
        except Exception:
            continue

    if not user:
        return jsonify({"message": "Token không hợp lệ hoặc đã hết hạn"}), 400

    # Hash mật khẩu mới
    user.password_hash = generate_password_hash(password)

    # Xóa token đã dùng
    UserSetting.query.filter_by(
        user_id=user.id,
        setting_key='password_reset_token'
    ).delete()

    db.session.commit()

    return jsonify({"message": "Đặt lại mật khẩu thành công"}), 200


@app.post("/api/auth/change-password")
@auth_required
def change_password():
    """Đổi mật khẩu"""
    data = request.get_json(silent=True) or {}
    old_password = data.get("oldPassword")
    new_password = data.get("newPassword")

    if not old_password or not new_password:
        return jsonify({"message": "Thiếu mật khẩu cũ hoặc mật khẩu mới"}), 400

    if len(new_password) < 8:
        return jsonify({"message": "Mật khẩu mới phải có ít nhất 8 ký tự"}), 400

    user = request.user

    # Kiểm tra mật khẩu cũ
    if not user.password_hash:
        return jsonify({"message": "Tài khoản này không có mật khẩu (đăng nhập bằng Google)"}), 400

    if not check_password_hash(user.password_hash, old_password):
        return jsonify({"message": "Mật khẩu cũ không đúng"}), 401

    # Kiểm tra mật khẩu mới không được trùng với mật khẩu cũ
    if check_password_hash(user.password_hash, new_password):
        return jsonify({"message": "Mật khẩu mới phải khác mật khẩu cũ"}), 400

    # Hash mật khẩu mới
    user.password_hash = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({"message": "Đổi mật khẩu thành công"}), 200


@app.post("/api/auth/google")
def google_login():
    """
    Google OAuth login endpoint
    - Verifies Google ID token
    - Creates/updates user in database
    - Sets httpOnly cookie with JWT token
    - Returns user info (token is in cookie, not in response body)
    """
    data = request.get_json(silent=True) or {}
    id_token_str = data.get("credential") or data.get("idToken")
    if not id_token_str:
        return jsonify({"message": "Thiếu idToken"}), 400

    # Google Client ID
    client_id = os.getenv("GOOGLE_CLIENT_ID", "60974853277-a0jg39ps7b4too995e58rvmehte0e16a.apps.googleusercontent.com")
    try:
        req = google_requests.Request()
        idinfo = google_id_token.verify_oauth2_token(id_token_str, req, audience=client_id)

        if client_id and idinfo.get("aud") != client_id:
            print(f"❌ Client ID mismatch: expected {client_id}, got {idinfo.get('aud')}")
            return jsonify({"message": "ID token không đúng client"}), 401

        # Extract Google user information
        email = (idinfo.get("email") or "").lower()
        google_id = idinfo.get("sub")  # Google User ID
        name = idinfo.get("name") or (email.split("@")[0] if email else "Người dùng")
        avatar_url = idinfo.get("picture")
        email_verified = idinfo.get("email_verified", False)

        if not email:
            return jsonify({"message": "Không lấy được email từ Google"}), 400

        print(f"✅ Google login successful for: {email} (Google ID: {google_id})")
        print(f"📝 Extracted info - Name: {name}, Avatar: {avatar_url}, Verified: {email_verified}")

        # Find user by email OR google_id
        user = User.query.filter(
            (User.email == email) | (User.google_id == google_id)
        ).first()

        if not user:
            # Create new user for Google login
            print(f"🆕 Creating new user for Google login: {email}")
            user = User(
                name=name,
                email=email,
                password_hash="",  # Google users don't need password
                role="user",
                google_id=google_id,
                login_method="google",
                avatar_url=avatar_url,
                email_verified=email_verified,
                last_login_at=datetime.datetime.utcnow()
            )
            db.session.add(user)
            try:
                db.session.commit()
                print(f"✅ Successfully created new Google user in database:")
                print(f"   - ID: {user.id}")
                print(f"   - Name: {user.name}")
                print(f"   - Email: {user.email}")
                print(f"   - Google ID: {user.google_id}")
                print(f"   - Login Method: {user.login_method}")
                print(f"   - Avatar URL: {user.avatar_url}")
            except Exception as db_error:
                db.session.rollback()
                print(f"❌ Database error when creating user: {db_error}")
                import traceback
                traceback.print_exc()
                raise
        else:
            # Update existing user with Google information
            print(f"🔄 Updating existing user with Google info: {email} (DB ID: {user.id})")
            user.google_id = google_id
            user.login_method = "google"
            if avatar_url:
                user.avatar_url = avatar_url
            if email_verified:
                user.email_verified = email_verified
            if not user.name or user.name == user.email.split("@")[0]:
                user.name = name  # Update name if it's just email prefix
            user.last_login_at = datetime.datetime.utcnow()
            try:
                db.session.commit()
                print(f"✅ Successfully updated user in database:")
                print(f"   - ID: {user.id}")
                print(f"   - Name: {user.name}")
                print(f"   - Email: {user.email}")
                print(f"   - Google ID: {user.google_id}")
                print(f"   - Login Method: {user.login_method}")
            except Exception as db_error:
                db.session.rollback()
                print(f"❌ Database error when updating user: {db_error}")
                import traceback
                traceback.print_exc()
                raise

        # Create JWT token
        token = create_token(user)

        # Create response with user info
        response = jsonify({
            "success": True,
            "user": user.to_dict()
        })

        # Set httpOnly cookie with JWT token (secure, cannot be accessed by JavaScript)
        is_secure = os.getenv("FLASK_ENV") != "development"  # Use secure cookies in production
        response.set_cookie(
            'auth_token',
            value=token,
            httponly=True,      # Prevent XSS attacks
            secure=is_secure,    # Only send over HTTPS in production
            samesite='Lax',     # CSRF protection
            max_age=86400 * 7   # 7 days
        )

        print(f"✅ Set httpOnly cookie for user: {email}")
        return response

    except ValueError as e:
        print(f"❌ Google token validation error: {e}")
        return jsonify({"message": "ID token không hợp lệ"}), 401
    except Exception as e:
        print(f"❌ Google login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"Đăng nhập Google thất bại: {str(e)}"}), 500


@app.get("/api/me")
def me():
    """
    Get current user profile
    Supports both httpOnly cookie (preferred) and Authorization header (fallback)
    """
    token = None

    # Priority 1: Try to get token from httpOnly cookie (most secure)
    token = request.cookies.get('auth_token')

    # Priority 2: Fallback to Authorization header (for compatibility)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        token = auth_header[7:] if auth_header.startswith("Bearer ") else None

    if not token:
        return jsonify({"message": "Thiếu token"}), 401

    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET", "dev_secret"), algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id:
            user = User.query.get(user_id)
            if user:
                return jsonify({
                    "userId": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                    "balance": user.balance,
                    "gender": user.gender,
                    "currency": user.currency,
                    "phone": user.phone,
                })
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Token đã hết hạn"}), 401
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid token in /api/me: {e}")
        pass
    except Exception as e:
        print(f"❌ Error in /api/me: {e}")
        pass

    return jsonify({"message": "Token không hợp lệ"}), 401


@app.patch("/api/me/balance")
@auth_required
def update_balance():
    """Cập nhật số dư tháng cho user hiện tại"""
    data = request.get_json(silent=True) or {}
    try:
        balance = float(data.get("balance", 0))
        request.user.balance = balance
        db.session.commit()
        return jsonify({
            "success": True,
            "balance": request.user.balance,
            "message": "Cập nhật số dư thành công"
        })
    except Exception as e:
        return jsonify({"message": f"Lỗi cập nhật số dư: {str(e)}"}), 400


@app.get("/api/profile")
@auth_required
def get_profile():
    """Lấy thông tin hồ sơ của user hiện tại"""
    user = request.user
    return jsonify({
        "userId": user.id,
        "name": user.name,
        "email": user.email,
        "gender": user.gender,
        "currency": user.currency,
        "phone": user.phone,
        "balance": user.balance,
    })


# =======================
# Notifications API
# =======================
@app.get("/api/notifications")
@auth_required
def get_notifications():
    """Lấy danh sách thông báo của user hiện tại"""
    user = request.user
    # Lấy query parameters
    limit = request.args.get("limit", type=int)
    unread_only = request.args.get("unread_only", "false").lower() == "true"

    query = Notification.query.filter_by(user_id=user.id)

    if unread_only:
        query = query.filter_by(is_read=False)

    query = query.order_by(Notification.created_at.desc())

    if limit:
        query = query.limit(limit)

    notifications = query.all()

    # Đếm số thông báo chưa đọc
    unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()

    return jsonify({
        "items": [notif.to_dict() for notif in notifications],
        "unreadCount": unread_count,
        "total": len(notifications)
    })


@app.get("/api/notifications/unread-count")
@auth_required
def get_unread_count():
    """Lấy số lượng thông báo chưa đọc"""
    user = request.user
    count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify({"count": count})


@app.patch("/api/notifications/<int:notification_id>/read")
@auth_required
def mark_notification_read(notification_id: int):
    """Đánh dấu thông báo đã đọc"""
    user = request.user
    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user.id
    ).first()

    if not notification:
        return jsonify({"message": "Không tìm thấy thông báo"}), 404

    notification.is_read = True
    db.session.commit()

    return jsonify({
        "success": True,
        "notification": notification.to_dict()
    })


@app.patch("/api/notifications/read-all")
@auth_required
def mark_all_notifications_read():
    """Đánh dấu tất cả thông báo đã đọc"""
    user = request.user
    updated = Notification.query.filter_by(
        user_id=user.id,
        is_read=False
    ).update({"is_read": True})

    db.session.commit()

    return jsonify({
        "success": True,
        "updated": updated,
        "message": f"Đã đánh dấu {updated} thông báo đã đọc"
    })


@app.delete("/api/notifications/<int:notification_id>")
@auth_required
def delete_notification(notification_id: int):
    """Xóa thông báo"""
    user = request.user
    notification = Notification.query.filter_by(
        id=notification_id,
        user_id=user.id
    ).first()

    if not notification:
        return jsonify({"message": "Không tìm thấy thông báo"}), 404

    db.session.delete(notification)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Đã xóa thông báo"
    })


@app.delete("/api/notifications/all")
@auth_required
def delete_all_notifications():
    """Xóa tất cả thông báo của user hiện tại"""
    user = request.user
    deleted_count = Notification.query.filter_by(user_id=user.id).delete()
    db.session.commit()

    return jsonify({
        "success": True,
        "deleted": deleted_count,
        "message": f"Đã xóa {deleted_count} thông báo"
    })


@app.put("/api/profile")
@auth_required
def update_profile():
    """Cập nhật thông tin hồ sơ của user hiện tại"""
    data = request.get_json(silent=True) or {}
    user = request.user

    print(f"[UPDATE_PROFILE] Received data: {data}")
    print(f"[UPDATE_PROFILE] Current user: {user.email} (ID: {user.id})")
    print(f"[UPDATE_PROFILE] Current user state - name: {user.name}, balance: {user.balance}, gender: {user.gender}, currency: {user.currency}")

    try:
        updated_fields = []

        # Cập nhật các trường được gửi lên
        if "name" in data:
            name = (data.get("name") or "").strip()
            if name:
                old_name = user.name
                user.name = name
                updated_fields.append(f"name: {old_name} -> {name}")

        if "gender" in data:
            old_gender = user.gender
            user.gender = data.get("gender")
            updated_fields.append(f"gender: {old_gender} -> {user.gender}")

        if "currency" in data:
            old_currency = user.currency
            user.currency = data.get("currency")
            updated_fields.append(f"currency: {old_currency} -> {user.currency}")

        if "phone" in data:
            old_phone = user.phone
            user.phone = data.get("phone")
            updated_fields.append(f"phone: {old_phone} -> {user.phone}")

        if "balance" in data:
            try:
                old_balance = user.balance
                new_balance = float(data.get("balance", 0))
                user.balance = new_balance
                updated_fields.append(f"balance: {old_balance} -> {new_balance}")
            except (ValueError, TypeError) as e:
                print(f"[UPDATE_PROFILE] Error parsing balance: {e}")
                pass

        print(f"[UPDATE_PROFILE] Fields to update: {updated_fields}")

        # Commit changes to database
        db.session.commit()

        # Verify changes were saved
        db.session.refresh(user)
        print(f"[UPDATE_PROFILE] After commit - name: {user.name}, balance: {user.balance}, gender: {user.gender}, currency: {user.currency}")
        print(f"[UPDATE_PROFILE] ✅ Successfully updated profile in database")

        return jsonify({
            "success": True,
            "message": "Cập nhật hồ sơ thành công",
            "user": {
                "userId": user.id,
                "name": user.name,
                "email": user.email,
                "gender": user.gender,
                "currency": user.currency,
                "phone": user.phone,
                "balance": user.balance,
            }
        })
    except Exception as e:
        db.session.rollback()
        print(f"[UPDATE_PROFILE] ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Lỗi cập nhật hồ sơ: {str(e)}"}), 400


# =======================
# Utils API
# =======================
@app.get("/api/utils/current-date")
@auth_required
def get_current_date():
    """Lấy ngày hiện tại từ server theo timezone Vietnam"""
    current_date = get_current_date_vietnam()
    return jsonify({
        "date": current_date.isoformat(),  # yyyy-mm-dd
        "timezone": "Asia/Ho_Chi_Minh",
        "timestamp": datetime.datetime.now().isoformat()
    })


# =======================
# Expenses API (MySQL)
# =======================
@app.get("/api/expenses")
@auth_required
def list_expenses():
    user_id = request.user.id
    # Optional filters: date_from, date_to, categoryId
    query = Expense.query.filter_by(user_id=user_id)

    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    category_id = request.args.get("categoryId")

    if date_from:
        query = query.filter(Expense.date >= date_from)
    if date_to:
        query = query.filter(Expense.date <= date_to)
    if category_id:
        try:
            cid = int(category_id)
            query = query.filter(Expense.category_id == cid)
        except ValueError:
            pass

    expenses_list = query.order_by(Expense.date.desc()).all()
    return jsonify({"items": [expense.to_dict() for expense in expenses_list]})


@app.post("/api/expenses")
@auth_required
def create_expense():
    data = request.get_json(silent=True) or {}
    try:
        date_str = (data.get("date") or "").strip()  # yyyy-mm-dd
        amount = float(data.get("amount"))
        etype = (data.get("type") or "expense").strip()  # expense|income
        category_id = data.get("categoryId")
        note = (data.get("note") or "").strip()

        # Nếu không có ngày từ client, lấy ngày hiện tại từ server
        if not date_str:
            date = get_current_date_vietnam()
            date_str = date.isoformat()
        else:
            # Parse date từ client
            date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        # Nếu parse date thất bại, dùng ngày hiện tại từ server
        try:
            date = get_current_date_vietnam()
            date_str = date.isoformat()
        except Exception:
            return jsonify({"message": "Dữ liệu không hợp lệ"}), 400

    if not isinstance(etype, str):
        return jsonify({"message": "Thiếu loại"}), 400

    expense = Expense(
        user_id=request.user.id,
        date=date,
        amount=amount,
        type=etype,
        category_id=int(category_id) if category_id is not None else None,
        note=note
    )

    db.session.add(expense)
    db.session.commit()

    # Kiểm tra và gửi thông báo ngân sách nếu cần (chỉ cho expense, không phải income)
    if etype == "expense" or amount < 0:
        try:
            from notification_service import NotificationService
            NotificationService.check_and_notify_budget(request.user.id, date)
        except Exception as e:
            # Không làm ảnh hưởng đến response nếu thông báo lỗi
            print(f"⚠️ Lỗi khi gửi thông báo ngân sách: {e}")

    return jsonify(expense.to_dict()), 201


def _get_expense_owned(eid: int, uid: int) -> Optional[Expense]:
    return Expense.query.filter_by(id=eid, user_id=uid).first()


@app.get("/api/expenses/<int:eid>")
@auth_required
def get_expense(eid: int):
    expense = _get_expense_owned(eid, request.user.id)
    if not expense:
        return jsonify({"message": "Không tìm thấy"}), 404
    return jsonify(expense.to_dict())


@app.put("/api/expenses/<int:eid>")
@auth_required
def update_expense(eid: int):
    expense = _get_expense_owned(eid, request.user.id)
    if not expense:
        return jsonify({"message": "Không tìm thấy"}), 404

    data = request.get_json(silent=True) or {}

    if "date" in data:
        try:
            expense.date = datetime.datetime.strptime(data["date"], "%Y-%m-%d").date()
        except Exception:
            pass
    if "amount" in data:
        try:
            expense.amount = float(data["amount"])
        except Exception:
            pass
    if "type" in data:
        expense.type = data["type"]
    if "categoryId" in data:
        try:
            expense.category_id = int(data["categoryId"]) if data["categoryId"] is not None else None
        except Exception:
            pass
    if "note" in data:
        expense.note = data["note"]

    db.session.commit()

    # Kiểm tra và gửi thông báo ngân sách nếu cần (chỉ cho expense, không phải income)
    if expense.type == "expense" or expense.amount < 0:
        try:
            from notification_service import NotificationService
            NotificationService.check_and_notify_budget(request.user.id, expense.date)
        except Exception as e:
            # Không làm ảnh hưởng đến response nếu thông báo lỗi
            print(f"⚠️ Lỗi khi gửi thông báo ngân sách: {e}")

    return jsonify(expense.to_dict())


@app.delete("/api/expenses/<int:eid>")
@auth_required
def delete_expense(eid: int):
    expense = _get_expense_owned(eid, request.user.id)
    if not expense:
        return jsonify({"message": "Không tìm thấy"}), 404

    deleted_data = expense.to_dict()
    db.session.delete(expense)
    db.session.commit()

    return jsonify({"deleted": deleted_data})


# =======================
# Categories API (MySQL)
# =======================
@app.get("/api/categories")
@auth_required
def list_categories():
    categories = Category.query.filter_by(user_id=request.user.id).all()
    return jsonify({"items": [category.to_dict() for category in categories]})


@app.post("/api/categories")
@auth_required
def create_category():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"message": "Thiếu tên"}), 400

    category = Category(
        user_id=request.user.id,
        name=name,
        color=data.get("color", "#3b82f6"),
        note=data.get("note", ""),
        is_active=data.get("on", True) if "on" in data else True
    )

    db.session.add(category)
    db.session.commit()

    return jsonify(category.to_dict()), 201


@app.get("/api/categories/<int:cid>")
@auth_required
def get_category(cid: int):
    category = Category.query.filter_by(id=cid, user_id=request.user.id).first()
    if not category:
        return jsonify({"message": "Không tìm thấy"}), 404
    return jsonify(category.to_dict())


@app.put("/api/categories/<int:cid>")
@auth_required
def update_category(cid: int):
    category = Category.query.filter_by(id=cid, user_id=request.user.id).first()
    if not category:
        return jsonify({"message": "Không tìm thấy"}), 404

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if name:
        category.name = name
    if "color" in data:
        category.color = data.get("color", "#3b82f6")
    if "note" in data:
        category.note = data.get("note", "")
    if "on" in data:
        category.is_active = data.get("on", True)

    db.session.commit()
    return jsonify(category.to_dict())


@app.delete("/api/categories/<int:cid>")
@auth_required
def delete_category(cid: int):
    category = Category.query.filter_by(id=cid, user_id=request.user.id).first()
    if not category:
        return jsonify({"message": "Không tìm thấy"}), 404

    db.session.delete(category)
    db.session.commit()

    return jsonify({"deleted": cid})


# =======================
# Devices API (MySQL)
# =======================
@app.get("/api/devices")
@auth_required
def list_devices():
    """Lấy danh sách thiết bị của user"""
    devices = Device.query.filter_by(user_id=request.user.id).order_by(Device.last_activity_at.desc()).all()
    return jsonify({"items": [device.to_dict() for device in devices]})


@app.get("/api/devices/<int:device_id>")
@auth_required
def get_device(device_id: int):
    """Lấy thông tin một thiết bị"""
    device = Device.query.filter_by(id=device_id, user_id=request.user.id).first()
    if not device:
        return jsonify({"message": "Không tìm thấy"}), 404
    return jsonify(device.to_dict())


@app.put("/api/devices/<int:device_id>")
@auth_required
def update_device(device_id: int):
    """Cập nhật thiết bị (trust, block, etc.)"""
    device = Device.query.filter_by(id=device_id, user_id=request.user.id).first()
    if not device:
        return jsonify({"message": "Không tìm thấy"}), 404

    data = request.get_json(silent=True) or {}
    if "trusted" in data:
        device.is_trusted = data.get("trusted", False)
    if "blocked" in data:
        device.is_blocked = data.get("blocked", False)

    db.session.commit()
    return jsonify(device.to_dict())


@app.delete("/api/devices/<int:device_id>")
@auth_required
def delete_device(device_id: int):
    """Xóa thiết bị (đăng xuất)"""
    device = Device.query.filter_by(id=device_id, user_id=request.user.id).first()
    if not device:
        return jsonify({"message": "Không tìm thấy"}), 404

    db.session.delete(device)
    db.session.commit()
    return jsonify({"deleted": device_id})


@app.post("/api/devices/logout-all")
@auth_required
def logout_all_devices():
    """Đăng xuất tất cả thiết bị (trừ thiết bị hiện tại)"""
    # Xóa tất cả devices trừ device hiện tại (nếu có)
    Device.query.filter(
        Device.user_id == request.user.id,
        Device.is_current != True
    ).delete()
    db.session.commit()
    return jsonify({"message": "Đã đăng xuất tất cả thiết bị"})


# =======================
# 2FA API (Two-Factor Authentication)
# =======================
# Note: Requires pyotp and qrcode packages
# Install: pip install pyotp qrcode[pil]
try:
    import pyotp
    import qrcode
    import io
    import base64
    TWO_FA_AVAILABLE = True
except ImportError:
    TWO_FA_AVAILABLE = False
    print("⚠️ 2FA không khả dụng. Cài đặt: pip install pyotp qrcode[pil]")


@app.get("/api/2fa/status")
@auth_required
def get_2fa_status():
    """Lấy trạng thái 2FA của user"""
    user_id = request.user.id

    enabled_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_enabled'
    ).first()

    method_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_method'
    ).first()

    enabled = enabled_setting and enabled_setting.setting_value == 'true'
    method = method_setting.setting_value if method_setting else None

    return jsonify({
        "enabled": enabled,
        "method": method
    })


@app.post("/api/2fa/generate")
@auth_required
def generate_2fa():
    """Tạo secret và QR code mới"""
    if not TWO_FA_AVAILABLE:
        return jsonify({"message": "2FA không khả dụng. Vui lòng cài đặt: pip install pyotp qrcode[pil]"}), 503

    user_id = request.user.id
    user_email = request.user.email

    # Tạo secret mới
    secret = pyotp.random_base32()

    # Lưu secret tạm thời (chưa kích hoạt)
    temp_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_secret_temp'
    ).first()

    if temp_setting:
        temp_setting.setting_value = secret
        temp_setting.updated_at = datetime.datetime.utcnow()
    else:
        temp_setting = UserSetting(
            user_id=user_id,
            setting_key='two_factor_secret_temp',
            setting_value=secret
        )
        db.session.add(temp_setting)

    db.session.commit()

    # Tạo QR code
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user_email,
        issuer_name='SmartExpense'
    )

    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()
    qr_code_url = f"data:image/png;base64,{qr_code_base64}"

    return jsonify({
        "secret": secret,
        "qrCode": qr_code_url,
        "manualEntryKey": secret
    })


@app.post("/api/2fa/verify")
@auth_required
def verify_2fa():
    """Verify mã 6 số và kích hoạt 2FA"""
    if not TWO_FA_AVAILABLE:
        return jsonify({"message": "2FA không khả dụng. Vui lòng cài đặt: pip install pyotp qrcode[pil]"}), 503

    data = request.get_json(silent=True) or {}
    code = data.get("code", "").strip()
    method = data.get("method", "app")

    if not code or not code.isdigit() or len(code) != 6:
        return jsonify({"message": "Mã phải là 6 chữ số"}), 400

    user_id = request.user.id

    # Lấy secret tạm thời
    temp_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_secret_temp'
    ).first()

    if not temp_setting:
        return jsonify({"message": "Chưa tạo secret. Vui lòng tạo secret mới trước."}), 400

    secret = temp_setting.setting_value

    # Verify mã
    totp = pyotp.TOTP(secret)
    verified = totp.verify(code, valid_window=2)  # Cho phép ±2 time steps

    if not verified:
        return jsonify({"message": "Mã không đúng. Vui lòng thử lại."}), 401

    # Tạo recovery codes
    import random
    import string
    recovery_codes = []
    for _ in range(8):
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        recovery_codes.append(f"{code[:4]}-{code[4:]}")

    # Lưu secret chính thức
    secret_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_secret'
    ).first()

    if secret_setting:
        secret_setting.setting_value = secret
        secret_setting.updated_at = datetime.datetime.utcnow()
    else:
        secret_setting = UserSetting(
            user_id=user_id,
            setting_key='two_factor_secret',
            setting_value=secret
        )
        db.session.add(secret_setting)

    # Lưu enabled và method
    enabled_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_enabled'
    ).first()

    if enabled_setting:
        enabled_setting.setting_value = 'true'
        enabled_setting.updated_at = datetime.datetime.utcnow()
    else:
        enabled_setting = UserSetting(
            user_id=user_id,
            setting_key='two_factor_enabled',
            setting_value='true'
        )
        db.session.add(enabled_setting)

    method_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_method'
    ).first()

    if method_setting:
        method_setting.setting_value = method
        method_setting.updated_at = datetime.datetime.utcnow()
    else:
        method_setting = UserSetting(
            user_id=user_id,
            setting_key='two_factor_method',
            setting_value=method
        )
        db.session.add(method_setting)

    # Lưu recovery codes
    recovery_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_recovery_codes'
    ).first()

    if recovery_setting:
        recovery_setting.setting_value = json.dumps(recovery_codes)
        recovery_setting.updated_at = datetime.datetime.utcnow()
    else:
        recovery_setting = UserSetting(
            user_id=user_id,
            setting_key='two_factor_recovery_codes',
            setting_value=json.dumps(recovery_codes)
        )
        db.session.add(recovery_setting)

    # Xóa secret tạm thời
    db.session.delete(temp_setting)
    db.session.commit()

    return jsonify({
        "message": "Kích hoạt 2FA thành công",
        "recoveryCodes": recovery_codes
    })


@app.get("/api/2fa/recovery-codes")
@auth_required
def get_recovery_codes():
    """Lấy recovery codes"""
    user_id = request.user.id

    recovery_setting = UserSetting.query.filter_by(
        user_id=user_id,
        setting_key='two_factor_recovery_codes'
    ).first()

    if not recovery_setting:
        return jsonify({"message": "Không tìm thấy recovery codes"}), 404

    try:
        recovery_codes = json.loads(recovery_setting.setting_value)
        return jsonify({"recoveryCodes": recovery_codes})
    except Exception:
        return jsonify({"message": "Lỗi đọc recovery codes"}), 500


@app.post("/api/2fa/disable")
@auth_required
def disable_2fa():
    """Tắt 2FA"""
    user_id = request.user.id

    # Xóa tất cả 2FA settings
    UserSetting.query.filter(
        UserSetting.user_id == user_id,
        UserSetting.setting_key.in_([
            'two_factor_enabled',
            'two_factor_method',
            'two_factor_secret',
            'two_factor_secret_temp',
            'two_factor_phone',
            'two_factor_phone_temp',
            'two_factor_recovery_codes'
        ])
    ).delete()

    db.session.commit()

    return jsonify({"message": "Đã tắt 2FA"})


@app.post("/api/2fa/send-sms")
@auth_required
def send_sms_2fa():
    """Gửi OTP qua SMS (placeholder - requires Twilio service)"""
    return jsonify({"message": "SMS 2FA chưa được implement. Vui lòng sử dụng App 2FA."}), 501


@app.post("/api/2fa/verify-sms")
@auth_required
def verify_sms_2fa():
    """Verify OTP SMS (placeholder - requires Twilio service)"""
    return jsonify({"message": "SMS 2FA chưa được implement. Vui lòng sử dụng App 2FA."}), 501


# =======================
# Budgets API (MySQL)
# =======================
@app.get("/api/budgets/<string:yyyymm>")
@auth_required
def get_budget(yyyymm: str):
    budget = Budget.query.filter_by(user_id=request.user.id, month=yyyymm).first()
    if not budget:
        # Trả về budget mặc định nếu chưa có
        return jsonify({"userId": request.user.id, "month": yyyymm, "amount": 0})
    return jsonify(budget.to_dict())


@app.put("/api/budgets/<string:yyyymm>")
@auth_required
def put_budget(yyyymm: str):
    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get("amount"))
    except Exception:
        return jsonify({"message": "Số tiền không hợp lệ"}), 400

    # Tìm budget hiện có hoặc tạo mới
    budget = Budget.query.filter_by(user_id=request.user.id, month=yyyymm).first()
    if not budget:
        budget = Budget(
            user_id=request.user.id,
            month=yyyymm,
            amount=amount
        )
        db.session.add(budget)
    else:
        budget.amount = amount

    db.session.commit()

    # Kiểm tra và gửi thông báo ngân sách sau khi cập nhật budget
    try:
        from notification_service import NotificationService
        from utils.budget_checker import BudgetChecker
        # Chuyển đổi yyyymm (202501) thành yyyy-mm (2025-01) để parse date
        try:
            year = int(yyyymm[:4])
            month = int(yyyymm[4:])
            expense_date = datetime.date(year, month, 1)
            NotificationService.check_and_notify_budget(request.user.id, expense_date)
        except Exception:
            # Nếu không parse được, dùng tháng hiện tại
            NotificationService.check_and_notify_budget(request.user.id, None)
    except Exception as e:
        # Không làm ảnh hưởng đến response nếu thông báo lỗi
        print(f"⚠️ Lỗi khi gửi thông báo ngân sách: {e}")

    return jsonify(budget.to_dict())


# =======================
# Reports API (MySQL aggregates)
# =======================
@app.get("/api/reports/summary")
@auth_required
def report_summary():
    uid = request.user.id
    # Filter user expenses
    user_exp = Expense.query.filter_by(user_id=uid).all()
    # Daily last 10 days
    today = datetime.date.today()
    daily = []
    for i in range(10):
        d = today - datetime.timedelta(days=i)
        key = d.isoformat()
        day_amount = 0.0
        tx_count = 0
        for e in user_exp:
            if e.date.isoformat() == key and (e.type == "expense" or e.amount < 0):
                day_amount += abs(e.amount)
                tx_count += 1
        daily.append({"date": key, "amount": round(day_amount, 2), "transactions": tx_count})
    # Monthly last 6 months
    monthly = []
    base = today.replace(day=1)
    for i in range(6):
        month_dt = (base - datetime.timedelta(days=1)).replace(day=1) if i > 0 else base
        if i > 0:
            # step one more month back for i>0
            for _ in range(i):
                month_dt = (month_dt - datetime.timedelta(days=1)).replace(day=1)
        ym = f"{month_dt.year}-{str(month_dt.month).zfill(2)}"
        label = f"{str(month_dt.month).zfill(2)}/{month_dt.year}"
        m_amount = 0.0
        tx_count = 0
        for e in user_exp:
            if e.date.strftime("%Y-%m") == ym and (e.type == "expense" or e.amount < 0):
                m_amount += abs(e.amount)
                tx_count += 1
        # budget
        budget = Budget.query.filter_by(user_id=uid, month=ym.replace("-", "")).first()
        budget_amount = budget.amount if budget else 0
        monthly.append({"month": label, "amount": round(m_amount, 2), "budget": budget_amount, "transactions": tx_count})
    # Category totals
    cat_totals: Dict[int, float] = {}
    for e in user_exp:
        if e.type == "expense" or e.amount < 0:
            cid = e.category_id or 0
            cat_totals[cid] = cat_totals.get(cid, 0.0) + abs(e.amount)
    categories = []
    total_first_month = monthly[0]["amount"] if monthly else 0
    for cid, amount in cat_totals.items():
        if cid:
            category = Category.query.get(cid)
            name = category.name if category else "Khác"
        else:
            name = "Khác"
        pct = 0 if total_first_month == 0 else round((amount / total_first_month) * 100)
        categories.append({"id": cid, "name": name, "amount": round(amount, 2), "percentage": pct})
    return jsonify({"daily": daily, "monthly": monthly, "categories": categories})


# =======================
# AI: Auto-categorize (rule-based, fallback by simple heuristics)
# =======================
KEYWORD_TO_CATEGORY = {
    # vietnamese common keywords
    "grab": "Di chuyển",
    "taxi": "Di chuyển",
    "xang": "Di chuyển",
    "xăng": "Di chuyển",
    "bus": "Di chuyển",
    "cafe": "Ăn uống",
    "cà phê": "Ăn uống",
    "trasua": "Ăn uống",
    "trà sữa": "Ăn uống",
    "kfc": "Ăn uống",
    "lotteria": "Ăn uống",
    "com": "Ăn uống",
    "cơm": "Ăn uống",
    "an trua": "Ăn uống",
    "ăn trưa": "Ăn uống",
    "sieu thi": "Nhà ở",
    "siêu thị": "Nhà ở",
    "dien": "Nhà ở",
    "điện": "Nhà ở",
    "nuoc": "Nhà ở",
    "nước": "Nhà ở",
    "tien nha": "Nhà ở",
    "tiền nhà": "Nhà ở",
}


def _find_category_id_by_name(uid: int, name: str) -> Optional[int]:
    category = Category.query.filter_by(user_id=uid, name=name.strip()).first()
    return category.id if category else None


@app.post("/api/ai/categorize")
@auth_required
def ai_categorize():
    data = request.get_json(silent=True) or {}
    text = (data.get("description") or "") + " " + (data.get("merchant") or "")
    text_low = text.lower()
    # rule-based match
    matched_name = None
    for key, cat_name in KEYWORD_TO_CATEGORY.items():
        if key in text_low:
            matched_name = cat_name
            break
    confidence = 0.6 if matched_name else 0.2
    cid = _find_category_id_by_name(request.user.id, matched_name) if matched_name else None

    # If no rule matched, try ML model if available
    if cid is None and is_model_available():
        try:
            pred_cid, prob = predict_category_ml(text)
            # Only accept ML prediction if user actually has that category; otherwise keep None
            if pred_cid:
                user_has = Category.query.filter_by(id=pred_cid, user_id=request.user.id).first()
                if user_has:
                    cid = pred_cid
                    matched_name = user_has.name
                    confidence = float(prob)
        except Exception:
            pass
    return jsonify({
        "categoryId": cid,
        "categoryName": matched_name,
        "confidence": confidence,
        "strategy": "rule"
    })


# =======================
# AI: Admin training endpoint (from current user's labeled expenses)
# WARNING: For demo/dev only. Protect or remove in production.
# =======================
@app.post("/api/ai/admin/train_categories")
@auth_required
def ai_admin_train_categories():
    # Collect labeled expenses of current user
    uid = request.user.id
    labeled = Expense.query.filter_by(user_id=uid).filter(Expense.category_id.isnot(None)).all()
    if len(labeled) < 5:
        return jsonify({"message": "Chưa đủ dữ liệu có nhãn (>=5)"}), 400
    texts = [str(e.note or "") for e in labeled]
    # Fallback: include date+amount to give more tokens
    texts = [f"{t} {e.date} {e.amount}" for t, e in zip(texts, labeled)]
    labels = [int(e.category_id) for e in labeled]
    try:
        train_category_model_from_pairs(texts, labels)
        return jsonify({"trained": True, "count": len(labels)})
    except Exception as ex:
        return jsonify({"message": f"Lỗi train: {ex}"}), 500


# =======================
# AI: Forecast & Alerts (simple projection)
# =======================
def _month_end(d: datetime.date) -> datetime.date:
    if d.month == 12:
        return datetime.date(d.year, 12, 31)
    first_next = datetime.date(d.year, d.month + 1, 1)
    return first_next - datetime.timedelta(days=1)


@app.get("/api/ai/forecast")
@auth_required
def ai_forecast():
    uid = request.user.id
    today = datetime.date.today()
    ym = f"{today.year}-{str(today.month).zfill(2)}"
    end = _month_end(today)
    # gather month expenses
    month_exp = Expense.query.filter_by(user_id=uid).filter(Expense.date.like(f"{ym}%")).all()
    total_spent = 0.0
    for e in month_exp:
        if e.type == "expense" or e.amount < 0:
            total_spent += abs(e.amount)
    days_passed = today.day
    avg_per_day = total_spent / max(1, days_passed)
    days_total = end.day
    forecast = avg_per_day * days_total
    budget = Budget.query.filter_by(user_id=uid, month=ym.replace("-", "")).first()
    budget_amount = budget.amount if budget else 0.0
    return jsonify({
        "month": ym,
        "spentToDate": round(total_spent, 2),
        "avgPerDay": round(avg_per_day, 2),
        "forecast": round(forecast, 2),
        "budget": budget_amount,
    })


@app.get("/api/ai/alerts")
@auth_required
def ai_alerts():
    data = ai_forecast().json
    forecast = data.get("forecast", 0)
    budget = data.get("budget", 0)
    alerts: List[Dict[str, Any]] = []
    if budget and forecast:
        used_pct = round((forecast / budget) * 100)
        if used_pct >= 100:
            level = "over"
            msg = "Dự báo vượt quá ngân sách tháng"
            notification_type = "error"
        elif used_pct >= 85:
            level = "high"
            msg = "Cảnh báo: Dự báo sẽ chạm 85%+ ngân sách"
            notification_type = "warning"
        elif used_pct >= 70:
            level = "medium"
            msg = "Lưu ý: Dự báo sẽ vượt 70% ngân sách"
            notification_type = "info"
        else:
            level = "ok"
            msg = "Chi tiêu trong ngưỡng an toàn"
            notification_type = "success"
        alerts.append({"level": level, "message": msg, "usedPercent": used_pct})

        # Tạo thông báo trong database cho các cảnh báo quan trọng (>= 70%)
        if used_pct >= 70:
            try:
                email_service.send_notification(
                    user_id=request.user.id,
                    user_email=request.user.email,
                    title=f"Cảnh báo ngân sách ({used_pct}%)",
                    message=f"{msg}. Dự báo chi tiêu: {forecast:,.0f}đ / Ngân sách: {budget:,.0f}đ",
                    notification_type=notification_type,
                    send_email=(used_pct >= 85)  # Chỉ gửi email khi >= 85%
                )
            except Exception as e:
                print(f"⚠️ Lỗi khi tạo thông báo cảnh báo: {e}")

    return jsonify({"alerts": alerts})


# =======================
# AI: Insights (simple heuristics)
# =======================
@app.get("/api/ai/insights")
@auth_required
def ai_insights():
    uid = request.user.id
    insights: List[Dict[str, Any]] = []
    # Compare last 7 days vs previous 7 days
    today = datetime.date.today()
    def sum_range(start: datetime.date, end: datetime.date) -> float:
        s = 0.0
        while start <= end:
            day_expenses = Expense.query.filter_by(user_id=uid, date=start).all()
            for e in day_expenses:
                if e.type == "expense" or e.amount < 0:
                    s += abs(e.amount)
            start += datetime.timedelta(days=1)
        return s
    last7 = sum_range(today - datetime.timedelta(days=6), today)
    prev7 = sum_range(today - datetime.timedelta(days=13), today - datetime.timedelta(days=7))
    if prev7 > 0:
        change = round(((last7 - prev7) / prev7) * 100)
        if abs(change) >= 20:
            insights.append({
                "type": "trend",
                "message": f"Chi tiêu 7 ngày qua thay đổi {change}% so với tuần trước",
            })
    # Top category this month
    ym = f"{today.year}-{str(today.month).zfill(2)}"
    cat_tot: Dict[int, float] = {}
    month_expenses = Expense.query.filter_by(user_id=uid).filter(Expense.date.like(f"{ym}%")).all()
    for e in month_expenses:
        if e.type == "expense" or e.amount < 0:
            cid = e.category_id or 0
            cat_tot[cid] = cat_tot.get(cid, 0.0) + abs(e.amount)
    if cat_tot:
        top_cid = max(cat_tot, key=cat_tot.get)
        if top_cid:
            category = Category.query.get(top_cid)
            top_name = category.name if category else "Khác"
        else:
            top_name = "Khác"
        insights.append({
            "type": "category",
            "message": f"Danh mục chi tiêu nhiều nhất tháng này: {top_name}",
        })
    # Budget recommendation (simple: suggest avg per day * days of month)
    end = _month_end(today)
    days_total = end.day
    avg_day = last7 / 7 if last7 else 0
    suggest_budget = round(avg_day * days_total * 1.1, 2) if avg_day else None
    if suggest_budget:
        insights.append({
            "type": "budget_suggestion",
            "message": f"Gợi ý ngân sách tháng tới: ~ {suggest_budget:,.0f}đ",
        })
    return jsonify({"insights": insights})


# =======================
# AI: Simple chat intents (rule-based)
# =======================
@app.post("/api/ai/chat")
@auth_required
def ai_chat():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").lower()
    # simple intent: create expense like "tao chi 50000 cafe"
    import re
    m = re.search(r"(tao|tạo)\s+chi\s+(\d+)", text)
    if m:
        amount = -float(m.group(2))
        expense = Expense(
            user_id=request.user.id,
            date=datetime.date.today(),
            amount=amount,
            type="expense",
            category_id=None,
            note="chat-created"
        )
        db.session.add(expense)
        db.session.commit()
        return jsonify({"reply": f"Đã tạo chi tiêu {abs(int(amount))}đ hôm nay.", "created": expense.to_dict()})
    # fallback
    return jsonify({"reply": "Mình có thể giúp gợi ý danh mục, dự báo chi tiêu và cảnh báo ngân sách. Bạn muốn làm gì?"})


# =======================
# Expenses Stats API (for charts)
# =======================
@app.get("/api/expenses/stats")
@auth_required
def expenses_stats():
    """Lấy thống kê chi tiêu cho biểu đồ xu hướng"""
    uid = request.user.id

    # Get query parameters
    period = request.args.get("period", "10")  # 10, 30, 60, 90 days
    group_by = request.args.get("groupBy", "day")  # day, week, category

    try:
        days = int(period)
    except:
        days = 10

    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=days)

    # Get user expenses in range
    expenses = Expense.query.filter(
        Expense.user_id == uid,
        Expense.date >= start_date,
        Expense.date <= today
    ).order_by(Expense.date.asc()).all()

    if group_by == "category":
        # Group by category
        cat_stats = {}
        for e in expenses:
            if e.type == "expense" or e.amount < 0:
                cid = e.category_id or 0
                cat_name = e.category.name if e.category_id and e.category else "Khác"
                if cid not in cat_stats:
                    cat_stats[cid] = {"name": cat_name, "amount": 0, "count": 0}
                cat_stats[cid]["amount"] += abs(e.amount)
                cat_stats[cid]["count"] += 1

        result = [{"id": cid, **stats} for cid, stats in cat_stats.items()]
        return jsonify({"items": result, "groupBy": "category"})

    elif group_by == "week":
        # Group by week
        week_stats = {}
        for e in expenses:
            if e.type == "expense" or e.amount < 0:
                week_start = e.date - datetime.timedelta(days=e.date.weekday())
                week_key = week_start.isoformat()
                if week_key not in week_stats:
                    week_stats[week_key] = {"date": week_key, "amount": 0, "count": 0}
                week_stats[week_key]["amount"] += abs(e.amount)
                week_stats[week_key]["count"] += 1

        result = sorted([stats for stats in week_stats.values()], key=lambda x: x["date"])
        return jsonify({"items": result, "groupBy": "week"})

    else:
        # Group by day (default)
        day_stats = {}
        for e in expenses:
            if e.type == "expense" or e.amount < 0:
                day_key = e.date.isoformat()
                if day_key not in day_stats:
                    day_stats[day_key] = {"date": day_key, "amount": 0, "count": 0}
                day_stats[day_key]["amount"] += abs(e.amount)
                day_stats[day_key]["count"] += 1

        # Fill missing days with 0
        result = []
        current = start_date
        while current <= today:
            day_key = current.isoformat()
            if day_key in day_stats:
                result.append(day_stats[day_key])
            else:
                result.append({"date": day_key, "amount": 0, "count": 0})
            current += datetime.timedelta(days=1)

        return jsonify({"items": result, "groupBy": "day"})


# Khởi động scheduled tasks (background scheduler)
try:
    from scheduled_tasks import init_scheduler, shutdown_scheduler
    import atexit

    # Khởi động scheduler khi app start
    init_scheduler()

    # Đăng ký shutdown scheduler khi app exit
    atexit.register(shutdown_scheduler)
except Exception as e:
    print(f"⚠️ Không thể khởi động scheduler: {e}")
    print("   Thông báo định kỳ sẽ không hoạt động")


if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "5000")), debug=True)


