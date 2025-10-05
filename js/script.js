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
export async function onRequestPost(context) {
  try {
    const data = await context.request.formData();

    const name = data.get("name");
    const email = data.get("email");
    const phone = data.get("phone");
    const inquiry = data.get("inquiry-type");
    const message = data.get("message");

    // 🔒 防止空输入
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // 📧 发送邮件到 MailChannels
    const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ 
              email: "support@sengguanauto.com.my",  // ✅ 改成你的真实邮箱
              name: "Seng Guan Auto" 
            }],
          },
        ],
        from: {
          email: "noreply@sengguanauto.com.my",  // ✅ 必须用你的域名
          name: "Seng Guan Auto Contact Form",
        },
        reply_to: {
          email: email,
          name: name,
        },
        subject: `New Inquiry from ${name} (${inquiry || "General"})`,
        content: [
          {
            type: "text/html",
            value: `
              <h2>New Contact Form Submission</h2>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || "N/A"}</p>
              <p><strong>Inquiry Type:</strong> ${inquiry || "N/A"}</p>
              <p><strong>Message:</strong></p>
              <p>${message.replace(/\n/g, '<br>')}</p>
            `,
          },
        ],
      }),
    });

    // 📝 记录 MailChannels 响应（用于调试）
    const responseText = await mailResponse.text();
    console.log("MailChannels response:", mailResponse.status, responseText);

    if (!mailResponse.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Mail send failed",
        details: responseText  // ✅ 返回详细错误
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (err) {
    // 📝 记录错误（用于调试）
    console.error("Function error:", err.message, err.stack);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
}

// ✅ 处理 OPTIONS 请求（CORS）
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}


