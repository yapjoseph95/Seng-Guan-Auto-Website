// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenu = document.querySelector('.mobile-menu');
    const nav = document.querySelector('nav');
    
    if (mobileMenu && nav) {
        mobileMenu.addEventListener('click', function() {
            nav.classList.toggle('active');
            this.classList.toggle('active');
        });
    }
    
    // FAQ Toggle with Animation
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        
        // 初始化所有答案的maxHeight
        answer.style.maxHeight = '0';
        answer.style.padding = '0 20px';
        
        question.addEventListener('click', function() {
            // Toggle active class
            this.classList.toggle('active');
            
            // Toggle answer visibility with animation
            if (answer.style.maxHeight !== '0px') {
                answer.style.maxHeight = '0px';
                answer.style.padding = '0 20px';
            } else {
                answer.style.maxHeight = answer.scrollHeight + 30 + 'px'; // 添加额外空间
                answer.style.padding = '15px 20px';
            }
        });
    });
    
    // Testimonial Slider (can be enhanced with a proper slider library)
    const testimonials = document.querySelectorAll('.testimonial');
    let currentTestimonial = 0;
    
    // Simple auto-scroll for testimonials
    if (testimonials.length > 1) {
        setInterval(() => {
            testimonials[currentTestimonial].style.opacity = '0';
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            testimonials[currentTestimonial].style.opacity = '1';
        }, 5000);
    }
    
    // Car Slider for Featured Vehicles
    const carSlider = document.querySelector('.car-slider');
    if (carSlider) {
        let isDown = false;
        let startX;
        let scrollLeft;
        let slideWidth = 0;
        let currentSlide = 0;
        let totalSlides = 0;
        let slideTimer;
        
        // 计算滑块宽度和总数
        function calculateSlideMetrics() {
            const slides = carSlider.querySelectorAll('.car-slide');
            totalSlides = slides.length;
            if (slides.length > 0) {
                slideWidth = slides[0].offsetWidth + 
                    parseInt(window.getComputedStyle(slides[0]).marginLeft || 0) + 
                    parseInt(window.getComputedStyle(slides[0]).marginRight || 0);
            }
        }
        
        // 初始化滑块
        function initSlider() {
            calculateSlideMetrics();
            resetToFirstSlide();
        }
        
        // 确保显示第一张照片
        function resetToFirstSlide() {
            currentSlide = 0;
            carSlider.scrollLeft = 0;
        }
        
        // 滑动到下一张照片
        function slideToNext() {
            currentSlide++;
            
            // 如果是最后一张，回到第一张
            if (currentSlide >= totalSlides) {
                currentSlide = 0;
                
                // 先滑动到最后一张之后一点
                carSlider.scrollTo({
                    left: totalSlides * slideWidth,
                    behavior: 'smooth'
                });
                
                // 短暂延迟后，快速回到第一张
                setTimeout(() => {
                    carSlider.style.scrollBehavior = 'auto';
                    carSlider.scrollLeft = 0;
                    carSlider.style.scrollBehavior = 'smooth';
                    startSlideTimer();
                }, 400);
            } else {
                // 平滑滑动到下一张
                carSlider.scrollTo({
                    left: currentSlide * slideWidth,
                    behavior: 'smooth'
                });
                startSlideTimer();
            }
        }
        
        // 设置定时器，3秒后滑动到下一张
        function startSlideTimer() {
            clearTimeout(slideTimer);
            slideTimer = setTimeout(slideToNext, 3000);
        }
        
        // 初始化并开始自动滑动
        initSlider();
        window.addEventListener('resize', initSlider);
        startSlideTimer();
        
        // 鼠标事件处理
        carSlider.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - carSlider.offsetLeft;
            scrollLeft = carSlider.scrollLeft;
            clearTimeout(slideTimer);
        });
        
        carSlider.addEventListener('mouseleave', () => {
            isDown = false;
            startSlideTimer();
        });
        
        carSlider.addEventListener('mouseup', () => {
            isDown = false;
            startSlideTimer();
        });
        
        carSlider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - carSlider.offsetLeft;
            const walk = (x - startX) * 2;
            carSlider.scrollLeft = scrollLeft - walk;
        });
    }
    
    // Add WhatsApp floating button
    const body = document.body;
    const whatsappButton = document.createElement('a');
    whatsappButton.href = 'https://wa.me/60123456789'; // Replace with actual WhatsApp number
    whatsappButton.className = 'whatsapp-float';
    whatsappButton.innerHTML = '<i class="fab fa-whatsapp"></i>';
    whatsappButton.setAttribute('target', '_blank');
    body.appendChild(whatsappButton);
});

