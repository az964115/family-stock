import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests

# 1. 設定收件人名單
RECEIVERS = {
    "jason": "az964115@gmail.com",
    "mom": "sa400020@gmail.com",
    "debby": "debby95170@gmail.com"
}

# 2. Firebase 歐洲西區資料庫基礎網址
DB_BASE = "https://piggynet-93c33-default-rtdb.europe-west1.firebasedatabase.app"
TODAY = datetime.now().strftime("%Y-%m-%d")

# 3. 取得發信所需的環境變數
GMAIL_USER = os.environ.get("GMAIL_USER")
GMAIL_PASSWORD = os.environ.get("GMAIL_PASSWORD")


def fetch_firebase_data(path_url):
    """安全抓取 Firebase 資料"""
    try:
        res = requests.get(f"{DB_BASE}/{path_url}.json", timeout=10)
        return res.json()
    except Exception as e:
        print(f"⚠️ 讀取 Firebase 路徑 {path_url} 失敗: {e}")
        return None


def format_money(val):
    """將金額數字轉為含千分位字串"""
    try:
        return f"{int(val):,}"
    except:
        return str(val)


def get_color(val):
    """賺錢顯示台股標準紅 (#C53030)，賠錢顯示綠 (#22543D)"""
    try:
        return '#C53030' if float(val) >= 0 else '#22543D'
    except:
        return '#333333'


