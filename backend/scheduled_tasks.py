"""
ScheduledTasks - Background tasks để gửi thông báo định kỳ
"""
import os
from datetime import datetime, date, timedelta
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    APSCHEDULER_AVAILABLE = True
except ImportError:
    APSCHEDULER_AVAILABLE = False
    print("⚠️ APScheduler chưa được cài đặt. Thông báo định kỳ sẽ không hoạt động.")
    print("   Chạy: pip install apscheduler==3.10.4")

from models import User, db
from notification_service import NotificationService


# Tạo scheduler instance (chỉ khi APScheduler có sẵn)
scheduler = None
if APSCHEDULER_AVAILABLE:
    scheduler = BackgroundScheduler()


def send_daily_notifications():
    """
    Gửi thông báo hàng ngày cho tất cả users
    Chạy lúc 8:00 AM mỗi ngày
    """
    try:
        print(f"📧 [Scheduled] Bắt đầu gửi thông báo hàng ngày - {datetime.now()}")
        
        # Lấy tất cả users có email
        users = User.query.filter(User.email.isnot(None), User.email != '').all()
        
        sent_count = 0
        error_count = 0
        
        for user in users:
            try:
                # Gửi tóm tắt chi tiêu ngày hôm qua
                notification = NotificationService.send_daily_summary(user.id)
                if notification:
                    sent_count += 1
            except Exception as e:
                error_count += 1
                print(f"❌ Lỗi khi gửi thông báo hàng ngày cho user {user.id}: {e}")
        
        print(f"✅ [Scheduled] Hoàn thành gửi thông báo hàng ngày: {sent_count} thành công, {error_count} lỗi")
    except Exception as e:
        print(f"❌ [Scheduled] Lỗi khi gửi thông báo hàng ngày: {e}")
        import traceback
        traceback.print_exc()


def send_weekly_notifications():
    """
    Gửi thông báo hàng tuần cho tất cả users
    Chạy lúc 9:00 AM thứ 2 hàng tuần
    """
    try:
        print(f"📧 [Scheduled] Bắt đầu gửi thông báo hàng tuần - {datetime.now()}")
        
        # Lấy tất cả users có email
        users = User.query.filter(User.email.isnot(None), User.email != '').all()
        
        sent_count = 0
        error_count = 0
        
        for user in users:
            try:
                # Gửi báo cáo tuần
                notification = NotificationService.send_weekly_report(user.id)
                if notification:
                    sent_count += 1
            except Exception as e:
                error_count += 1
                print(f"❌ Lỗi khi gửi thông báo hàng tuần cho user {user.id}: {e}")
        
        print(f"✅ [Scheduled] Hoàn thành gửi thông báo hàng tuần: {sent_count} thành công, {error_count} lỗi")
    except Exception as e:
        print(f"❌ [Scheduled] Lỗi khi gửi thông báo hàng tuần: {e}")
        import traceback
        traceback.print_exc()


def send_monthly_notifications():
    """
    Gửi thông báo hàng tháng cho tất cả users
    Chạy lúc 9:00 AM ngày 1 hàng tháng
    """
    try:
        print(f"📧 [Scheduled] Bắt đầu gửi thông báo hàng tháng - {datetime.now()}")
        
        # Lấy tất cả users có email
        users = User.query.filter(User.email.isnot(None), User.email != '').all()
        
        sent_count = 0
        error_count = 0
        
        for user in users:
            try:
                # Gửi báo cáo tháng (tháng trước)
                notification = NotificationService.send_monthly_report(user.id)
                if notification:
                    sent_count += 1
            except Exception as e:
                error_count += 1
                print(f"❌ Lỗi khi gửi thông báo hàng tháng cho user {user.id}: {e}")
        
        print(f"✅ [Scheduled] Hoàn thành gửi thông báo hàng tháng: {sent_count} thành công, {error_count} lỗi")
    except Exception as e:
        print(f"❌ [Scheduled] Lỗi khi gửi thông báo hàng tháng: {e}")
        import traceback
        traceback.print_exc()


def init_scheduler():
    """
    Khởi tạo và khởi động scheduler
    """
    if not APSCHEDULER_AVAILABLE or scheduler is None:
        print("⚠️ APScheduler không khả dụng. Bỏ qua khởi động scheduler.")
        return
    
    try:
        # Đăng ký các scheduled jobs
        # Thông báo hàng ngày: 8:00 AM mỗi ngày
        scheduler.add_job(
            send_daily_notifications,
            trigger=CronTrigger(hour=8, minute=0),
            id='daily_notifications',
            name='Gửi thông báo hàng ngày',
            replace_existing=True
        )
        
        # Thông báo hàng tuần: 9:00 AM thứ 2 hàng tuần
        scheduler.add_job(
            send_weekly_notifications,
            trigger=CronTrigger(day_of_week='mon', hour=9, minute=0),
            id='weekly_notifications',
            name='Gửi thông báo hàng tuần',
            replace_existing=True
        )
        
        # Thông báo hàng tháng: 9:00 AM ngày 1 hàng tháng
        scheduler.add_job(
            send_monthly_notifications,
            trigger=CronTrigger(day=1, hour=9, minute=0),
            id='monthly_notifications',
            name='Gửi thông báo hàng tháng',
            replace_existing=True
        )
        
        # Khởi động scheduler
        scheduler.start()
        print("✅ Scheduler đã được khởi động thành công")
        print(f"   - Thông báo hàng ngày: 8:00 AM mỗi ngày")
        print(f"   - Thông báo hàng tuần: 9:00 AM thứ 2 hàng tuần")
        print(f"   - Thông báo hàng tháng: 9:00 AM ngày 1 hàng tháng")
        
    except Exception as e:
        print(f"❌ Lỗi khi khởi động scheduler: {e}")
        import traceback
        traceback.print_exc()


def shutdown_scheduler():
    """
    Dừng scheduler khi app shutdown
    """
    if not APSCHEDULER_AVAILABLE or scheduler is None:
        return
    
    try:
        if scheduler.running:
            scheduler.shutdown()
            print("✅ Scheduler đã được dừng")
    except Exception as e:
        print(f"❌ Lỗi khi dừng scheduler: {e}")

