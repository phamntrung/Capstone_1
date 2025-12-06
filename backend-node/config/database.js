    // ========================================
    // Cấu hình kết nối database với Sequelize
    // ========================================
    const { Sequelize } = require("sequelize");

    // Export instance Sequelize để sử dụng trong models
    module.exports = new Sequelize(
        "smart_expense",   // Tên database
        "root",         // Username MySQL
        "",             // Mật khẩu (để trống nếu không có)
        {
            host: "localhost",      // Host MySQL
            dialect: "mysql",       // Loại database
            logging: false           // Tắt log SQL queries (đặt true để debug)
        }
    );

