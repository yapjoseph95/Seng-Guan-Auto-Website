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
        headers: { "Content-Type": "application/json" },
      });
    }

    // 📧 用 Cloudflare 的 Email API（MailChannels 内建）
    const mailResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: "your@email.com", name: "Seng Guan Auto" }], // 👈 改成你自己的邮箱
          },
        ],
        from: {
          email: email,
          name: name,
        },
        subject: `New Inquiry from ${name} (${inquiry || "General"})`,
        content: [
          {
            type: "text/plain",
            value: `Name: ${name}
Email: ${email}
Phone: ${phone || "N/A"}
Inquiry Type: ${inquiry || "N/A"}
Message:
${message}`,
          },
        ],
      }),
    });

    if (!mailResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: "Mail send failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
