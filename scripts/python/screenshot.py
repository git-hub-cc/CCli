import sys
import os
import time
import win32gui
import win32con
import pyautogui

def force_maximize_and_bring_to_front(hwnd):
    """
    强制将窗口调到前台，并将其最大化
    """
    # 绕过焦点限制：模拟按下并松开一次 Alt 键
    pyautogui.press('alt')
    time.sleep(0.1)

    # 尝试强制激活窗口
    try:
        win32gui.SetForegroundWindow(hwnd)
    except Exception as e:
        print(f"提示: SetForegroundWindow 获取焦点受限: {e}")

    # 强制把窗口拉到视觉最顶层
    win32gui.BringWindowToTop(hwnd)

    # 强制显示并最大化窗口
    win32gui.ShowWindow(hwnd, win32con.SW_MAXIMIZE)

def capture_screen(output_filename):
    """
    截取全屏桌面
    """
    try:
        screenshot = pyautogui.screenshot()
        screenshot.save(output_filename)
        print(f"全屏截图成功，已保存至 {output_filename}")
        return True
    except Exception as e:
        print(f"全屏截图失败: {e}")
        return False

def capture_window(window_title, output_filename):
    """
    查找指定标题的窗口并截取
    """
    hwnd = win32gui.FindWindow(None, window_title)
    if not hwnd:
        # 如果找不到精确匹配，尝试模糊匹配
        def callback(h, extra):
            if window_title.lower() in win32gui.GetWindowText(h).lower():
                extra.append(h)
        hwnds = []
        win32gui.EnumWindows(callback, hwnds)
        if hwnds:
            hwnd = hwnds[0]
        else:
            print(f"错误: 未找到标题包含 '{window_title}' 的窗口。")
            return False

    print(f"正在尝试操作窗口 '{win32gui.GetWindowText(hwnd)}'...")
    force_maximize_and_bring_to_front(hwnd)

    # 等待窗口完成最大化动画和内容重绘
    time.sleep(1.2)

    # 获取窗口当前的绝对坐标
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    width = right - left
    height = bottom - top

    # 边界检查
    if width <= 0 or height <= 0 or left < -10000:
        print(f"错误: 窗口坐标异常 ({left}, {top}, {width}, {height})。")
        return False

    try:
        screenshot = pyautogui.screenshot(region=(left, top, width, height))
        screenshot.save(output_filename)
        print(f"窗口截图成功，已保存至 {output_filename} (尺寸: {width}x{height})")
        return True
    except Exception as e:
        print(f"截图执行失败: {e}")
        return False

if __name__ == "__main__":
    # 强制将输出流编码设置为 UTF-8 以解决跨进程中文乱码和报错问题
    sys.stdout.reconfigure(encoding='utf-8')
    
    if len(sys.argv) < 3:
        print("用法: python screenshot.py <窗口标题|desktop> <输出路径>")
        sys.exit(1)

    target = sys.argv[1]
    output_path = sys.argv[2]

    # 确保输出目录存在
    output_dir = os.path.dirname(os.path.abspath(output_path))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    if target.lower() == "desktop":
        success = capture_screen(output_path)
    else:
        success = capture_window(target, output_path)

    if not success:
        sys.exit(1)