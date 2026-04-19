import sys
import os
import time
import ctypes
import win32gui
import win32con
import win32process
import pyautogui

def get_process_name_by_pid(pid):
    """根据 PID 获取进程文件名"""
    try:
        # PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if handle:
            exe_path = ctypes.create_unicode_buffer(512)
            size = ctypes.c_uint32(512)
            if ctypes.windll.kernel32.QueryFullProcessImageNameW(handle, 0, exe_path, ctypes.byref(size)):
                ctypes.windll.kernel32.CloseHandle(handle)
                return os.path.basename(exe_path.value).lower()
            ctypes.windll.kernel32.CloseHandle(handle)
    except Exception:
        pass
    return None

def app_wake():
    sys.stdout.reconfigure(encoding='utf-8')
    
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("【执行异常】参数不足！请提供目标进程名称 (例如 Weixin.exe)。")
        return

    target_name = sys.argv[1].strip().lower()
    if not target_name.endswith('.exe'):
        target_name += '.exe'

    found_hwnds = []

    def enum_windows_callback(hwnd, _):
        if not win32gui.IsWindow(hwnd):
            return
        
        # 忽略不可见的辅助窗口，但保留可能缩在托盘的窗口（通过判断样式）
        # 对于微信，其主窗口即使被“关闭”到托盘，句柄通常依然存在
        style = win32gui.GetWindowLong(hwnd, win32con.GWL_STYLE)
        if not (style & win32con.WS_CAPTION):
            return

        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        proc_name = get_process_name_by_pid(pid)
        
        if proc_name == target_name:
            title = win32gui.GetWindowText(hwnd)
            # 过滤掉微信一些无标题的子窗口或透明悬浮窗
            if title.strip():
                found_hwnds.append((hwnd, title))

    win32gui.EnumWindows(enum_windows_callback, None)

    if not found_hwnds:
        print(f"【动作被拒绝】未找到进程 '{target_name}' 关联的有效窗口。请确认程序已启动。")
        return

    # 微信通常会有多个窗口句柄，优先选择标题简单的那个（例如“微信”）
    # 或者选择第一个找到的有效句柄
    target_hwnd, target_title = found_hwnds[0]
    for hwnd, title in found_hwnds:
        if title == "微信" or title == "WeChat":
            target_hwnd, target_title = hwnd, title
            break

    try:
        print(f"正在尝试唤起窗口: {target_title} (HWND: {target_hwnd})...")

        # 绕过 Windows 的 SetForegroundWindow 限制：模拟按下一次 Alt 键
        pyautogui.press('alt')
        
        # 恢复窗口（防止最小化）
        # SW_RESTORE = 9
        win32gui.ShowWindow(target_hwnd, win32con.SW_RESTORE)
        time.sleep(0.1)
        
        # 强行置于前台
        win32gui.SetForegroundWindow(target_hwnd)
        
        # 如果是最大化状态，保持可见
        win32gui.BringWindowToTop(target_hwnd)

        print(f"【成功】已成功唤起并激活 {target_name} 的主界面。")
    except Exception as e:
        print(f"【执行异常】唤起窗口失败: {e}")

if __name__ == '__main__':
    app_wake()