// ========================================
// Model định nghĩa cấu trúc bảng Expense trong database
// ========================================
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Định nghĩa model Expense
const Expense = sequelize.define("Expense", {
    // ID tự động tăng, là khóa chính
    id: { 
        type: DataTypes.INTEGER, 
        autoIncrement: true, 
        primaryKey: true 
    },

    // ID người dùng (bắt buộc)
    userId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },

    // Danh mục chi tiêu (bắt buộc)
    category: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },

    // Số tiền (bắt buộc)
    amount: { 
        type: DataTypes.FLOAT, 
        allowNull: false 
    },

    // Ghi chú (tùy chọn)
    note: { 
        type: DataTypes.TEXT 
    },

    // Ngày chi tiêu (mặc định là ngày hiện tại)
    date: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    // Tên bảng trong database
    tableName: "expenses",
    // Không tự động thêm timestamps (createdAt, updatedAt)
    timestamps: false
});

// Export model để sử dụng
module.exports = Expense;

