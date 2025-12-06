/**
 * Voice Recognition Service cho SmartExpense
 * Sử dụng Web Speech API để nhận diện giọng nói và tự động tạo chi tiêu
 */

class VoiceService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.onResultCallback = null;
        this.onErrorCallback = null;
        this.supported = false;
        
        this.init();
    }
    
    init() {
        // Kiểm tra browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('⚠️ Voice recognition không được hỗ trợ trên browser này');
            this.supported = false;
            return;
        }
        
        this.supported = true;
        this.recognition = new SpeechRecognition();
        
        // Cấu hình - cải thiện để nghe tốt hơn
        this.recognition.continuous = true; // Nghe liên tục để đảm bảo bắt được giọng nói
        this.recognition.interimResults = true; // Hiển thị kết quả tạm thời
        this.recognition.lang = 'vi-VN'; // Tiếng Việt
        this.recognition.maxAlternatives = 1; // Chỉ lấy 1 kết quả tốt nhất
        
        // Timeout để tự động dừng sau 10 giây nếu không có giọng nói
        this.timeoutId = null;
        
        // Event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            console.log('✅ onstart: Bắt đầu nghe...');
            console.log('✅ Recognition state:', this.recognition.state);
            
            // Set timeout để tự động dừng sau 15 giây (nếu không có giọng nói)
            this.timeoutId = setTimeout(() => {
                if (this.isListening) {
                    console.log('⏱️ Timeout: Tự động dừng sau 15 giây');
                    this.stopListening();
                    if (this.onErrorCallback) {
                        this.onErrorCallback('Không phát hiện giọng nói sau 15 giây. Vui lòng nói rõ ràng và thử lại.');
                    }
                }
            }, 15000);
        };
        
        this.recognition.onresult = (event) => {
            console.log('📝 onresult event triggered:', event);
            console.log('📝 Results length:', event.results.length);
            console.log('📝 Result index:', event.resultIndex);
            
            // Lấy kết quả cuối cùng (final result)
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.length > 0) {
                    const transcript = result[0].transcript;
                    if (result.isFinal) {
                        finalTranscript += transcript + ' ';
                        console.log('📝 Final result:', transcript);
                    } else {
                        interimTranscript += transcript;
                        console.log('📝 Interim result:', transcript);
                    }
                }
            }
            
            // Nếu có kết quả cuối cùng, xử lý ngay
            if (finalTranscript.trim()) {
                console.log('✅ Nhận diện thành công (final):', finalTranscript.trim());
                
                // Clear timeout
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                    this.timeoutId = null;
                }
                
                // Dừng nghe ngay khi có kết quả cuối cùng
                this.stopListening();
                
                // Gọi callback với text đã nhận diện
                if (this.onResultCallback) {
                    this.onResultCallback(finalTranscript.trim());
                } else {
                    // Nếu không có callback, tự động xử lý
                    this.handleVoiceResult(finalTranscript.trim());
                }
            } else if (interimTranscript) {
                console.log('📝 Đang nghe (interim):', interimTranscript);
                // Có thể hiển thị interim result cho user nếu muốn
            } else {
                console.warn('⚠️ Không có transcript nào');
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('❌ onerror event triggered:', event);
            console.error('❌ Error type:', event.error);
            console.error('❌ Error message:', event.message);
            console.error('❌ Recognition state:', this.recognition?.state);
            this.isListening = false;
            
            // Clear timeout
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            
            let errorMessage = 'Lỗi nhận diện giọng nói';
            switch(event.error) {
                case 'no-speech':
                    errorMessage = 'Không phát hiện giọng nói. Vui lòng nói rõ hơn và thử lại.';
                    console.warn('⚠️ No speech detected');
                    break;
                case 'audio-capture':
                    errorMessage = 'Không thể truy cập microphone. Vui lòng kiểm tra quyền và thử lại.';
                    console.error('❌ Audio capture failed');
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone bị chặn. Vui lòng cho phép truy cập microphone trong cài đặt browser.';
                    console.error('❌ Microphone not allowed');
                    break;
                case 'network':
                    errorMessage = 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.';
                    console.error('❌ Network error');
                    break;
                case 'aborted':
                    // User đã dừng, không cần hiển thị lỗi
                    console.log('🛑 Recognition aborted by user');
                    return;
                default:
                    errorMessage = `Lỗi: ${event.error}. Vui lòng thử lại.`;
                    console.error('❌ Unknown error:', event.error);
            }
            
            if (this.onErrorCallback) {
                this.onErrorCallback(errorMessage);
            }
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            console.log('🛑 onend: Dừng nghe');
            console.log('🛑 Recognition state:', this.recognition?.state);
            
            // Clear timeout
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
        };
    }
    
    /**
     * Kiểm tra quyền microphone
     * @returns {Promise<boolean>}
     */
    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Nếu có quyền, dừng stream ngay
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('❌ Không có quyền microphone:', error);
            return false;
        }
    }
    
    /**
     * Bắt đầu nhận diện giọng nói
     * @param {Function} onResult - Callback khi nhận diện thành công
     * @param {Function} onError - Callback khi có lỗi
     */
    async startListening(onResult, onError) {
        if (!this.supported) {
            if (onError) {
                onError('Voice recognition không được hỗ trợ trên browser này. Vui lòng sử dụng Chrome hoặc Edge.');
            }
            return false;
        }
        
        if (this.isListening) {
            console.warn('⚠️ Đang nghe rồi');
            return false;
        }
        
        // Kiểm tra quyền microphone trước
        const hasPermission = await this.checkMicrophonePermission();
        if (!hasPermission) {
            if (onError) {
                onError('Microphone bị chặn. Vui lòng cho phép truy cập microphone trong cài đặt browser và thử lại.');
            }
            return false;
        }
        
        this.onResultCallback = onResult;
        this.onErrorCallback = onError;
        
        try {
            console.log('🔄 Chuẩn bị start recognition...');
            const currentState = this.recognition?.state || 'unknown';
            console.log('🔄 Current state:', currentState);
            console.log('🔄 isListening:', this.isListening);
            
            // Reset recognition nếu cần
            if (this.recognition) {
                // Chỉ stop nếu đang chạy
                if (currentState === 'listening' || currentState === 'starting') {
                    console.log('🛑 Stopping existing recognition...');
                    try {
                        this.recognition.stop();
                        // Đợi recognition dừng hoàn toàn
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (e) {
                        console.warn('⚠️ Lỗi khi stop:', e);
                    }
                }
            }
            
            console.log('▶️ Calling recognition.start()...');
            try {
                this.recognition.start();
                const newState = this.recognition?.state || 'unknown';
                console.log('✅ recognition.start() called, state:', newState);
                
                // Đợi một chút để xem có event nào được trigger không
                await new Promise(resolve => setTimeout(resolve, 1000));
                const finalState = this.recognition?.state || 'unknown';
                console.log('⏱️ After 1000ms, state:', finalState, 'isListening:', this.isListening);
                
                // Nếu sau 1 giây mà vẫn chưa có onstart, có thể có vấn đề
                if (!this.isListening && finalState !== 'listening' && finalState !== 'starting') {
                    console.warn('⚠️ Recognition có vẻ không start được. State:', finalState);
                }
            } catch (startError) {
                console.error('❌ Lỗi khi gọi start():', startError);
                throw startError;
            }
            
            return true;
        } catch (error) {
            console.error('❌ Lỗi khi bắt đầu nghe:', error);
            console.error('❌ Error name:', error.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error stack:', error.stack);
            
            // Nếu lỗi là "already started", thử stop và start lại
            if (error.name === 'InvalidStateError' || error.message.includes('already started')) {
                console.log('🔄 Retrying after InvalidStateError...');
                try {
                    this.recognition.stop();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    console.log('▶️ Retry: Calling recognition.start()...');
                    this.recognition.start();
                    console.log('✅ Retry: recognition.start() called');
                    return true;
                } catch (retryError) {
                    console.error('❌ Lỗi khi retry:', retryError);
                }
            }
            
            if (onError) {
                onError('Không thể bắt đầu nhận diện giọng nói. Vui lòng thử lại.');
            }
            return false;
        }
    }
    
    /**
     * Dừng nhận diện giọng nói
     */
    stopListening() {
        if (this.recognition) {
            try {
                if (this.isListening) {
                    this.recognition.stop();
                }
            } catch (error) {
                console.warn('⚠️ Lỗi khi dừng recognition:', error);
            }
        }
        
        this.isListening = false;
        
        // Clear timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    
    /**
     * Kiểm tra xem browser có hỗ trợ không
     */
    isSupported() {
        return this.supported;
    }
    
    /**
     * Kiểm tra xem đang nghe không
     */
    getIsListening() {
        return this.isListening;
    }

    /**
     * Xử lý kết quả nhận diện giọng nói - gọi API để phân tích và auto điền form
     * @param {string} text - Text đã nhận diện từ giọng nói
     */
    async handleVoiceResult(text) {
        if (!text || !text.trim()) {
            console.warn('⚠️ Empty text from voice recognition');
            return;
        }

        console.log('🎤 Processing voice result:', text);

        try {
            // Kiểm tra auth
            const auth = typeof window.checkAuth === 'function' ? window.checkAuth() : null;
            if (!auth) {
                console.error('❌ User not authenticated');
                this.showError('Vui lòng đăng nhập để sử dụng tính năng này');
                return;
            }

            // Gọi API để phân tích text
            const apiRequest = typeof window.apiRequest === 'function' ? window.apiRequest : null;
            if (!apiRequest) {
                console.error('❌ apiRequest function not available');
                this.showError('Lỗi: Không thể kết nối với server');
                return;
            }

            // Show loading indicator
            this.showLoading('Đang phân tích...');

            // Call API
            const result = await apiRequest('/api/ai/classify', {
                method: 'POST',
                body: JSON.stringify({ text: text.trim() })
            });

            if (!result || !result.ok) {
                const errorMsg = result?.data?.message || 'Lỗi khi phân tích giọng nói';
                console.error('❌ API error:', errorMsg);
                this.showError(errorMsg);
                return;
            }

            const data = result.data;
            console.log('✅ Classified data:', data);

            // Validate amount
            if (!data.amount || data.amount <= 0) {
                this.showError('Không thể xác định số tiền. Vui lòng nói rõ hơn, ví dụ: "Cà phê 50000"');
                return;
            }

            // Auto fill form
            this.autoFillExpenseForm(data);

        } catch (error) {
            console.error('❌ Error processing voice result:', error);
            this.showError('Lỗi: ' + (error.message || 'Không thể xử lý giọng nói'));
        }
    }

    /**
     * Tự động điền form chi tiêu
     * @param {object} data - Dữ liệu từ API: {amount, category, categoryName, note, categoryId}
     */
    autoFillExpenseForm(data) {
        try {
            // Tìm input field
            const input = document.getElementById('quickExpenseInput');
            if (!input) {
                console.warn('⚠️ quickExpenseInput not found');
                this.showError('Không tìm thấy form nhập chi tiêu');
                return;
            }

            // Format text để hiển thị trong input
            // Format: "note amount" - không format số tiền để parseExpenseInput có thể parse đúng
            // parseExpenseInput sẽ parse format "note 30000" hoặc "note 30,000"
            const amountValue = typeof data.amount === 'number' 
                ? data.amount 
                : parseFloat(data.amount) || 0;
            
            let displayText = '';
            if (data.note && data.note.trim() && data.note.trim() !== 'Không xác định') {
                // Điền format: "note amount" (ví dụ: "ăn uống 30000")
                // parseExpenseInput sẽ parse đúng format này
                displayText = `${data.note.trim()} ${amountValue}`;
            } else {
                displayText = String(amountValue);
            }

            // Điền vào input
            input.value = displayText;
            
            // Trigger input event để các listener khác có thể xử lý
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Show success message
            this.showSuccess(`Đã điền: ${displayText}`);

            // Tự động submit sau 500ms (để user có thể xem trước)
            setTimeout(() => {
                const btn = document.getElementById('quickExpenseBtn');
                if (btn && typeof btn.click === 'function') {
                    btn.click();
                } else if (typeof window.handleQuickAddExpense === 'function') {
                    window.handleQuickAddExpense();
                } else {
                    // Fallback: trigger Enter key
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true
                    });
                    input.dispatchEvent(enterEvent);
                }
            }, 500);

        } catch (error) {
            console.error('❌ Error auto-filling form:', error);
            this.showError('Lỗi khi điền form: ' + error.message);
        }
    }

    /**
     * Hiển thị thông báo lỗi
     * @param {string} message 
     */
    showError(message) {
        console.error('❌ Voice Service Error:', message);
        // Có thể hiển thị toast notification nếu có
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'error');
        } else {
            // Fallback: alert
            alert('❌ ' + message);
        }
    }

    /**
     * Hiển thị thông báo thành công
     * @param {string} message 
     */
    showSuccess(message) {
        console.log('✅ Voice Service Success:', message);
        // Có thể hiển thị toast notification nếu có
        if (typeof window.showToast === 'function') {
            window.showToast(message, 'success');
        }
    }

    /**
     * Hiển thị loading indicator
     * @param {string} message 
     */
    showLoading(message) {
        console.log('⏳ Voice Service Loading:', message);
        // Có thể hiển thị loading indicator nếu có
        if (typeof window.showLoading === 'function') {
            window.showLoading(message);
        }
    }
}

// Export singleton instance
window.VoiceService = VoiceService;
window.voiceService = new VoiceService();

