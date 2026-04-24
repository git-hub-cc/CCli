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

    # --- 核心规则定义 ---
    # 1. 分类表头：遇到它们时直接跳过
    category_headers = ["Features", "功能", "Contacts", "联系人", "Group Chats", "群聊", "Official Accounts", "公众号"]

    # 2. 终止边界：遇到它们说明真正的联系人区域已结束，或者本地根本没搜到
    stop_nodes = [
        "Chat History", "聊天记录",
        "Search Weixin ID:", "搜索微信号:",
        "Internet search results", "搜一搜", "网络", "查找"
    ]

    while time.time() - start_time < 3:
        for control, depth in auto.WalkControl(win, includeTop=False, maxDepth=8):
            if control.ControlType == auto.ControlType.ListItemControl and control.Name:
                name = control.Name

                # 如果撞到了“底部边界”或“网络查找”，说明该联系人不存在，直接跳出遍历
                if any(stop_kw in name for stop_kw in stop_nodes):
                    break

                # 如果是分类表头，跳过，继续看下一个节点
                if name in category_headers:
                    continue

                # 剩下的就是处于中间的有效联系人节点了
                # 优先匹配包含关键字的节点
                if contact.lower() in name.lower():
                    item = control
                    break

                # 如果没有直接包含关键字（比如用了拼音首字母搜索），记录碰到的第一个有效联系人
                if not item:
                    item = control

        # 如果 item 已经找到了，跳出轮询等待
        if item:
            break

        time.sleep(0.5)

    if not item:
        print(f"联系人不存在或搜索无结果: {contact}")
        auto.SendKeys('{Esc}') # 清空搜索框状态，方便下一个搜索
        return

    print(f"已找到联系人: {item.Name}，准备发送...")
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
        print("Usage: python weixin-sender.py <contacts> <text> <filepath>")
        sys.exit(1)

    contacts_raw = sys.argv[1]
    text = sys.argv[2]
    filepath = sys.argv[3]

    contacts = [c.strip() for c in contacts_raw.split(',') if c.strip()]
    
    for c in contacts:
        send_to_contact(c, text, filepath)

if __name__ == '__main__':
    main()