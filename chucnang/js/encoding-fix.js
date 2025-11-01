/**
 * Encoding Fix - Sửa lỗi hiển thị ký tự tiếng Việt
 */

class EncodingFix {
    constructor() {
        this.init();
    }

    init() {
        // Fix encoding on page load
        this.fixPageEncoding();
        
        // Fix encoding for dynamic content
        this.observeChanges();
        
        // Fix user data encoding
        this.fixUserDataEncoding();
    }

    fixPageEncoding() {
        // Ensure proper encoding for all text elements
        const textElements = document.querySelectorAll('*');
        textElements.forEach(element => {
            if (element.textContent) {
                this.fixTextContent(element);
            }
        });
    }

    fixTextContent(element) {
        const text = element.textContent;
        
        // Common Vietnamese character fixes
        const fixes = {
            'Pháº¡m': 'Phạm',
            'Ngá»c': 'Ngọc',
            'Trung': 'Trung',
            'áº¡': 'ạ',
            'áº£': 'ả',
            'áº½': 'ã',
            'áº¹': 'á',
            'áº ': 'à',
            'áº¢': 'ă',
            'áº¯': 'ắ',
            'áº±': 'ằ',
            'áº³': 'ẳ',
            'áºµ': 'ẵ',
            'áº·': 'ặ',
            'áº¢': 'â',
            'áº¥': 'ấ',
            'áº§': 'ầ',
            'áº©': 'ẩ',
            'áº«': 'ẫ',
            'áº­': 'ậ',
            'áº©': 'é',
            'áº»': 'è',
            'áº¹': 'ẻ',
            'áº½': 'ẽ',
            'áº¹': 'ẹ',
            'áº©': 'ê',
            'áº¿': 'ế',
            'áº¡': 'ề',
            'áº£': 'ể',
            'áºµ': 'ễ',
            'áº·': 'ệ',
            'áº©': 'í',
            'áº¬': 'ì',
            'áº®': 'ỉ',
            'áº°': 'ĩ',
            'áº²': 'ị',
            'áº©': 'ó',
            'áº²': 'ò',
            'áº': 'ỏ',
            'áºµ': 'õ',
            'áº¹': 'ọ',
            'áº©': 'ô',
            'áº': 'ố',
            'áº': 'ồ',
            'áº': 'ổ',
            'áº': 'ỗ',
            'áº': 'ộ',
            'áº©': 'ơ',
            'áº': 'ớ',
            'áº': 'ờ',
            'áº': 'ở',
            'áº': 'ỡ',
            'áº': 'ợ',
            'áº©': 'ú',
            'áº': 'ù',
            'áº': 'ủ',
            'áº': 'ũ',
            'áº': 'ụ',
            'áº©': 'ư',
            'áº': 'ứ',
            'áº': 'ừ',
            'áº': 'ử',
            'áº': 'ữ',
            'áº': 'ự',
            'áº©': 'ý',
            'áº': 'ỳ',
            'áº': 'ỷ',
            'áº': 'ỹ',
            'áº': 'ỵ',
            'áº': 'đ'
        };

        let fixedText = text;
        Object.entries(fixes).forEach(([wrong, correct]) => {
            fixedText = fixedText.replace(new RegExp(wrong, 'g'), correct);
        });

        if (fixedText !== text) {
            element.textContent = fixedText;
        }
    }

