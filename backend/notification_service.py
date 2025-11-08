"""
NotificationService - Service để xử lý logic thông báo và gửi email
"""
from datetime import datetime, date, timedelta
from typing import Optional, Dict
from models import User, Notification, Expense, db
from email_service import email_service
from utils.budget_checker import BudgetChecker


class NotificationService:
    """Service để xử lý các loại thông báo"""
    
    # Tránh spam: chỉ gửi 1 lần/ngày cho cùng 1 loại cảnh báo
    @staticmethod
    def _should_send_notification(user_id: int, notification_type: str) -> bool:
        """
        Kiểm tra xem có nên gửi thông báo không (tránh spam)
        
        Args:
            user_id: ID của user
            notification_type: Loại thông báo (ví dụ: 'budget_exceeded', 'budget_warning')
            
        Returns:
            True nếu nên gửi, False nếu đã gửi hôm nay
        """
        today = date.today()
        # Kiểm tra xem đã gửi thông báo cùng loại hôm nay chưa
        existing = Notification.query.filter_by(
            user_id=user_id,
            type=notification_type
        ).filter(
            db.func.date(Notification.created_at) == today
        ).first()
        
        return existing is None
    
    @staticmethod
    def check_and_notify_budget(user_id: int, expense_date: Optional[date] = None) -> Optional[Notification]:
        """
        Kiểm tra ngân sách và gửi thông báo nếu cần
        
        Args:
            user_id: ID của user
            expense_date: Ngày của expense (dùng để xác định tháng cần kiểm tra)
            
        Returns:
            Notification object nếu đã gửi, None nếu không cần gửi
        """
        try:
            # Xác định tháng cần kiểm tra
            if expense_date:
                month = BudgetChecker.get_month_string(expense_date)
            else:
                month = BudgetChecker.get_month_string(date.today())
            
            # Kiểm tra trạng thái ngân sách
            budget_status = BudgetChecker.check_budget_status(user_id, month)
            
            # Lấy thông tin user
            user = User.query.get(user_id)
            if not user or not user.email:
                return None
            
            # Kiểm tra và gửi thông báo dựa trên status
            notification = None
            
            if budget_status['status'] == 'exceeded':
                # Vượt 100% ngân sách
                if NotificationService._should_send_notification(user_id, 'error'):
                    notification = NotificationService._send_budget_exceeded_notification(
                        user, budget_status, month
                    )
            elif budget_status['status'] == 'warning':
                # Gần vượt (80-99%)
                if NotificationService._should_send_notification(user_id, 'warning'):
                    notification = NotificationService._send_budget_warning_notification(
                        user, budget_status, month
                    )
            
            return notification
        except Exception as e:
            print(f"❌ Lỗi khi kiểm tra và gửi thông báo ngân sách: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def _send_budget_exceeded_notification(user: User, budget_status: Dict, month: str) -> Notification:
        """
        Gửi thông báo vượt ngân sách
        
        Args:
            user: User object
            budget_status: Dictionary chứa thông tin ngân sách
            month: Tháng theo format YYYY-MM
            
        Returns:
            Notification object
        """
        # Lấy top categories
        top_categories = BudgetChecker.get_top_categories(user.id, month, limit=5)
        days_remaining = BudgetChecker.get_days_remaining_in_month(month)
        
        # Format số tiền
        currency = user.currency or 'đ'
        budget_amount_str = f"{budget_status['budget_amount']:,.0f}{currency}"
        total_expense_str = f"{budget_status['total_expense']:,.0f}{currency}"
        exceeded_str = f"{budget_status['exceeded']:,.0f}{currency}"
        
        # Tạo nội dung thông báo
        title = "⚠️ CẢNH BÁO: Bạn đã vượt ngân sách!"
        message = f"""
Bạn đã vượt ngân sách tháng {month}!

📊 Thông tin chi tiết:
• Ngân sách tháng: {budget_amount_str}
• Đã chi tiêu: {total_expense_str}
• Vượt quá: {exceeded_str} ({budget_status['percentage']:.1f}%)
• Còn lại trong tháng: {days_remaining} ngày

💡 Gợi ý:
• Xem lại các khoản chi tiêu không cần thiết
• Điều chỉnh ngân sách nếu cần
• Theo dõi chi tiêu hàng ngày để tránh vượt quá
"""
        
        # Thêm top categories nếu có
        if top_categories:
            message += "\n📋 Top danh mục chi tiêu:\n"
            for i, cat in enumerate(top_categories, 1):
                message += f"{i}. {cat['category_name']}: {cat['total_amount']:,.0f}{currency}\n"
        
        # Gửi thông báo
        notification = email_service.send_notification(
            user_id=user.id,
            user_email=user.email,
            title=title,
            message=message.strip(),
            notification_type='error',
            send_email=True
        )
        
        print(f"✅ Đã gửi thông báo vượt ngân sách cho user {user.email}")
        return notification
    
    @staticmethod
    def _send_budget_warning_notification(user: User, budget_status: Dict, month: str) -> Notification:
        """
        Gửi thông báo cảnh báo gần vượt ngân sách
        
        Args:
            user: User object
            budget_status: Dictionary chứa thông tin ngân sách
            month: Tháng theo format YYYY-MM
            
        Returns:
            Notification object
        """
        # Lấy top categories
        top_categories = BudgetChecker.get_top_categories(user.id, month, limit=5)
        days_remaining = BudgetChecker.get_days_remaining_in_month(month)
        
        # Format số tiền
        currency = user.currency or 'đ'
        budget_amount_str = f"{budget_status['budget_amount']:,.0f}{currency}"
        total_expense_str = f"{budget_status['total_expense']:,.0f}{currency}"
        remaining_str = f"{budget_status['remaining']:,.0f}{currency}"
        
        # Tạo nội dung thông báo
        title = "⚠️ Cảnh báo: Bạn sắp vượt ngân sách!"
        message = f"""
Bạn đã sử dụng {budget_status['percentage']:.1f}% ngân sách tháng {month}!

📊 Thông tin chi tiết:
• Ngân sách tháng: {budget_amount_str}
• Đã chi tiêu: {total_expense_str}
• Còn lại: {remaining_str}
• Còn lại trong tháng: {days_remaining} ngày

💡 Gợi ý:
• Hãy cẩn thận với các khoản chi tiêu tiếp theo
• Xem lại các khoản chi tiêu không cần thiết
• Điều chỉnh ngân sách nếu cần
"""
        
        # Thêm top categories nếu có
        if top_categories:
            message += "\n📋 Top danh mục chi tiêu:\n"
            for i, cat in enumerate(top_categories, 1):
                message += f"{i}. {cat['category_name']}: {cat['total_amount']:,.0f}{currency}\n"
        
        # Gửi thông báo
        notification = email_service.send_notification(
            user_id=user.id,
            user_email=user.email,
            title=title,
            message=message.strip(),
            notification_type='warning',
            send_email=True
        )
        
        print(f"✅ Đã gửi thông báo cảnh báo ngân sách cho user {user.email}")
        return notification
    
    @staticmethod
    def send_daily_summary(user_id: int, summary_date: Optional[date] = None) -> Optional[Notification]:
        """
        Gửi tóm tắt chi tiêu hàng ngày
        
        Args:
            user_id: ID của user
            summary_date: Ngày cần tóm tắt (mặc định là hôm qua)
            
        Returns:
            Notification object nếu đã gửi, None nếu không có chi tiêu
        """
        try:
            if summary_date is None:
                summary_date = date.today() - timedelta(days=1)
            
            user = User.query.get(user_id)
            if not user or not user.email:
                return None
            
            # Lấy tất cả expense của ngày
            expenses = Expense.query.filter_by(
                user_id=user_id
            ).filter(
                Expense.date == summary_date,
                (Expense.type == 'expense') | (Expense.amount < 0)
            ).all()
            
            if not expenses:
                return None  # Không có chi tiêu, không gửi
            
            # Tính tổng
            total = sum(abs(e.amount) for e in expenses)
            currency = user.currency or 'đ'
            
            title = f"📊 Tóm tắt chi tiêu ngày {summary_date.strftime('%d/%m/%Y')}"
            message = f"""
Bạn đã chi tiêu {total:,.0f}{currency} trong ngày {summary_date.strftime('%d/%m/%Y')}.

📋 Chi tiết:
• Tổng số giao dịch: {len(expenses)}
• Tổng chi tiêu: {total:,.0f}{currency}

💡 Hãy tiếp tục theo dõi chi tiêu để quản lý ngân sách hiệu quả!
"""
            
            notification = email_service.send_notification(
                user_id=user_id,
                user_email=user.email,
                title=title,
                message=message.strip(),
                notification_type='info',
                send_email=True
            )
            
            print(f"✅ Đã gửi tóm tắt hàng ngày cho user {user.email}")
            return notification
        except Exception as e:
            print(f"❌ Lỗi khi gửi tóm tắt hàng ngày: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def send_weekly_report(user_id: int) -> Optional[Notification]:
        """
        Gửi báo cáo hàng tuần
        
        Args:
            user_id: ID của user
            
        Returns:
            Notification object nếu đã gửi, None nếu không có chi tiêu
        """
        try:
            user = User.query.get(user_id)
            if not user or not user.email:
                return None
            
            # Tính tuần trước (7 ngày gần nhất)
            today = date.today()
            week_start = today - timedelta(days=7)
            
            # Lấy tất cả expense trong tuần
            expenses = Expense.query.filter_by(
                user_id=user_id
            ).filter(
                Expense.date >= week_start,
                Expense.date < today,
                (Expense.type == 'expense') | (Expense.amount < 0)
            ).all()
            
            if not expenses:
                return None
            
            # Tính tổng
            total = sum(abs(e.amount) for e in expenses)
            currency = user.currency or 'đ'
            
            title = f"📊 Báo cáo chi tiêu tuần qua"
            message = f"""
Báo cáo chi tiêu tuần qua (từ {week_start.strftime('%d/%m/%Y')} đến {today.strftime('%d/%m/%Y')}):

📊 Thống kê:
• Tổng số giao dịch: {len(expenses)}
• Tổng chi tiêu: {total:,.0f}{currency}
• Trung bình mỗi ngày: {total/7:,.0f}{currency}

💡 Hãy tiếp tục theo dõi chi tiêu để quản lý ngân sách hiệu quả!
"""
            
            notification = email_service.send_notification(
                user_id=user_id,
                user_email=user.email,
                title=title,
                message=message.strip(),
                notification_type='info',
                send_email=True
            )
            
            print(f"✅ Đã gửi báo cáo tuần cho user {user.email}")
            return notification
        except Exception as e:
            print(f"❌ Lỗi khi gửi báo cáo tuần: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def send_monthly_report(user_id: int, report_month: Optional[str] = None) -> Optional[Notification]:
        """
        Gửi báo cáo hàng tháng
        
        Args:
            user_id: ID của user
            report_month: Tháng cần báo cáo (format YYYY-MM), mặc định là tháng trước
            
        Returns:
            Notification object nếu đã gửi, None nếu không có chi tiêu
        """
        try:
            user = User.query.get(user_id)
            if not user or not user.email:
                return None
            
            # Xác định tháng cần báo cáo
            if report_month is None:
                today = date.today()
                if today.month == 1:
                    report_month = f"{today.year - 1}-12"
                else:
                    report_month = f"{today.year}-{today.month - 1:02d}"
            
            # Parse month
            year, month_num = map(int, report_month.split('-'))
            month_start = date(year, month_num, 1)
            if month_num == 12:
                month_end = date(year + 1, 1, 1)
            else:
                month_end = date(year, month_num + 1, 1)
            
            # Lấy tất cả expense trong tháng
            expenses = Expense.query.filter_by(
                user_id=user_id
            ).filter(
                Expense.date >= month_start,
                Expense.date < month_end,
                (Expense.type == 'expense') | (Expense.amount < 0)
            ).all()
            
            if not expenses:
                return None
            
            # Tính tổng và lấy budget
            total = sum(abs(e.amount) for e in expenses)
            budget = BudgetChecker.get_budget(user_id, report_month)
            budget_amount = budget.amount if budget else 0
            currency = user.currency or 'đ'
            
            # Tính % so với budget
            percentage = (total / budget_amount * 100) if budget_amount > 0 else 0
            
            title = f"📊 Báo cáo chi tiêu tháng {report_month}"
            message = f"""
Báo cáo chi tiêu tháng {report_month}:

📊 Thống kê:
• Tổng số giao dịch: {len(expenses)}
• Tổng chi tiêu: {total:,.0f}{currency}
• Ngân sách: {budget_amount:,.0f}{currency}
• % so với ngân sách: {percentage:.1f}%

💡 Hãy tiếp tục theo dõi chi tiêu để quản lý ngân sách hiệu quả!
"""
            
            notification = email_service.send_notification(
                user_id=user_id,
                user_email=user.email,
                title=title,
                message=message.strip(),
                notification_type='info',
                send_email=True
            )
            
            print(f"✅ Đã gửi báo cáo tháng cho user {user.email}")
            return notification
        except Exception as e:
            print(f"❌ Lỗi khi gửi báo cáo tháng: {e}")
            import traceback
            traceback.print_exc()
            return None

