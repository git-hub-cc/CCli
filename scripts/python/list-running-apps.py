import sys
import io
import os
import win32gui
import win32con
import win32process
import win32api
import ctypes

DWMWA_CLOAKED = 14

def is_cloaked(hwnd):
    cloaked = ctypes.c_int(0)
    try:
        ctypes.windll.dwmapi.DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            ctypes.byref(cloaked),
            ctypes.sizeof(cloaked)
        )
        return cloaked.value != 0
    except Exception:
        return False

def get_process_info(pid):
    """获取进程的完整绝对路径和文件名"""
    try:
        # PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if handle:
            exe_path = ctypes.create_unicode_buffer(512)
            size = ctypes.c_uint32(512)
            if ctypes.windll.kernel32.QueryFullProcessImageNameW(handle, 0, exe_path, ctypes.byref(size)):
                path = exe_path.value
                ctypes.windll.kernel32.CloseHandle(handle)
                filename = os.path.basename(path).lower()
                return path, filename
            ctypes.windll.kernel32.CloseHandle(handle)
    except Exception:
        pass
    return None, None

def is_main_app_window(hwnd, process_name):
    # 定义允许在后台/托盘运行的常见应用白名单
    background_whitelist = [
        'weixin.exe', 'wechat.exe', 'qq.exe', 'feishu.exe',
        'dingtalk.exe', 'steam.exe',
    ]

    ex_style = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)

    # 如果是白名单中的常驻应用，即使不可见也认为是有效主窗口
    # 但依然需要过滤掉纯工具提示或极小的悬浮窗
    if process_name in background_whitelist:
        if not (ex_style & win32con.WS_EX_TOOLWINDOW):
            return True

    # 对于常规应用，维持原有的严格前台可见性校验
    if not win32gui.IsWindowVisible(hwnd):
        return False
    if win32gui.GetWindow(hwnd, win32con.GW_OWNER) != 0:
        return False
    if (ex_style & win32con.WS_EX_TOOLWINDOW):
        return False
    if is_cloaked(hwnd):
        return False

    return True

def get_app_name(process_path, process_name, window_title):
    if not process_path:
        return window_title

    try:
        # 针对 UWP 框架宿主和资源管理器，强行退回使用原生的窗口标题
        if process_name in ['applicationframehost.exe', 'explorer.exe', 'wwahost.exe']:
            return window_title if window_title else process_name.replace('.exe', '')

        # 提取 EXE 文件的 FileDescription 属性，完美还原任务管理器的命名
        try:
            lang, codepage = win32api.GetFileVersionInfo(process_path, '\\VarFileInfo\\Translation')[0]
            str_info = f'\\StringFileInfo\\{lang:04X}{codepage:04X}\\FileDescription'
            desc = win32api.GetFileVersionInfo(process_path, str_info)
            if desc and desc.strip():
                return desc.strip()
        except Exception:
            pass

        # 兜底：如果没拿到描述，至少返回干净的进程名 (去掉 .exe)
        return process_name.replace('.exe', '').replace('.EXE', '')
    except Exception:
        pass

    return window_title

def main():
    # 强制将输出流编码设置为 UTF-8 以解决跨进程乱码问题
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    app_names = []
    seen_apps = set()

    def enum_windows_proc(hwnd, lParam):
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        process_path, process_name = get_process_info(pid)

        if is_main_app_window(hwnd, process_name):
            title = win32gui.GetWindowText(hwnd).strip()
            if title != "Program Manager":
                app_name = get_app_name(process_path, process_name, title)
                # 去重逻辑：相同的应用（例如开了多个 Chrome 或同属一个进程簇）只保留一个条目
                if app_name and app_name not in seen_apps:
                    app_names.append(app_name)
                    seen_apps.add(app_name)

    win32gui.EnumWindows(enum_windows_proc, None)

    if not app_names:
        print("【系统自动反馈】未能获取到任何有效的运行中应用。")
        return

    print("【系统自动反馈：当前运行的应用列表（含后台常驻应用）】")
    for idx, name in enumerate(app_names, 1):
        print(f"{idx}. {name}")

if __name__ == "__main__":
    main()