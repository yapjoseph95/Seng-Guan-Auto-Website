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
        
        // 初始化收起
        answer.style.maxHeight = '0';
        answer.style.padding = '0 20px';
        
        question.addEventListener('click', function() {
            this.classList.toggle('active');
            if (answer.style.maxHeight !== '0px') {
                answer.style.maxHeight = '0px';
                answer.style.padding = '0 20px';
            } else {
                answer.style.maxHeight = answer.scrollHeight + 30 + 'px';
                answer.style.padding = '15px 20px';
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
    whatsappButton.href = 'https://wa.me/60123456789';
    whatsappButton.className = 'whatsapp-float';
    whatsappButton.innerHTML = '<i class="fab fa-whatsapp"></i>';
    whatsappButton.setAttribute('target', '_blank');
    body.appendChild(whatsappButton);

    // Loan Calculator - Details toggle
    const detailsBtn = document.getElementById('details-toggle');
    const hiddenDetails = document.getElementById('hidden-details');
    if (detailsBtn && hiddenDetails) {
        detailsBtn.addEventListener('click', function() {
            hiddenDetails.classList.toggle('open');
            if (hiddenDetails.classList.contains('open')) {
                detailsBtn.textContent = 'Hide Details';
            } else {
                detailsBtn.textContent = 'View Details';
            }
        });
    }
});

// Loan Calculator
let isPercentage = false;

function toggleDownpaymentType() {
    const downpaymentTypeBtn = document.getElementById('downpayment-type');
    if (downpaymentTypeBtn) {
        isPercentage = !isPercentage;
        downpaymentTypeBtn.textContent = isPercentage ? '%' : 'RM';
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
    
    let downpayment;
    if (isPercentage) {
        downpayment = carPrice * (downpaymentInput / 100);
    } else {
        downpayment = downpaymentInput;
    }
    
    const loanAmount = carPrice - downpayment;
    const monthlyPayment = (interestRate * loanAmount) / (1 - Math.pow(1 + interestRate, -loanTerm));
    
    const resultsElement = document.getElementById('results');
    resultsElement.style.display = 'block';
    document.getElementById('monthly-payment').textContent = 'RM ' + monthlyPayment.toFixed(2);
    
    const totalPayment = monthlyPayment * loanTerm;
    const totalInterest = totalPayment - loanAmount;
    
    document.getElementById('total-loan').textContent = 'RM ' + loanAmount.toFixed(2);
    document.getElementById('total-downpayment').textContent = 'RM ' + downpayment.toFixed(2);
    document.getElementById('total-payment').textContent = 'RM ' + totalPayment.toFixed(2);
    document.getElementById('total-interest').textContent = 'RM ' + totalInterest.toFixed(2);
}

// Contact Form validation
function validateContactForm() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const message = document.getElementById('message').value;
    
    let isValid = true;
    
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    if (name.trim() === '') {
        document.getElementById('name-error').textContent = 'Name is required';
        isValid = false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        document.getElementById('email-error').textContent = 'Valid email is required';
        isValid = false;
    }
    
    if (phone.trim() !== '') {
        const phoneRegex = /^[0-9+\-\s]{8,15}$/;
        if (!phoneRegex.test(phone)) {
            document.getElementById('phone-error').textContent = 'Please enter a valid phone number';
            isValid = false;
        }
    }
    
    if (message.trim() === '') {
        document.getElementById('message-error').textContent = 'Message is required';
        isValid = false;
    }
    
    if (isValid) {
        document.getElementById('success-message').style.display = 'block';
        document.getElementById('contact-form').reset();
    }
    
    return isValid;
}