    observeChanges() {
        // Watch for dynamic content changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.fixTextContent(node);
                        }
                    });
                } else if (mutation.type === 'characterData') {
                    this.fixTextContent(mutation.target.parentElement);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    fixUserDataEncoding() {
        // Fix user data in localStorage
        try {
            const userData = localStorage.getItem('smartexpense_user');
            if (userData) {
                const user = JSON.parse(userData);
                if (user.name) {
                    // Fix common encoding issues in user names
                    const fixes = {
                        'Pháº¡m': 'Phạm',
                        'Ngá»c': 'Ngọc',
                        'áº¡': 'ạ',
                        'áº£': 'ả',
                        'áº½': 'ã',
                        'áº¹': 'á',
                        'áº ': 'à',
                        'áº¢': 'ă',
                        'áº¯': 'ắ',
                        'áº±': 'ằ',
                        'áº³': 'ẳ',
                        'áºµ': 'ẵ',
                        'áº·': 'ặ',
                        'áº¢': 'â',
                        'áº¥': 'ấ',
                        'áº§': 'ầ',
                        'áº©': 'ẩ',
                        'áº«': 'ẫ',
                        'áº­': 'ậ',
                        'áº©': 'é',
                        'áº»': 'è',
                        'áº¹': 'ẻ',
                        'áº½': 'ẽ',
                        'áº¹': 'ẹ',
                        'áº©': 'ê',
                        'áº¿': 'ế',
                        'áº¡': 'ề',
                        'áº£': 'ể',
                        'áºµ': 'ễ',
                        'áº·': 'ệ',
                        'áº©': 'í',
                        'áº¬': 'ì',
                        'áº®': 'ỉ',
                        'áº°': 'ĩ',
                        'áº²': 'ị',
                        'áº©': 'ó',
                        'áº²': 'ò',
                        'áº': 'ỏ',
                        'áºµ': 'õ',
                        'áº¹': 'ọ',
                        'áº©': 'ô',
                        'áº': 'ố',
                        'áº': 'ồ',
                        'áº': 'ổ',
                        'áº': 'ỗ',
                        'áº': 'ộ',
                        'áº©': 'ơ',
                        'áº': 'ớ',
                        'áº': 'ờ',
                        'áº': 'ở',
                        'áº': 'ỡ',
                        'áº': 'ợ',
                        'áº©': 'ú',
                        'áº': 'ù',
                        'áº': 'ủ',
                        'áº': 'ũ',
                        'áº': 'ụ',
                        'áº©': 'ư',
                        'áº': 'ứ',
                        'áº': 'ừ',
                        'áº': 'ử',
                        'áº': 'ữ',
                        'áº': 'ự',
                        'áº©': 'ý',
                        'áº': 'ỳ',
                        'áº': 'ỷ',
                        'áº': 'ỹ',
                        'áº': 'ỵ',
                        'áº': 'đ'
                    };

                    let fixedName = user.name;
                    Object.entries(fixes).forEach(([wrong, correct]) => {
                        fixedName = fixedName.replace(new RegExp(wrong, 'g'), correct);
                    });

                    if (fixedName !== user.name) {
                        user.name = fixedName;
                        localStorage.setItem('smartexpense_user', JSON.stringify(user));
                        console.log('Fixed user name encoding:', user.name);
                    }
                }
            }
        } catch (error) {
            console.error('Error fixing user data encoding:', error);
        }
    }

    // Public method to fix specific text
    fixText(text) {
        const fixes = {
            'Pháº¡m': 'Phạm',
            'Ngá»c': 'Ngọc',
            'áº¡': 'ạ',
            'áº£': 'ả',
            'áº½': 'ã',
            'áº¹': 'á',
            'áº ': 'à',
            'áº¢': 'ă',
            'áº¯': 'ắ',
            'áº±': 'ằ',
            'áº³': 'ẳ',
            'áºµ': 'ẵ',
            'áº·': 'ặ',
            'áº¢': 'â',
            'áº¥': 'ấ',
            'áº§': 'ầ',
            'áº©': 'ẩ',
            'áº«': 'ẫ',
            'áº­': 'ậ',
            'áº©': 'é',
            'áº»': 'è',
            'áº¹': 'ẻ',
            'áº½': 'ẽ',
            'áº¹': 'ẹ',
            'áº©': 'ê',
            'áº¿': 'ế',
            'áº¡': 'ề',
            'áº£': 'ể',
            'áºµ': 'ễ',
            'áº·': 'ệ',
            'áº©': 'í',
            'áº¬': 'ì',
            'áº®': 'ỉ',
            'áº°': 'ĩ',
            'áº²': 'ị',
            'áº©': 'ó',
            'áº²': 'ò',
            'áº': 'ỏ',
            'áºµ': 'õ',
            'áº¹': 'ọ',
            'áº©': 'ô',
            'áº': 'ố',
            'áº': 'ồ',
            'áº': 'ổ',
            'áº': 'ỗ',
            'áº': 'ộ',
            'áº©': 'ơ',
            'áº': 'ớ',
            'áº': 'ờ',
            'áº': 'ở',
            'áº': 'ỡ',
            'áº': 'ợ',
            'áº©': 'ú',
            'áº': 'ù',
            'áº': 'ủ',
            'áº': 'ũ',
            'áº': 'ụ',
            'áº©': 'ư',
            'áº': 'ứ',
            'áº': 'ừ',
            'áº': 'ử',
            'áº': 'ữ',
            'áº': 'ự',
            'áº©': 'ý',
            'áº': 'ỳ',
            'áº': 'ỷ',
            'áº': 'ỹ',
            'áº': 'ỵ',
            'áº': 'đ'
        };

        let fixedText = text;
        Object.entries(fixes).forEach(([wrong, correct]) => {
            fixedText = fixedText.replace(new RegExp(wrong, 'g'), correct);
        });

        return fixedText;
    }
}

// Initialize encoding fix
document.addEventListener('DOMContentLoaded', () => {
    window.encodingFix = new EncodingFix();
});

// Export for global use
window.EncodingFix = EncodingFix;
