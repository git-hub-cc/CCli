import sys
import ctypes
import win32api
import win32con

def get_display_info():
    sys.stdout.reconfigure(encoding='utf-8')
    try:
        user32 = ctypes.windll.user32
        shcore = ctypes.windll.shcore
        user32.SetProcessDPIAware()

        monitors = []
        monitors_enum = win32api.EnumDisplayMonitors()
        
        for i, monitor in enumerate(monitors_enum):
            hMonitor = monitor[0]
            monitorInfo = win32api.GetMonitorInfo(hMonitor)
            rect = monitorInfo['Monitor']
            w = rect[2] - rect[0]
            h = rect[3] - rect[1]

            dpiX = ctypes.c_uint()
            dpiY = ctypes.c_uint()
            
            try:
                # MDT_EFFECTIVE_DPI = 0
                shcore.GetDpiForMonitor(hMonitor.handle, 0, ctypes.byref(dpiX), ctypes.byref(dpiY))
                scale = int((dpiX.value / 96.0) * 100)
            except Exception:
                scale = 100

            is_primary = " (主显示器)" if monitorInfo.get('Flags', 0) == win32con.MONITORINFOF_PRIMARY else ""
            monitors.append(f"显示器 {i+1}{is_primary}: 分辨率 {w}x{h}, 缩放比例 {scale}%, 起始坐标 ({rect[0]}, {rect[1]})")

        if not monitors:
            print("未能检测到显示器信息。")
            return

        for m in monitors:
            print(m)
            
    except Exception as e:
        print(f"获取显示器信息失败: {e}")

if __name__ == "__main__":
    get_display_info()