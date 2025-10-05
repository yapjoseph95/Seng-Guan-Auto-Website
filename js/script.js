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
  
  question.addEventListener('click', function () {
    const isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';
    
    // 收起所有其他项
    faqItems.forEach(i => {
      const a = i.querySelector('.faq-answer');
      if (a.style.maxHeight && a.style.maxHeight !== '0px') {
        a.style.maxHeight = a.scrollHeight + 'px';
        requestAnimationFrame(() => {
          a.style.maxHeight = '0px';
          a.style.padding = '0 20px';
        });
      }
    });
    
    // 展开当前项
    if (!isOpen) {
      answer.style.padding = '15px 20px';
      answer.style.maxHeight = answer.scrollHeight + 30 + 'px'; // +30 是上下 padding
    }
  });
});


    
    // Testimonial Slider
    const testimonials = document.querySelectorAll('.testimonial');
    let currentTestimonial = 0;
    if (testimonials.length > 1) {
        setInterval(() => {
            testimonials[currentTestimonial].style.opacity = '0';
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            testimonials[currentTestimonial].style.opacity = '1';
        }, 5000);
    }
    
    // Car Slider
    const carSlider = document.querySelector('.car-slider');
    if (carSlider) {
        let isDown = false;
        let startX;
        let scrollLeft;
        let slideWidth = 0;
        let currentSlide = 0;
        let totalSlides = 0;
        let slideTimer;
        
        function calculateSlideMetrics() {
            const slides = carSlider.querySelectorAll('.car-slide');
            totalSlides = slides.length;
            if (slides.length > 0) {
                slideWidth = slides[0].offsetWidth + 
                    parseInt(window.getComputedStyle(slides[0]).marginLeft || 0) + 
                    parseInt(window.getComputedStyle(slides[0]).marginRight || 0);
            }
        }
        
        function initSlider() {
            calculateSlideMetrics();
            resetToFirstSlide();
        }
        
        function resetToFirstSlide() {
            currentSlide = 0;
            carSlider.scrollLeft = 0;
        }
        
        function slideToNext() {
            currentSlide++;
            if (currentSlide >= totalSlides) {
                currentSlide = 0;
                carSlider.scrollTo({
                    left: totalSlides * slideWidth,
                    behavior: 'smooth'
                });
                setTimeout(() => {
                    carSlider.style.scrollBehavior = 'auto';
                    carSlider.scrollLeft = 0;
                    carSlider.style.scrollBehavior = 'smooth';
                    startSlideTimer();
                }, 400);
            } else {
                carSlider.scrollTo({
                    left: currentSlide * slideWidth,
                    behavior: 'smooth'
                });
                startSlideTimer();
            }
        }
        
        function startSlideTimer() {
            clearTimeout(slideTimer);
            slideTimer = setTimeout(slideToNext, 3000);
        }
        
        initSlider();
        window.addEventListener('resize', initSlider);
        startSlideTimer();
        
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
    
    // WhatsApp floating button
    const body = document.body;
    const whatsappButton = document.createElement('a');
    whatsappButton.href = 'https://wa.me/60162182727';
    whatsappButton.className = 'whatsapp-float';
    whatsappButton.innerHTML = '<i class="fab fa-whatsapp"></i>';
    whatsappButton.setAttribute('target', '_blank');
    body.appendChild(whatsappButton);

 // Loan Calculator - Details toggle
const detailsBtn = document.getElementById('details-toggle');
const hiddenDetails = document.getElementById('hidden-details');

if (detailsBtn && hiddenDetails) {
    // 确保初始状态
    hiddenDetails.style.maxHeight = '0px';
    
    detailsBtn.addEventListener('click', function () {
        if (hiddenDetails.classList.contains('open')) {
            // 收起
            hiddenDetails.style.maxHeight = '0px';
            hiddenDetails.classList.remove('open');
            detailsBtn.textContent = 'View Details';
        } else {
            // 展开
            hiddenDetails.classList.add('open');
            // 设置一个足够大的高度值确保内容完全显示
            hiddenDetails.style.maxHeight = '1000px';
            detailsBtn.textContent = 'Hide Details';
        }
    });
}


});

// Loan Calculator
let isPercentage = false;

function toggleDownpaymentType(checkbox) {
    const texts = document.querySelectorAll(".slider-text"); 
    const isPercentage = checkbox.checked;

    texts.forEach(span => {
        span.textContent = isPercentage ? "%" : "RM";
    });
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
    
    let downpayment;
    if (isPercentage) {
        downpayment = carPrice * (downpaymentInput / 100);
    } else {
        downpayment = downpaymentInput;
    }
    
    const loanAmount = carPrice - downpayment;
    const totalInterest = loanAmount * interestRate * loanTerm;
    const totalPayment = loanAmount + totalInterest;
    const totalLoanMonth = loanTerm * 12;
    const monthlyPayment = totalPayment / loanTerm;
    
    // 更新结果
    const resultsElement = document.getElementById('results');
    resultsElement.style.display = 'block';
    
    document.getElementById('monthly-payment').textContent = 'RM ' + monthlyPayment.toFixed(2);
    document.getElementById('total-loan').textContent = 'RM ' + loanAmount.toFixed(2);
    document.getElementById('total-downpayment').textContent = 'RM ' + downpayment.toFixed(2);
    document.getElementById('total-payment').textContent = 'RM ' + totalPayment.toFixed(2);
    document.getElementById('total-interest').textContent = 'RM ' + totalInterest.toFixed(2);
}

// Contact Form validation + Cloudflare submission + loading button
function validateContactForm() {
    const form = document.getElementById('contact-form');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const inquiry = document.getElementById('inquiry-type').value.trim();
    const message = document.getElementById('message').value.trim();
    const successMsg = document.getElementById('success-message');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    let isValid = true;
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    if (name === '') {
        document.getElementById('name-error').textContent = 'Name is required';
        isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        document.getElementById('email-error').textContent = 'Valid email is required';
        isValid = false;
    }

    if (phone !== '') {
        const phoneRegex = /^[0-9+\-\s]{8,15}$/;
        if (!phoneRegex.test(phone)) {
            document.getElementById('phone-error').textContent = 'Please enter a valid phone number';
            isValid = false;
        }
    }

    if (inquiry === '') {
        document.getElementById('inquiry-error').textContent = 'Please select an inquiry type';
        isValid = false;
    }

    if (message === '') {
        document.getElementById('message-error').textContent = 'Message is required';
        isValid = false;
    }

    if (!isValid) return false;

    // ✅ 设置按钮 loading 状态
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    // ✅ Cloudflare Pages form submission
    const formData = new FormData(form);

    fetch("/", { // ✅ Cloudflare 自动识别表单提交
        method: "POST",
        body: formData,
    })
    .then(response => {
        if (response.ok) {
            form.reset();
            successMsg.style.display = 'block';
            successMsg.style.opacity = 0;
            successMsg.style.transition = 'opacity 0.5s ease';
            setTimeout(() => successMsg.style.opacity = 1, 50);
            window.scrollTo({ top: successMsg.offsetTop - 100, behavior: 'smooth' });
        } else {
            alert("Failed to send message. Please try again later.");
        }
    })
    .catch(() => {
        alert("An error occurred. Please try again.");
    })
    .finally(() => {
        // ✅ 恢复按钮状态
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    });

    return false; // 阻止页面刷新
}



