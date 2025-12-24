# ========================================
# Script Python dự báo chi tiêu sử dụng Prophet
# ========================================
# 
# Yêu cầu cài đặt:
# pip install prophet pandas
#
# ========================================
import sys
import json
import pandas as pd
from prophet import Prophet

# Đọc dữ liệu từ stdin (JSON)
data = json.loads(sys.stdin.read())

# Chuyển đổi thành DataFrame
df = pd.DataFrame(data)

# Đổi tên cột để phù hợp với Prophet
# Prophet yêu cầu cột 'ds' (date) và 'y' (value)
df.rename(columns={"date": "ds", "amount": "y"}, inplace=True)

# Khởi tạo và train model Prophet
m = Prophet()
m.fit(df)

# Tạo dữ liệu tương lai (30 ngày tiếp theo)
future = m.make_future_dataframe(periods=30)

# Dự báo
forecast = m.predict(future)

# Lấy 30 ngày cuối cùng (dự báo) và chuyển thành JSON
# Chỉ lấy cột 'ds' (date) và 'yhat' (dự báo)
result = forecast.tail(30)[["ds", "yhat"]].to_json(orient="records")

# In ra stdout để Node.js đọc được
print(result)

