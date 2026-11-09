import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

def run_monthly_audit(force=False):
    now = datetime.now()
    tomorrow = now + timedelta(days=1)
    
    # If check_day mode and tomorrow is not the 1st of next month, exit early
    if not force and tomorrow.day != 1:
        print(f"Today ({now.strftime('%Y-%m-%d')}) is not the last day of the month. Exiting.")
        return None

    month_str = now.strftime('%Y-%m')
    start_of_month = f"{now.year}-{now.month:02d}-01T00:00:00Z"
    
    # Compute end of month in UTC
    if now.month == 12:
        next_month_start = f"{now.year + 1}-01-01T00:00:00Z"
    else:
        next_month_start = f"{now.year}-{now.month + 1:02d}-01T00:00:00Z"

    print(f"Running HubQuiz Monthly Audit for {month_str}...")

    cloud_url = "https://pxsemvrbchajuqhnetti.supabase.co"
    cloud_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c2VtdnJiY2hhanVxaG5ldHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njk2NTcsImV4cCI6MjEwMjU0NTY1N30.wBgG5qUjrRLC8Od41RrM_dIjC8VXrb9FeyvfO4dIBkE"

    # Authenticate as admin
    login_url = f"{cloud_url}/auth/v1/token?grant_type=password"
    payload = json.dumps({"email": "admin@comedkares.org", "password": "@*QWqnkfV&zc1!"}).encode("utf-8")
    req = urllib.request.Request(login_url, data=payload, headers={"apikey": cloud_key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            token = json.loads(res.read().decode("utf-8"))["access_token"]
    except Exception as e:
        print(f"Authentication error: {e}")
        return None

    auth_headers = {"apikey": cloud_key, "Authorization": f"Bearer {token}"}

    # 1. Fetch monthly survey responses
    survey_url = f"{cloud_url}/rest/v1/hubquiz_survey_responses?created_at=gte.{start_of_month}&created_at=lt.{next_month_start}&select=*"
    req_s = urllib.request.Request(survey_url, headers=auth_headers)
    try:
        with urllib.request.urlopen(req_s, timeout=10) as res:
            surveys = json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching surveys: {e}")
        surveys = []

    # 2. Fetch monthly game sessions
    sessions_url = f"{cloud_url}/rest/v1/game_sessions?created_at=gte.{start_of_month}&created_at=lt.{next_month_start}&select=id,status,created_at,host_id"
    req_g = urllib.request.Request(sessions_url, headers=auth_headers)
    try:
        with urllib.request.urlopen(req_g, timeout=10) as res:
            sessions = json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        sessions = []

    # 3. Fetch monthly players
    players_url = f"{cloud_url}/rest/v1/players?joined_at=gte.{start_of_month}&joined_at=lt.{next_month_start}&select=id,session_id,score"
    req_p = urllib.request.Request(players_url, headers=auth_headers)
    try:
        with urllib.request.urlopen(req_p, timeout=10) as res:
            players = json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching players: {e}")
        players = []

    # Process metrics
    mentor_surveys = [s for s in surveys if s.get("audience") == "mentor"]
    student_surveys = [s for s in surveys if s.get("audience") == "student"]

    # Aggregate survey breakdowns
    def count_distribution(items, key):
        dist = {}
        for it in items:
            val = it.get(key)
            if val:
                dist[val] = dist.get(val, 0) + 1
        return dist

    mentor_q1 = count_distribution(mentor_surveys, "q1_answer")
    mentor_q2 = count_distribution(mentor_surveys, "q2_answer")
    mentor_q3 = count_distribution(mentor_surveys, "q3_answer")

    student_q1 = count_distribution(student_surveys, "q1_answer")
    student_q2 = count_distribution(student_surveys, "q2_answer")

    # Generate Markdown Report
    report_lines = [
        f"# HubQuiz Monthly Executive Audit: {now.strftime('%B %Y')}",
        f"",
        f"**Audit Generated**: {now.strftime('%Y-%m-%d %H:%M:%S')} IST  ",
        f"**Reporting Period**: {now.strftime('%B %Y')} (Monthly Cycle)  ",
        f"**Audited Platform**: HubQuiz Realtime Assessment Engine (`https://hubquiz.vercel.app`)",
        f"",
        f"---",
        f"",
        f"## 1. Monthly Usage & Delivery Summary",
        f"",
        f"| Metric | Total for {now.strftime('%B %Y')} | Status |",
        f"| :--- | :--- | :--- |",
        f"| **Quiz Sessions Conducted** | **{len(sessions)} sessions** | Active Classroom Delivery |",
        f"| **Total Student Participants** | **{len(players)} students** | Live Peer Play |",
        f"| **Mentor Feedback Submissions** | **{len(mentor_surveys)} responses** | Decoupled & Anonymous |",
        f"| **Student Feedback Submissions** | **{len(student_surveys)} responses** | Decoupled & Anonymous |",
        f"",
        f"---",
        f"",
        f"## 2. Mentor Survey Insights (Pedagogical Efficacy)",
        f"",
        f"### A. Speed of Understanding Insight",
        f"*Question: Compared to how you checked understanding before, how quickly did this show you how the class did?*",
        f""
    ]

    if mentor_surveys:
        report_lines.append("| Response Option | Count | Share |")
        report_lines.append("| :--- | :--- | :--- |")
        for opt in ["Much faster", "Somewhat faster", "About the same", "Slower"]:
            cnt = mentor_q1.get(opt, 0)
            pct = round(cnt * 100.0 / len(mentor_surveys), 1) if len(mentor_surveys) > 0 else 0
            report_lines.append(f"| {opt} | {cnt} | {pct}% |")
    else:
        report_lines.append("*No mentor survey responses logged for this monthly cycle.*")

    report_lines.extend([
        f"",
        f"### B. Instructional Adaptation Impact",
        f"*Question: Did the results change what you did next?*",
        f""
    ])

    if mentor_surveys:
        report_lines.append("| Response Option | Count | Share |")
        report_lines.append("| :--- | :--- | :--- |")
        for opt in ["Yes, I changed my plan", "They confirmed my plan", "I didn't use them", "I couldn't read them clearly"]:
            cnt = mentor_q2.get(opt, 0)
            pct = round(cnt * 100.0 / len(mentor_surveys), 1) if len(mentor_surveys) > 0 else 0
            report_lines.append(f"| {opt} | {cnt} | {pct}% |")
    else:
        report_lines.append("*No mentor responses logged.*")

    report_lines.extend([
        f"",
        f"---",
        f"",
        f"## 3. Student Survey Insights (Technical & Learning Efficacy)",
        f"",
        f"### A. Technical Joining / Network Friction",
        f"*Question: Did you have any trouble joining or answering?*",
        f""
    ])

    if student_surveys:
        report_lines.append("| Response Option | Count | Share |")
        report_lines.append("| :--- | :--- | :--- |")
        for opt in ["No", "Yes, my phone", "Yes, the network", "Yes, something else"]:
            cnt = student_q1.get(opt, 0)
            pct = round(cnt * 100.0 / len(student_surveys), 1) if len(student_surveys) > 0 else 0
            report_lines.append(f"| {opt} | {cnt} | {pct}% |")
    else:
        report_lines.append("*No student survey responses logged for this monthly cycle.*")

    report_lines.extend([
        f"",
        f"### B. Practice Clarity Diagnostic",
        f"*Question: Did the quiz show you what you still need to practise?*",
        f""
    ])

    if student_surveys:
        report_lines.append("| Response Option | Count | Share |")
        report_lines.append("| :--- | :--- | :--- |")
        for opt in ["Yes", "A little", "No"]:
            cnt = student_q2.get(opt, 0)
            pct = round(cnt * 100.0 / len(student_surveys), 1) if len(student_surveys) > 0 else 0
            report_lines.append(f"| {opt} | {cnt} | {pct}% |")
    else:
        report_lines.append("*No student responses logged.*")

    report_content = "\n".join(report_lines)

    # Save to D:\Anti_spamm\HubQuiz_Monthly_Reports\
    out_dir = r"D:\Anti_spamm\HubQuiz_Monthly_Reports"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, f"HubQuiz_Monthly_Audit_{month_str}.md")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"Report successfully saved to: {out_file}")
    return out_file

if __name__ == "__main__":
    force_run = "--force" in sys.argv
    run_monthly_audit(force=force_run)