// Loan Calculator for Financing Page
let isPercentage = false;

function toggleDownpaymentType() {
    const downpaymentTypeBtn = document.getElementById('downpayment-type');
    if (downpaymentTypeBtn) {
        isPercentage = !isPercentage;
        downpaymentTypeBtn.textContent = isPercentage ? '%' : 'RM';
    }
}

function toggleDetails() {
    const hiddenDetails = document.getElementById('hidden-details');
    const detailsToggle = document.getElementById('details-toggle');
    
    if (hiddenDetails.style.maxHeight) {
        // 收起详情
        hiddenDetails.style.maxHeight = '0px';
        hiddenDetails.style.opacity = '0';
        detailsToggle.textContent = 'View Details';
    } else {
        // 展开详情
        hiddenDetails.style.display = 'block';
        
        // 强制浏览器重绘以应用过渡效果
        setTimeout(() => {
            hiddenDetails.style.maxHeight = hiddenDetails.scrollHeight + 'px';
            hiddenDetails.style.opacity = '1';
        }, 10);
        
        detailsToggle.textContent = 'Hide Details';
    }
}

function calculateLoan() {
    const carPrice = parseFloat(document.getElementById('loan-amount').value);
    const downpaymentInput = parseFloat(document.getElementById('downpayment').value);
    const interestRate = parseFloat(document.getElementById('interest-rate').value) / 100 / 12;
    const loanTerm = parseFloat(document.getElementById('loan-term').value) * 12;
    
    if (isNaN(carPrice) || isNaN(downpaymentInput) || isNaN(interestRate) || isNaN(loanTerm)) {
        document.getElementById('monthly-payment').textContent = 'Please enter valid numbers';
        return;
    }
    
    // Calculate downpayment based on type (percentage or fixed amount)
    let downpayment;
    if (isPercentage) {
        downpayment = carPrice * (downpaymentInput / 100);
    } else {
        downpayment = downpaymentInput;
    }
    
    // Calculate loan amount after downpayment
    const loanAmount = carPrice - downpayment;
    
    // Calculate monthly payment using the formula: P = (r*PV)/(1-(1+r)^-n)
    const monthlyPayment = (interestRate * loanAmount) / (1 - Math.pow(1 + interestRate, -loanTerm));
    
    // 添加结果区域的动画效果
    const resultsElement = document.getElementById('results');
    
    // 先设置为可见但高度为0
    resultsElement.style.display = 'block';
    resultsElement.style.maxHeight = '0';
    resultsElement.style.opacity = '0';
    
    // 强制浏览器重绘以应用过渡效果
    setTimeout(() => {
        resultsElement.style.maxHeight = resultsElement.scrollHeight + 'px';
        resultsElement.style.opacity = '1';
    }, 10);
    
    document.getElementById('monthly-payment').textContent = 'RM ' + monthlyPayment.toFixed(2);
    
    // Calculate and display the total payment and total interest
    const totalPayment = monthlyPayment * loanTerm;
    const totalInterest = totalPayment - loanAmount;
    
    // 更新所有详情字段
    document.getElementById('total-loan').textContent = 'RM ' + loanAmount.toFixed(2);
    document.getElementById('total-downpayment').textContent = 'RM ' + downpayment.toFixed(2);
    document.getElementById('total-payment').textContent = 'RM ' + totalPayment.toFixed(2);
    document.getElementById('total-interest').textContent = 'RM ' + totalInterest.toFixed(2);
}

// Form validation for Contact Page
function validateContactForm() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const message = document.getElementById('message').value;
    
    let isValid = true;
    
    // Reset error messages
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    // Validate name
    if (name.trim() === '') {
        document.getElementById('name-error').textContent = 'Name is required';
        isValid = false;
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        document.getElementById('email-error').textContent = 'Valid email is required';
        isValid = false;
    }
    
    // Validate phone (optional but must be valid if provided)
    if (phone.trim() !== '') {
        const phoneRegex = /^[0-9+\-\s]{8,15}$/;
        if (!phoneRegex.test(phone)) {
            document.getElementById('phone-error').textContent = 'Please enter a valid phone number';
            isValid = false;
        }
    }
    
    // Validate message
    if (message.trim() === '') {
        document.getElementById('message-error').textContent = 'Message is required';
        isValid = false;
    }
    
    if (isValid) {
        // In a real application, you would submit the form data to a server here
        document.getElementById('success-message').style.display = 'block';
        document.getElementById('contact-form').reset();
    }
    
    return isValid;
}