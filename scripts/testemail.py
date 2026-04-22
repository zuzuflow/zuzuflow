import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# === CONFIG ===
SMTP_SERVER = "smtp.resend.com"
SMTP_PORT = 465

SMTP_USER = "resend"
SMTP_PASS = "re_EYGj4aJ5_AECK2Y3Vkz1qdDJMo767rt7J"             # 16-char app password, no spaces

FROM_ADDRESS = "noreply@zuzuflow.com"    # Shared mailbox (needs Send As permission)
TO_ADDRESS = "lbalaji8385@gmai.com"       # Send to yourself for testing

# === BUILD MESSAGE ===
msg = MIMEMultipart()
msg["From"] = FROM_ADDRESS
msg["To"] = TO_ADDRESS
msg["Subject"] = "SMTP Test from Shared Mailbox"
msg.attach(MIMEText("If you see this, SMTP works! 🎉", "plain"))

# === SEND ===
try:
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.set_debuglevel(1)          # Prints full SMTP conversation — useful for debugging
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(FROM_ADDRESS, [TO_ADDRESS], msg.as_string())
    print("\n✅ Email sent successfully!")
except smtplib.SMTPAuthenticationError as e:
    print(f"\n❌ Auth failed: {e}")
except smtplib.SMTPException as e:
    print(f"\n❌ SMTP error: {e}")
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")