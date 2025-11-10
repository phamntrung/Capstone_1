from datetime import datetime, timezone
from database import db

class User(db.Model):
    """Model cho bảng users"""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')
    balance = db.Column(db.Float, nullable=False, default=0.0)  # Số dư tháng
    gender = db.Column(db.String(20), nullable=True)  # Giới tính: 'Nam', 'Nữ', 'Khác'
    currency = db.Column(db.String(50), nullable=True)  # Đơn vị tiền tệ
    phone = db.Column(db.String(20), nullable=True)  # Số điện thoại
    # Google OAuth fields
    google_id = db.Column(db.String(255), unique=True, nullable=True)  # Google User ID (sub)
    login_method = db.Column(db.String(20), default='password')  # 'password' or 'google'
    avatar_url = db.Column(db.String(500), nullable=True)  # Google picture URL
    email_verified = db.Column(db.Boolean, default=False)  # Email verification status
    last_login_at = db.Column(db.DateTime, nullable=True)  # Last login timestamp
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    expenses = db.relationship('Expense', backref='user', lazy=True, cascade='all, delete-orphan')
    categories = db.relationship('Category', backref='user', lazy=True, cascade='all, delete-orphan')
    budgets = db.relationship('Budget', backref='user', lazy=True, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='user', lazy=True, cascade='all, delete-orphan', order_by='Notification.created_at.desc()')
    report_caches = db.relationship('ReportCache', backref='user', lazy=True, cascade='all, delete-orphan')
    user_settings = db.relationship('UserSetting', backref='user', lazy=True, cascade='all, delete-orphan')
    devices = db.relationship('Device', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'balance': self.balance,
            'gender': self.gender,
            'currency': self.currency,
            'phone': self.phone,
            'google_id': self.google_id,
            'login_method': self.login_method,
            'avatar_url': self.avatar_url,
            'email_verified': self.email_verified,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Category(db.Model):
    """Model cho bảng categories"""
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), default='#3b82f6')  # Màu sắc (hex)
    note = db.Column(db.Text, nullable=True)  # Ghi chú
    is_active = db.Column(db.Boolean, default=True)  # Trạng thái: BẬT/TẮT
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    expenses = db.relationship('Expense', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.name,
            'color': self.color or '#3b82f6',
            'note': self.note or '',
            'on': self.is_active if self.is_active is not None else True,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Expense(db.Model):
    """Model cho bảng expenses"""
    __tablename__ = 'expenses'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'expense' or 'income'
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        category_name = None
        if self.category_id and self.category:
            category_name = self.category.name

        return {
            'id': self.id,
            'userId': self.user_id,
            'date': self.date.isoformat() if self.date else None,
            'amount': self.amount,
            'type': self.type,
            'categoryId': self.category_id,
            'categoryName': category_name,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Budget(db.Model):
    """Model cho bảng budgets"""
    __tablename__ = 'budgets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    month = db.Column(db.String(7), nullable=False)  # Format: YYYY-MM
    amount = db.Column(db.Float, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint để mỗi user chỉ có 1 budget cho 1 tháng
    __table_args__ = (db.UniqueConstraint('user_id', 'month', name='unique_user_month'),)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'month': self.month,
            'amount': self.amount,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Notification(db.Model):
    """Model cho bảng notifications"""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), nullable=False, default='info')  # info, warning, error, success
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        # Ensure datetime is treated as UTC when serializing
        created_at_str = None
        if self.created_at:
            # If datetime is naive (no timezone), assume it's UTC and add Z
            # If datetime has timezone, convert to UTC and format
            if self.created_at.tzinfo is None:
                # Naive datetime - assume UTC and add Z
                created_at_str = self.created_at.isoformat() + 'Z'
            else:
                # Datetime with timezone - convert to UTC
                utc_dt = self.created_at.astimezone(timezone.utc)
                created_at_str = utc_dt.isoformat().replace('+00:00', 'Z')

        return {
            'id': self.id,
            'userId': self.user_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'isRead': self.is_read,
            'createdAt': created_at_str
        }

class ReportCache(db.Model):
    """Model cho bảng report_cache"""
    __tablename__ = 'report_cache'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cache_key = db.Column(db.String(100), nullable=False)  # Key để identify cache
    cache_data = db.Column(db.JSON, nullable=False)  # Dữ liệu cache (JSON format)
    expires_at = db.Column(db.DateTime, nullable=False)  # Thời gian hết hạn cache
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: Mỗi user chỉ có 1 cache cho mỗi key
    __table_args__ = (db.UniqueConstraint('user_id', 'cache_key', name='unique_user_cache'),)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'cacheKey': self.cache_key,
            'cacheData': self.cache_data,
            'expiresAt': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def is_expired(self):
        """Kiểm tra cache đã hết hạn chưa"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

class UserSetting(db.Model):
    """Model cho bảng user_settings"""
    __tablename__ = 'user_settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    setting_key = db.Column(db.String(100), nullable=False)  # Tên setting (ví dụ: theme, language)
    setting_value = db.Column(db.Text, nullable=True)  # Giá trị setting (JSON hoặc text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: Mỗi user chỉ có 1 setting cho mỗi key
    __table_args__ = (db.UniqueConstraint('user_id', 'setting_key', name='unique_user_setting'),)

    def to_dict(self):
        # Try to parse JSON if possible
        value = self.setting_value
        try:
            import json
            value = json.loads(self.setting_value) if self.setting_value else None
        except (json.JSONDecodeError, TypeError):
            pass

        return {
            'id': self.id,
            'userId': self.user_id,
            'settingKey': self.setting_key,
            'settingValue': value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Device(db.Model):
    """Model cho bảng devices"""
    __tablename__ = 'devices'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    device_name = db.Column(db.String(100), nullable=True)
    platform = db.Column(db.String(50), nullable=True)
    browser = db.Column(db.String(50), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(10), nullable=True)
    fingerprint = db.Column(db.String(100), nullable=True)
    session_token = db.Column(db.String(255), nullable=True)
    is_trusted = db.Column(db.Boolean, default=False)
    is_blocked = db.Column(db.Boolean, default=False)
    is_current = db.Column(db.Boolean, default=False)
    last_activity_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.device_name or 'Unknown Device',
            'platform': self.platform or 'Unknown',
            'browser': self.browser or 'Unknown',
            'city': self.city or 'Unknown',
            'country': self.country or 'Unknown',
            'ip': self.ip_address or 'Unknown',
            'last': self.last_activity_at.isoformat() if self.last_activity_at else 'Chưa có',
            'sessions': 1,  # TODO: Calculate from sessions table if exists
            'trusted': self.is_trusted if self.is_trusted else False,
            'blocked': self.is_blocked if self.is_blocked else False,
            'current': self.is_current if self.is_current else False,
            'emoji': self._get_emoji(),
            'fp': self.fingerprint or 'N/A'
        }

    def _get_emoji(self):
        """Get emoji based on platform"""
        if not self.platform:
            return '📱'
        p = self.platform.lower()
        if 'ios' in p or 'iphone' in p:
            return '📱'
        if 'macos' in p or 'mac' in p:
            return '💻'
        if 'windows' in p:
            return '🖥️'
        if 'android' in p:
            return '📲'
        if 'linux' in p:
            return '🐧'
        return '💻'
