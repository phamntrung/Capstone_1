"""
BudgetChecker - Utility để kiểm tra ngân sách và tính toán chi tiêu
"""
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func
from models import Budget, Expense, Category, db


class BudgetChecker:
    """Class để kiểm tra và tính toán ngân sách"""
    
    @staticmethod
    def get_month_string(date_obj: date) -> str:
        """
        Chuyển đổi date object thành format YYYYMM (ví dụ: 2025-01)
        
        Args:
            date_obj: Date object cần chuyển đổi
            
        Returns:
            String format YYYYMM
        """
        return date_obj.strftime("%Y-%m")
    
    @staticmethod
    def get_budget(user_id: int, month: str) -> Optional[Budget]:
        """
        Lấy budget của user cho tháng cụ thể
        
        Args:
            user_id: ID của user
            month: Tháng theo format YYYY-MM (ví dụ: 2025-01)
            
        Returns:
            Budget object hoặc None nếu không tìm thấy
        """
        return Budget.query.filter_by(user_id=user_id, month=month).first()
    
    @staticmethod
    def calculate_total_expense(user_id: int, month: str) -> float:
        """
        Tính tổng chi tiêu (expense) của user trong tháng
        
        Args:
            user_id: ID của user
            month: Tháng theo format YYYY-MM (ví dụ: 2025-01)
            
        Returns:
            Tổng chi tiêu (số dương)
        """
        # Parse month string (YYYY-MM) thành year và month
        try:
            year, month_num = map(int, month.split('-'))
            start_date = date(year, month_num, 1)
            # Tính ngày cuối cùng của tháng
            if month_num == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month_num + 1, 1)
        except Exception:
            return 0.0
        
        # Tính tổng chi tiêu (chỉ tính expense, không tính income)
        # Expense có type='expense' hoặc amount < 0
        total = db.session.query(func.sum(func.abs(Expense.amount))).filter(
            Expense.user_id == user_id,
            Expense.date >= start_date,
            Expense.date < end_date,
            (Expense.type == 'expense') | (Expense.amount < 0)
        ).scalar()
        
        return float(total) if total else 0.0
    
    @staticmethod
    def check_budget_status(user_id: int, month: str) -> Dict:
        """
        Kiểm tra trạng thái ngân sách của user trong tháng
        
        Args:
            user_id: ID của user
            month: Tháng theo format YYYY-MM (ví dụ: 2025-01)
            
        Returns:
            Dictionary chứa thông tin:
            - status: 'ok', 'warning', 'exceeded'
            - budget_amount: Số tiền ngân sách
            - total_expense: Tổng chi tiêu
            - percentage: % đã dùng
            - remaining: Số tiền còn lại (âm nếu vượt)
            - exceeded: Số tiền vượt quá (0 nếu chưa vượt)
        """
        budget = BudgetChecker.get_budget(user_id, month)
        total_expense = BudgetChecker.calculate_total_expense(user_id, month)
        
        # Nếu không có budget, trả về status 'ok'
        if not budget or budget.amount <= 0:
            return {
                'status': 'ok',
                'budget_amount': 0.0,
                'total_expense': total_expense,
                'percentage': 0.0,
                'remaining': 0.0,
                'exceeded': 0.0
            }
        
        budget_amount = float(budget.amount)
        percentage = (total_expense / budget_amount * 100) if budget_amount > 0 else 0.0
        remaining = budget_amount - total_expense
        exceeded = max(0.0, total_expense - budget_amount)
        
        # Xác định status
        if total_expense >= budget_amount:
            status = 'exceeded'  # Vượt 100%
        elif total_expense >= budget_amount * 0.8:
            status = 'warning'  # Gần vượt (80-99%)
        else:
            status = 'ok'  # Dưới 80%
        
        return {
            'status': status,
            'budget_amount': budget_amount,
            'total_expense': total_expense,
            'percentage': round(percentage, 2),
            'remaining': round(remaining, 2),
            'exceeded': round(exceeded, 2)
        }
    
    @staticmethod
    def get_top_categories(user_id: int, month: str, limit: int = 5) -> List[Dict]:
        """
        Lấy top danh mục chi tiêu nhiều nhất trong tháng
        
        Args:
            user_id: ID của user
            month: Tháng theo format YYYY-MM (ví dụ: 2025-01)
            limit: Số lượng danh mục cần lấy (mặc định 5)
            
        Returns:
            List các dictionary chứa:
            - category_id: ID danh mục
            - category_name: Tên danh mục
            - total_amount: Tổng chi tiêu trong danh mục
        """
        # Parse month string
        try:
            year, month_num = map(int, month.split('-'))
            start_date = date(year, month_num, 1)
            if month_num == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month_num + 1, 1)
        except Exception:
            return []
        
        # Query để lấy top categories
        results = db.session.query(
            Expense.category_id,
            Category.name,
            func.sum(func.abs(Expense.amount)).label('total')
        ).join(
            Category, Expense.category_id == Category.id, isouter=True
        ).filter(
            Expense.user_id == user_id,
            Expense.date >= start_date,
            Expense.date < end_date,
            (Expense.type == 'expense') | (Expense.amount < 0)
        ).group_by(
            Expense.category_id, Category.name
        ).order_by(
            func.sum(func.abs(Expense.amount)).desc()
        ).limit(limit).all()
        
        # Format kết quả
        top_categories = []
        for result in results:
            category_id, category_name, total_amount = result
            top_categories.append({
                'category_id': category_id,
                'category_name': category_name or 'Không phân loại',
                'total_amount': round(float(total_amount), 2)
            })
        
        return top_categories
    
    @staticmethod
    def get_days_remaining_in_month(month: str) -> int:
        """
        Tính số ngày còn lại trong tháng
        
        Args:
            month: Tháng theo format YYYY-MM (ví dụ: 2025-01)
            
        Returns:
            Số ngày còn lại trong tháng
        """
        try:
            year, month_num = map(int, month.split('-'))
            today = date.today()
            month_date = date(year, month_num, 1)
            
            # Nếu tháng không phải tháng hiện tại, trả về 0
            if today.year != year or today.month != month_num:
                return 0
            
            # Tính ngày cuối cùng của tháng
            if month_num == 12:
                last_day = date(year + 1, 1, 1)
            else:
                last_day = date(year, month_num + 1, 1)
            
            # Số ngày còn lại
            days_remaining = (last_day - today).days
            return max(0, days_remaining)
        except Exception:
            return 0

