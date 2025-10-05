export async function onRequestPost(context) {
  try {
    // ✅ 改為讀取 JSON
    const data = await context.request.json();

    const name = data.name;
    const email = data.email;
    const phone = data.phone;
    const inquiry = data.inquiry;
    const message = data.message;
    const turnstileToken = data["cf-turnstile-response"];

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing required fields" 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // ✅ 驗證 Turnstile token
    if (!turnstileToken) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Turnstile verification required" 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    const turnstileVerify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: context.env.TURNSTILE_SECRET_KEY, // ← 需要在 Worker 設置環境變數
        response: turnstileToken,
      }),
    });

    const turnstileResult = await turnstileVerify.json();
    
    if (!turnstileResult.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Turnstile verification failed" 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // ✅ 發送郵件
    const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ 
              email: "support@sengguanauto.com.my",
              name: "Seng Guan Auto" 
            }],
          },
        ],
        from: {
          email: "no-reply@sengguanauto.com.my",
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

    const responseText = await mailResponse.text();
    console.log("MailChannels response:", mailResponse.status, responseText);

    if (!mailResponse.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Mail send failed",
        details: responseText
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