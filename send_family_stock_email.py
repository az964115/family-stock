import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests

# 1. 設定收件人名單 (根據您的提供)
RECEIVERS = {
    "jason": "az964115@gmail.com",
    "mom": "sa400020@gmail.com",
    # "debby": "debby95170@gmail.com"
    # "dad": "",  # 先空著
    # "wei": ""   # 先空著
}

# 2. Firebase 歐洲西區資料庫基礎網址
DB_BASE = "https://piggynet-93c33-default-rtdb.europe-west1.firebasedatabase.app"
TODAY = datetime.now().strftime("%Y-%m-%d")

# 3. 取得發信所需的環境變數
GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_PASSWORD = os.environ.get("GMAIL_PASSWORD")


def fetch_profit_and_send():
    print("📡 正在從歐洲西區雲端資料庫抓取今日損益數據...")

    # 連線到 SMTP 伺服器預備
    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(GMAIL_USER, GMAIL_PASSWORD)
    except Exception as e:
        print(f"❌ Gmail SMTP 登入失敗: {e}")
        return

    # 巡迴名單發信
    for user, email in RECEIVERS.items():
        if not email:
            continue

        # 從 Firebase 撈取每位成員今天的真實損益
        url = f"{DB_BASE}/family/investSnapshot/{user}/{TODAY}/profit.json"
        try:
            response = requests.get(url)
            profit_data = response.json()

            if profit_data is None:
                print(f"⚠️ 找不到成員 {user} 在今天的損益歷史紀錄，跳過發信。")
                continue

            # 格式化金額數字為千分位
            profit_val = int(profit_data)
            profit_str = f"{profit_val:,}"

            # 建立美化的 HTML 信件內容
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"🐷 豬豬e網 - {user} 今日收益回報 ({TODAY}) 🐷"
            msg["From"] = f"豬豬e網自動化中心 <{GMAIL_USER}>"
            msg["To"] = email

            html_content = f"""
            <html>
                <body style="font-family: 'Microsoft JhengHei', sans-serif; color: #333; line-height: 1.6;">
                    <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h2 style="color: #ea4335; text-align: center; border-bottom: 2px solid #f4c20d; padding-bottom: 10px;">
                            🐷 豬豬e網 每日資產回報 🐷
                        </h2>
                        <p style="font-size: 16px;">嗨 <strong>{user}</strong>，午安！</p>
                        <p style="font-size: 16px;">今天台股收盤數據已同步完成，以下是您今日的最新帳戶損益明細：</p>
                        
                        <div style="background-color: #f9f9f9; border-left: 5px solid #4285f4; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <span style="font-size: 14px; color: #666;">今日結算損益：</span><br/>
                            <span style="font-size: 28px; font-weight: bold; color: {'#ea4335' if profit_val >= 0 else '#34a853'};">
                                ${profit_str} 元
                            </span>
                        </div>
                        
                        <p style="font-size: 14px; color: #555;">
                            💡 提示：您可以隨時點擊下方按鈕前往「豬豬e網」查看歷史資產折線圖趨勢。
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://az964115.github.io/family-stock/" 
                               style="background-color: #4285f4; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">
                               進入系統查看折線圖 ➔
                            </a>
                        </div>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            本信件由系統於每日下午 14:00 自動結算發送，請勿直接回覆本信件。
                        </p>
                    </div>
                </body>
            </html>
            """
            msg.attach(MIMEText(html_content, "html"))

            # 送出郵件
            server.sendmail(GMAIL_USER, email, msg.as_string())
            print(f"🎯 [發信成功] 已順利將今日回報信件送至 {user} 的信箱 ({email})")

        except Exception as e:
            print(f"❌ 處理 {user} 的信件時發生錯誤: {e}")

    server.quit()
    print("🏁 所有成員的信件發送排程已順利結束。")


if __name__ == "__main__":
    fetch_profit_and_send()
