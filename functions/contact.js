export async function onRequestPost(context) {
  try {
    const data = await context.request.formData();

    const name = data.get("name");
    const email = data.get("email");
    const phone = data.get("phone");
    const inquiry = data.get("inquiry-type");
    const message = data.get("message");

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ 
              email: "support@sengguanauto.com.my",  // ✅ 改成你的邮箱
              name: "Seng Guan Auto" 
            }],
          },
        ],
        from: {
          email: "noreply@sengguanauto.com.my",  // ✅ 用你的域名
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