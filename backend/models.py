from datetime import datetime
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    expenses = db.relationship('Expense', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.name,
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