def run_financial_pipeline():
    print("📡 正在從 Firebase 讀取今日全體公告...")
    
    # 📢 1. 讀取全體公告 (family/globalAnnouncement)
    announcement = fetch_firebase_data("family/globalAnnouncement")
    if not announcement:
        announcement = "歡迎使用豬豬e網資產管理平台。目前尚無全體公告。"

    # 建立 SMTP 連線
    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(GMAIL_USER, GMAIL_PASSWORD)
    except Exception as e:
        print(f"❌ Gmail SMTP 登入失敗: {e}")
        return

    # 開始巡迴每位家族成員發信
    for user, email in RECEIVERS.items():
        if not email:
            continue

        print(f"📊 正在提取 【{user}】 的今日網頁結算快照與歷史紀錄...")
        
        # 讀取使用者設定檔與歷史損益紀錄檔
        user_profile = fetch_firebase_data(f"users/{user}")
        history_snapshot = fetch_firebase_data(f"family/investSnapshot/{user}")

        if not history_snapshot or TODAY not in history_snapshot:
            print(f"⚠️ 找不到 {user} 今天的網頁更新快照 (請確認網頁是否有成功寫入今日資料)，跳過。")
            continue

        # 💰 2. 總收益：直接採用網頁下午算好寫入的今日 profit 欄位
        current_profit = int(history_snapshot[TODAY].get("profit", 0))

        # 整理歷史紀錄清單，用於計算「今日收益」與「本月幅度」
        history_entries = []
        for date_str, node in history_snapshot.items():
            if "profit" in node:
                history_entries.append({"date": date_str, "profit": int(node["profit"])})
        history_entries.sort(key=lambda x: x["date"])

        # ㊗️ 3. 今日收益：計算今日 profit 與上一筆歷史紀錄的差額
        past_entries = [e for e in history_entries if e["date"] != TODAY]
        last_profit = past_entries[-1]["profit"] if past_entries else current_profit
        today_profit_diff = current_profit - last_profit

        # 🦖 4. 本月幅度：重現網頁本月首日 Baseline 報酬率算法
        month_performance_str = "--"
        month_rate_val = 0
        current_year_month = datetime.now().strftime("%Y-%m-") # 例如 "2026-06-"
        this_month_entries = [e for e in history_entries if e["date"].startswith(current_year_month)]
        
        if this_month_entries:
            this_month_entries.sort(key=lambda x: x["date"])
            baseline_profit = this_month_entries[0]["profit"]
            if baseline_profit == 0:
                month_performance_str = "+100.0%" if current_profit >= 0 else "-100.0%"
                month_rate_val = 100 if current_profit >= 0 else -100
            else:
                change_rate = ((current_profit - baseline_profit) / abs(baseline_profit)) * 100
                month_performance_str = f"{'+' if change_rate >= 0 else ''}{change_rate:.1f}%"
                month_rate_val = change_rate

        # 🎯 5. 長期資產目標達成進度：結合歷史總價值與 targetAmount 算百分比
        target_amount = float(user_profile.get("targetAmount", 0)) if user_profile else 0
        # 估算當前總現值（網頁邏輯：本金成本 + 累計損益，這邊由網頁寫入的數據推估進度百分比）
        # 為了更準確，我們直接抓取網頁寫入快照中的進度條，如果沒有 targetAmount 則不顯示進度條
        progress_percentage = 0.0
        if target_amount > 0:
            # 依網頁邏輯，以最新損益與目標金額計算進度
            # 若網頁有記錄資產總值，亦可精準對齊。這裡使用與網頁邏輯相符的百分比計算
            current_total_value = current_profit + float(user_profile.get("totalCost", 0)) if user_profile and "totalCost" in user_profile else current_profit
            if current_total_value < 0: current_total_value = 0
            progress_percentage = (current_total_value / target_amount) * 100
            if progress_percentage > 100.0: progress_percentage = 100.0

        # 格式化輸出文字
        today_diff_str = f"+${format_money(today_profit_diff)}" if today_profit_diff >= 0 else f"-${format_money(abs(today_profit_diff))}"
        total_profit_str = f"+${format_money(current_profit)}" if current_profit >= 0 else f"-${format_money(abs(current_profit))}"

        # 建立信件內容 (開頭有公告、結尾也有公告)
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🐷 豬豬e網 - {user} 資產權益結算報告 ({TODAY}) 🐷"
        msg["From"] = f"豬豬e網自動化中心 <{GMAIL_USER}>"
        msg["To"] = email

        html_content = f"""
        <html>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Microsoft JhengHei', sans-serif; color: #2D3748; line-height: 1.6; background-color: #FFFDF0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 25px; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05); border: 1px solid #E2E8F0;">
                    
                    <h2 style="color: #4A5568; text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; margin-top: 0; font-weight: 600;">
                        🐷 豬豬e網 每日結算報告 🐷
                    </h2>
                    
                    <p style="font-size: 16px; margin-bottom: 5px;">Hi, <strong>{user}</strong></p>
                    <p style="font-size: 14px; color: #718096; margin-top: 0;">以下是系統為您同步的今日資產損益明細：</p>
                    
                    <div style="background-color: #FFFDF0; border-left: 5px solid #D4AF37; padding: 15px; margin: 22px 0; border-radius: 8px; border: 1px solid #FCE8C3; border-left: 5px solid #D4AF37;">
                        <strong style="color: #4A5568; font-size: 15px; display: block; margin-bottom: 6px;">📢 全體公告</strong>
                        <div style="font-size: 14px; color: #2D3748; white-space: pre-wrap;">{announcement}</div>
                    </div>

                    <div style="margin: 20px 0;">
                        <table style="width: 100%; border-collapse: separate; border-spacing: 10px;">
                            <tr>
                                <td style="background: #fafafa; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center; width: 50%;">
                                    <small style="color: #718096; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">㊗️ 今日收益</small>
                                    <span style="font-size: 20px; font-weight: 700; color: {get_color(today_profit_diff)};">{today_diff_str}元</span>
                                </td>
                                <td style="background: #fafafa; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center; width: 50%;">
                                    <small style="color: #718096; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">💰 總收益</small>
                                    <span style="font-size: 20px; font-weight: 700; color: {get_color(current_profit)};">{total_profit_str}元</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="background: #fafafa; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; text-align: center;" colspan="2">
                                    <small style="color: #718096; font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px;">🦖 本月幅度</small>
                                    <span style="font-size: 18px; font-weight: 700; color: {get_color(month_rate_val)};">{month_performance_str}</span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    {" " if target_amount <= 0 else f'''
                    <div style="margin: 25px 0 15px 0;">
                        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; color: #718096; margin-bottom: 6px;">
                            <span>🎯 長期資產目標達成進度</span>
                            <span style="color: #3182CE;">{progress_percentage:.1f}%</span>
                        </div>
                        <div style="background: #EDF2F7; border-radius: 20px; height: 22px; width: 100%; position: relative; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #3182CE 0%, #319795 100%); height: 100%; width: {progress_percentage:.1f}%; border-radius: 20px;"></div>
                            <div style="position: absolute; width: 100%; text-align: center; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 11px; font-weight: 700; color: #2D3748;">
                                目標金額: ${format_money(target_amount)} 元
                            </div>
                        </div>
                    </div>
                    '''}
                    
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px dashed #E2E8F0; font-size: 13px; color: #718096; line-height: 1.5;">
                        <b style="color: #4A5568;">📢 全體公告提醒：</b> {announcement}
                    </div>

                    <div style="text-align: center; margin: 30px 0 10px 0;">
                        <a href="https://az964115.github.io/family-stock/" 
                           style="background-color: #4A5568; color: white; padding: 11px 24px; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px; display: inline-block;">
                           進入系統查看資產折線圖 ➔
                        </a>
                    </div>
                </div>
            </body>
        </html>
        """
        msg.attach(MIMEText(html_content, "html"))

        try:
            server.sendmail(GMAIL_USER, email, msg.as_string())
            print(f"🎯 [發信成功] 已順利將完整財務結算報告送至 {user} 的信箱")
        except Exception as e:
            print(f"❌ 傳送 {user} 信件時失敗: {e}")

    server.quit()
    print("🏁 【排程結束】所有人期待的完整報告皆已發送成功。")


if __name__ == "__main__":
    run_financial_pipeline()
