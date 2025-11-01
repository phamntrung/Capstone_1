import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def reset_database():
    # Kết nối MySQL
    connection = pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASS', 'root'),
        charset='utf8mb4'
    )
    
    try:
        with connection.cursor() as cursor:
            # Xóa database cũ nếu tồn tại
            cursor.execute("DROP DATABASE IF EXISTS smartexpense")
            print("✅ Dropped old database")
            
            # Tạo database mới
            cursor.execute("CREATE DATABASE smartexpense CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print("✅ Created new database")
            
        connection.commit()
        print("🎉 Database reset successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    reset_database()
