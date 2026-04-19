import winreg
import sys
import os
import glob

def find_main_exe(install_dir, app_name):
    """在安装目录中启发式寻找最可能的主程序 exe"""
    if not os.path.exists(install_dir) or not os.path.isdir(install_dir):
        return None

    # 1. 扫描目录下的所有 exe
    exe_files = glob.glob(os.path.join(install_dir, "*.exe"))

    if not exe_files:
        # 有时主程序藏在 bin 等子目录下，进行最多向下 1 层的浅搜索
        for root, dirs, files in os.walk(install_dir):
            for file in files:
                if file.lower().endswith('.exe'):
                    exe_files.append(os.path.join(root, file))
            # 控制搜索深度，防止遍历巨大目录耗时过长
            if root.count(os.sep) - install_dir.count(os.sep) > 0:
                dirs.clear()

    if not exe_files:
        return None

    # 2. 过滤掉常见的非主程序 (卸载程序、升级程序、崩溃报告等)
    ignore_list = ['uninst', 'uninstall', 'update', 'setup', 'crash', 'reporter', 'helper', 'elevate']
    valid_exes = []
    for exe in exe_files:
        base_name = os.path.basename(exe).lower()
        if not any(ignore in base_name for ignore in ignore_list):
            valid_exes.append(exe)

    if not valid_exes:
        return None

    # 3. 启发式匹配：寻找文件名和应用名相似的 exe
    app_name_lower = app_name.lower().replace(' ', '')
    for exe in valid_exes:
        exe_name_lower = os.path.basename(exe).lower().replace('.exe', '')
        # 互相包含判断，例如应用名 "WeChat" 和文件 "weixin.exe" 匹配不上，但常规英文名可以
        if exe_name_lower in app_name_lower or app_name_lower in exe_name_lower:
            return exe

    # 4. 如果没有名称匹配的，默认选取文件最大的那个（通常主程序的体积是最大的）
    try:
        return max(valid_exes, key=os.path.getsize)
    except OSError:
        return valid_exes[0]

def get_installed_apps():
    apps = {}
    keys_to_check = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")
    ]

    for hkey, subkey in keys_to_check:
        try:
            with winreg.OpenKey(hkey, subkey) as key:
                for i in range(winreg.QueryInfoKey(key)[0]):
                    try:
                        subkey_name = winreg.EnumKey(key, i)
                        with winreg.OpenKey(key, subkey_name) as app_key:
                            try:
                                name = winreg.QueryValueEx(app_key, "DisplayName")[0]
                                if not name or name.startswith("KB"):
                                    continue

                                exe_path = None

                                # 策略 1：优先信任 DisplayIcon，它几乎总是直接指向主程序的 .exe
                                try:
                                    icon = winreg.QueryValueEx(app_key, "DisplayIcon")[0]
                                    icon_path = icon.split(',')[0].strip('"').strip("'")
                                    if icon_path.lower().endswith('.exe') and os.path.exists(icon_path):
                                        exe_path = icon_path
                                except OSError:
                                    pass

                                # 策略 2：如果没有合法的 icon，尝试获取安装目录并智能检索 exe
                                if not exe_path:
                                    try:
                                        location = winreg.QueryValueEx(app_key, "InstallLocation")[0]
                                        if location and os.path.exists(location):
                                            if os.path.isdir(location):
                                                exe_path = find_main_exe(location, name)
                                            elif location.lower().endswith('.exe'):
                                                exe_path = location
                                    except OSError:
                                        pass

                                if exe_path:
                                    # 规范化路径，避免出现双斜杠或末尾带空格
                                    apps[name] = os.path.normpath(exe_path)

                            except OSError:
                                pass
                    except OSError:
                        pass
        except OSError:
            pass

    return apps

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    apps = get_installed_apps()

    if not apps:
        print("【系统自动反馈】未能获取到已安装的应用列表。")
        return

    print("【系统自动反馈：当前系统中已安装的应用及主程序路径】")
    for idx, (name, path) in enumerate(sorted(apps.items()), 1):
        print(f"{idx}. {name} -> {path}")

if __name__ == "__main__":
    main()