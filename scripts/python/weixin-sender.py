import sys
import time
import subprocess

def ensure_dependencies():
    try:
        import uiautomation
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "uiautomation>=3.0.0"], stdout=subprocess.DEVNULL)

ensure_dependencies()
import uiautomation as auto

def send_to_contact(contact, text, filepath):
    win = auto.WindowControl(ClassName='mmui::MainWindow')
    if not win.Exists(3, 1):
        print("未找到微信主窗口，请确保微信已启动并登录")
        return

    win.SetActive()
    time.sleep(0.5)

    auto.SendKeys('{Ctrl}f')
    time.sleep(1)

    auto.SendKeys(contact)
    time.sleep(1.5)

    item = None
    start_time = time.time()

    # 最多轮询等待 3 秒，确保搜索结果已加载
    while time.time() - start_time < 3:
        # 1. 优先尝试模糊匹配：寻找名字中包含搜索关键字的最前面的联系人
        for control, depth in auto.WalkControl(win, includeTop=False, maxDepth=8):
            if control.ControlType == auto.ControlType.ListItemControl and control.Name:
                if contact.lower() in control.Name.lower():
                    item = control
                    break
        if item:
            break

        # 2. 如果包含匹配失败（应对拼音简搜），直接抓取最前面的有效 ListItemControl
        for control, depth in auto.WalkControl(win, includeTop=False, maxDepth=8):
            if control.ControlType == auto.ControlType.ListItemControl and control.Name:
                # 过滤掉底部诸如搜一搜、网络查找等无用的固定分类项
                ignore_list = ["搜一搜", "Search", "网络", "更多", "More", "查找"]
                if not any(ign in control.Name for ign in ignore_list):
                    item = control
                    break
        if item:
            break

        time.sleep(0.5)

    if not item:
        print(f"联系人不存在或搜索无结果: {contact}")
        auto.SendKeys('{Esc}')
        return

    item.Click()
    time.sleep(0.8)

    if text and text not in ['-', '""', "''", "None", "null"]:
        auto.SendKeys(text)
        time.sleep(0.5)
        auto.SendKeys('{Enter}')
        time.sleep(0.5)

    if filepath and filepath not in ['-', '""', "''", "None", "null"]:
        ps_cmd = f"Set-Clipboard -Path '{filepath}'"
        subprocess.run(["powershell", "-Command", ps_cmd])
        time.sleep(0.8)
        auto.SendKeys('{Ctrl}v')
        time.sleep(0.8)
        auto.SendKeys('{Enter}')
        time.sleep(0.5)

def main():
    if len(sys.argv) < 4:
        sys.exit(1)

    contacts_raw = sys.argv[1]
    text = sys.argv[2]
    filepath = sys.argv[3]

    contacts = [c.strip() for c in contacts_raw.split(',') if c.strip()]
    
    for c in contacts:
        send_to_contact(c, text, filepath)

if __name__ == '__main__':
    main()