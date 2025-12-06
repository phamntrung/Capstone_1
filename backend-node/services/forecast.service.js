// ========================================
// Service dự báo chi tiêu sử dụng Python ML model
// ========================================
const { spawn } = require("child_process");
const path = require("path");

/**
 * Dự báo chi tiêu trong tương lai sử dụng Prophet model
 * @param {Array} data - Mảng các object {date, amount}
 * @returns {Promise<Array>} - Mảng dự báo {ds, yhat}
 */
exports.predictSpending = (data) => {
    return new Promise((resolve, reject) => {
        // Đường dẫn đến file Python forecast
        const pythonScript = path.join(__dirname, "../ml/forecast.py");

        // Chạy Python script
        const py = spawn("python", [pythonScript]);

        let result = "";  // Chứa kết quả từ Python
        let errorOutput = "";  // Chứa lỗi từ Python

        // Gửi dữ liệu vào stdin của Python process
        py.stdin.write(JSON.stringify(data));
        py.stdin.end();

        // Nhận output từ Python
        py.stdout.on("data", (chunk) => {
            result += chunk.toString();
        });

        // Nhận lỗi từ Python
        py.stderr.on("data", (err) => {
            errorOutput += err.toString();
            console.error("Python error:", err.toString());
        });

        // Xử lý khi Python process kết thúc
        py.on("close", (code) => {
            if (code !== 0) {
                // Nếu có lỗi, reject promise
                reject(new Error(`Python script exited with code ${code}: ${errorOutput}`));
                return;
            }

            try {
                // Parse JSON từ kết quả Python
                const parsed = JSON.parse(result);
                resolve(parsed);
            } catch (parseError) {
                // Nếu không parse được JSON, reject
                reject(new Error(`Failed to parse Python output: ${parseError.message}`));
            }
        });

        // Xử lý lỗi khi spawn process
        py.on("error", (err) => {
            reject(new Error(`Failed to start Python process: ${err.message}`));
        });
    });
};

