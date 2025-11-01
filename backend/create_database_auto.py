#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to create MySQL database for Smart Expense Management System (Auto)
"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def create_database_auto():
    # Lấy thông tin kết nối từ environment variables
    host = os.getenv('DB_HOST', 'localhost')
    port = int(os.getenv('DB_PORT', '3306'))
    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASS', '')
    database = os.getenv('DB_NAME', 'smartexpense')
    
    print(f"Connecting to MySQL server: {host}:{port}")
    print(f"User: {user}")
    print(f"Database to create: {database}")
    
    try:
        # Kết nối tới MySQL server (không chỉ định database)
        connection = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            charset='utf8mb4'
        )
        
        with connection.cursor() as cursor:
            # Kiểm tra xem database đã tồn tại chưa
            cursor.execute("SHOW DATABASES LIKE %s", (database,))
            result = cursor.fetchone()
            
            if result:
                print(f"Database '{database}' already exists!")
                print("Keeping existing database.")
                return True
            
            # Create new database
            cursor.execute(f"CREATE DATABASE {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            print(f"[SUCCESS] Created database '{database}'!")
            
            # Verify
            cursor.execute("SHOW DATABASES")
            databases = cursor.fetchall()
            print("\nDatabase list:")
            for db in databases:
                print(f"  - {db[0]}")
                
    except pymysql.Error as e:
        print(f"[ERROR] MySQL Error: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        return False
    finally:
        if 'connection' in locals():
            connection.close()
    
    return True

if __name__ == "__main__":
    print("=== Create Database for Smart Expense Management System (Auto) ===\n")
    
    # Check .env file
    if not os.path.exists('.env'):
        print("[ERROR] .env file not found!")
        print("Please create .env file with your MySQL connection info.")
        exit(1)
    
    success = create_database_auto()
    
    if success:
        print("\n[SUCCESS] Complete! Now you can run the application:")
        print("   python app.py")
    else:
        print("\n[ERROR] Error occurred. Please check your MySQL connection info.")
