import os
from urllib.parse import quote_plus
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Khởi tạo SQLAlchemy
db = SQLAlchemy()
migrate = Migrate()

def get_database_url():
    """Lấy database URL từ environment variables"""
    mysql_host = os.getenv('MYSQL_HOST', os.getenv('DB_HOST', 'localhost'))
    mysql_port = os.getenv('MYSQL_PORT', os.getenv('DB_PORT', '3306'))
    mysql_user = os.getenv('MYSQL_USER', os.getenv('DB_USER', 'root'))
    # Hỗ trợ cả MYSQL_PASSWORD và DB_PASS
    mysql_password = os.getenv('MYSQL_PASSWORD', os.getenv('DB_PASS', ''))
    # Hỗ trợ cả MYSQL_DATABASE và DB_NAME, nhưng luôn ưu tiên smart_expense
    env_db_name = os.getenv('MYSQL_DATABASE') or os.getenv('DB_NAME')
    # Nếu không có hoặc là finance_ai_system (tên cũ), dùng smart_expense
    if env_db_name and env_db_name != 'finance_ai_system':
        mysql_database = env_db_name
    else:
        mysql_database = 'smart_expense'

    # URL encode password để tránh lỗi với ký tự đặc biệt như @
    encoded_password = quote_plus(mysql_password)

    return f"mysql+pymysql://{mysql_user}:{encoded_password}@{mysql_host}:{mysql_port}/{mysql_database}"

def init_database(app):
    """Khởi tạo database connection"""
    app.config['SQLALCHEMY_DATABASE_URI'] = get_database_url()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    migrate.init_app(app, db)

    # Tạo tables nếu chưa tồn tại (fallback if migrations not used)
    with app.app_context():
        db.create_all()

    return db

def get_db_session():
    """Tạo database session"""
    engine = create_engine(get_database_url())
    Session = sessionmaker(bind=engine)
    return Session()
