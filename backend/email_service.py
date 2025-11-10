"""
Email Service - Gửi email và lưu thông báo vào database
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from models import Notification, db
from dotenv import load_dotenv

load_dotenv()

class EmailService:
    """Service để gửi email và lưu thông báo vào database"""
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.email_user = os.getenv('EMAIL_USER', '')
        self.email_password = os.getenv('EMAIL_PASS', '')
        self.email_from = os.getenv('EMAIL_FROM', f'SmartExpense <{self.email_user}>')
        self.is_configured = bool(self.email_user and self.email_password)
    
    def create_notification(self, user_id: int, title: str, message: str, 
                           notification_type: str = 'info') -> Notification:
        """
        Tạo thông báo và lưu vào database
        
        Args:
            user_id: ID của user
            title: Tiêu đề thông báo
            message: Nội dung thông báo
            notification_type: Loại thông báo (info, warning, error, success)
        
        Returns:
            Notification object
        """
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()
        return notification
    
    def send_email(self, to_email: str, subject: str, html_content: str, 
                   text_content: Optional[str] = None) -> bool:
        """
        Gửi email (nếu đã cấu hình)
        
        Args:
            to_email: Email người nhận
            subject: Tiêu đề email
            html_content: Nội dung HTML
            text_content: Nội dung text (optional)
        
        Returns:
            True nếu gửi thành công, False nếu không cấu hình hoặc lỗi
        """
        if not self.is_configured:
            print(f"⚠️ Email service chưa được cấu hình. Bỏ qua gửi email đến {to_email}")
            return False
        
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = self.email_from
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Thêm text content
            if text_content:
                part1 = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(part1)
            
            # Thêm HTML content
            part2 = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(part2)
            
            # Gửi email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.email_user, self.email_password)
                server.send_message(msg)
            
            print(f"✅ Email đã được gửi thành công đến {to_email}")
            return True
        except Exception as e:
            print(f"❌ Lỗi khi gửi email đến {to_email}: {str(e)}")
            return False
    
    def send_notification(self, user_id: int, user_email: str, title: str, 
                         message: str, notification_type: str = 'info',
                         send_email: bool = True) -> Notification:
        """
        Gửi thông báo: lưu vào database và gửi email (nếu được yêu cầu)
        
        Args:
            user_id: ID của user
            user_email: Email của user
            title: Tiêu đề thông báo
            message: Nội dung thông báo
            notification_type: Loại thông báo (info, warning, error, success)
            send_email: Có gửi email hay không
        
        Returns:
            Notification object
        """
        # Luôn luôn lưu vào database
        notification = self.create_notification(user_id, title, message, notification_type)
        
        # Gửi email nếu được yêu cầu và đã cấu hình
        if send_email and user_email:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; }}
                    .content {{ padding: 20px; background-color: #f9fafb; }}
                    .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>SmartExpense</h1>
                    </div>
                    <div class="content">
                        <h2>{title}</h2>
                        <p>{message}</p>
                    </div>
                    <div class="footer">
                        <p>Đây là email tự động từ hệ thống SmartExpense.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_content = f"{title}\n\n{message}\n\n---\nSmartExpense"
            self.send_email(user_email, title, html_content, text_content)
        
        return notification

# Tạo instance global
email_service = EmailService()

