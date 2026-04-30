import sys
import json
import time
import subprocess

def ensure_dependencies():
    try:
        import uiautomation as auto
    except ImportError:
        print(json.dumps({
            "status": "info",
            "message": "正在安装 UIA 底层依赖 (uiautomation)，请稍候..."
        }), flush=True)
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'uiautomation'])
        except Exception as e:
            print(json.dumps({
                "status": "error",
                "message": f"依赖安装失败，请手动执行 pip install uiautomation。错误信息: {str(e)}"
            }))
            sys.exit(1)

def find_window(target_name):
    import uiautomation as auto
    auto.SetGlobalSearchTimeout(3)

    win = auto.WindowControl(searchDepth=1, Name=target_name)
    if win.Exists(0, 0):
        return win

    win = auto.WindowControl(searchDepth=1, ClassName=target_name)
    if win.Exists(0, 0):
        return win

    for w in auto.GetRootControl().GetChildren():
        if w.ControlType == auto.ControlType.WindowControl:
            if target_name.lower() in w.Name.lower():
                return w
    return None

def main():
    ensure_dependencies()
    import uiautomation as auto

    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "message": "参数不足，需提供 action 和 target"}))
        sys.exit(1)

    action = sys.argv[1].lower()
    target_name = sys.argv[2]
    value = sys.argv[3] if len(sys.argv) > 3 else ""

    try:
        win = find_window(target_name)
        if not win:
            print(json.dumps({"status": "error", "message": f"未找到目标窗口: {target_name}"}))
            sys.exit(0)

        win.SetActive()
        win.SetTopmost(True)
        time.sleep(0.5)

        if action == "scan":
            elements = []
            counter = 1
            for control in win.GetChildren():
                for sub in control.WalkTree():
                    c_type = sub.ControlTypeName
                    if c_type in ['TextControl', 'ButtonControl', 'EditControl', 'ListItemControl', 'DocumentControl', 'HyperlinkControl']:
                        rect = sub.BoundingRectangle
                        if rect.width() > 0 and rect.height() > 0:
                            elements.append({
                                "id": counter,
                                "type": c_type,
                                "name": sub.Name,
                                "bbox": {
                                    "x": rect.left,
                                    "y": rect.top,
                                    "w": rect.width(),
                                    "h": rect.height()
                                }
                            })
                            counter += 1
            win.SetTopmost(False)
            print(json.dumps({"status": "success", "data": elements}))

        elif action == "click":
            if not value:
                print(json.dumps({"status": "error", "message": "click 操作缺少短 ID"}))
                sys.exit(0)
            target_id = int(value)
            counter = 1
            clicked = False
            for control in win.GetChildren():
                for sub in control.WalkTree():
                    c_type = sub.ControlTypeName
                    if c_type in ['TextControl', 'ButtonControl', 'EditControl', 'ListItemControl', 'DocumentControl', 'HyperlinkControl']:
                        rect = sub.BoundingRectangle
                        if rect.width() > 0 and rect.height() > 0:
                            if counter == target_id:
                                sub.Click()
                                clicked = True
                                break
                            counter += 1
                if clicked:
                    break

            win.SetTopmost(False)
            if clicked:
                print(json.dumps({"status": "success", "message": f"成功点击 ID: {target_id}"}))
            else:
                print(json.dumps({"status": "error", "message": f"未找到 ID: {target_id}"}))

        elif action == "fill":
            if not value:
                print(json.dumps({"status": "error", "message": "fill 操作缺少值或目标信息"}))
                sys.exit(0)

            target_id = int(value.split('::')[0]) if '::' in value else int(value)
            text_to_fill = value.split('::')[1] if '::' in value else ""

            counter = 1
            filled = False
            for control in win.GetChildren():
                for sub in control.WalkTree():
                    c_type = sub.ControlTypeName
                    if c_type in ['TextControl', 'ButtonControl', 'EditControl', 'ListItemControl', 'DocumentControl', 'HyperlinkControl']:
                        rect = sub.BoundingRectangle
                        if rect.width() > 0 and rect.height() > 0:
                            if counter == target_id:
                                sub.Click()
                                time.sleep(0.1)
                                auto.SendKeys('{Ctrl}a{Delete}')
                                time.sleep(0.1)
                                auto.SendKeys(text_to_fill)
                                filled = True
                                break
                            counter += 1
                if filled:
                    break

            win.SetTopmost(False)
            if filled:
                print(json.dumps({"status": "success", "message": f"成功在 ID {target_id} 处输入文本"}))
            else:
                print(json.dumps({"status": "error", "message": f"未找到 ID: {target_id}"}))

        else:
            win.SetTopmost(False)
            print(json.dumps({"status": "error", "message": f"不支持的动作: {action}"}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()