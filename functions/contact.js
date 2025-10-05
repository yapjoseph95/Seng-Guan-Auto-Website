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
          "Access-Control-Allow-Origin": "*" // ✅ 添加 CORS
        },
      });
    }

    // 📧 MailChannels API (Cloudflare Pages 专用)
    const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: "support@sengguanauto.com.my", name: "Seng Guan Auto" }], // 👈 改成你的邮箱
            dkim_domain: "sengguanauto.com.my", // ✅ 必须添加你的域名
            dkim_selector: "mailchannels", // ✅ DKIM 选择器
          },
        ],
        from: {
          email: "noreply@sengguanauto.com.my", // ⚠️ 必须用你自己的域名
          name: "Seng Guan Auto Contact Form",
        },
        reply_to: {
          email: email, // ✅ 用户邮箱放这里
          name: name,
        },
        subject: `New Inquiry from ${name} (${inquiry || "General"})`,
        content: [
          {
            type: "text/html", // ✅ 改用 HTML 格式更美观
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

    if (!mailResponse.ok) {
      const errorText = await mailResponse.text();
      console.error("MailChannels error:", errorText);
      return new Response(JSON.stringify({ success: false, error: "Mail send failed" }), {
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
    console.error("Function error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
}

// ✅ 处理 OPTIONS 请求（CORS 预检）
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}